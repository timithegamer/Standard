#!/usr/bin/env python3
"""Lokaler Entwicklungsserver.

Bildet die beiden Netlify-Funktionen nach:

    site/netlify/functions/plaetze.mjs      -> /api/plaetze
    site/netlify/functions/verwaltung.mjs   -> /api/verwaltung/*

Damit laesst sich die ganze Seite samt Verwaltungsbereich lokal
ausprobieren, ohne zu deployen. Das ist hier kein Luxus: Jeder
Produktions-Deploy kostet bei Netlify 15 von 300 Monats-Credits.

Starten:   python3 build.py && python3 dev-server.py
Aufrufen:  http://127.0.0.1:8783

Der Verwaltungsbereich braucht dieselben Umgebungsvariablen wie live:

    export VERWALTUNG_PASSWORT='scrypt$...'      (aus zugang-einrichten.py)
    export VERWALTUNG_GEHEIMNIS='...'

Fehlen sie, verhaelt sich der Bereich wie in der Produktion: Er
verweigert die Arbeit, statt ohne Schutz zu oeffnen.

Anders als live liegen die Termine hier in einer Datei unter .arbeit/
statt im Blob-Speicher. Sonst ist der Ablauf derselbe.

ACHTUNG: Diese Datei ist ein Nachbau. Werden die Funktionen geaendert,
muss sie mitgeaendert werden - sonst testet man etwas anderes, als
spaeter tatsaechlich laeuft.
"""

import base64
import hashlib
import hmac
import http.server
import json
import os
import pathlib
import re
import secrets
import time
import datetime
import urllib.parse
import urllib.request

WURZEL = pathlib.Path(__file__).parent
ABLAGE = WURZEL / ".arbeit"
TERMINDATEI = ABLAGE / "verwaltung-termine.json"
SPERRDATEI = ABLAGE / "verwaltung-schutz.json"

TABELLE = ("https://docs.google.com/spreadsheets/d/e/2PACX-1vSXpfe7o0zV075kfvaDYblYd0gHVr8jEg"
           "QuJncrYrYCACr9fI0pGCBvtknXJSmVKykNDdU9K1bA_FE_/pub?gid=938045566&single=true&output=csv")

KEKS = "sg_sitzung"
SITZUNGSDAUER = 8 * 60 * 60          # Sekunden
MAX_VERSUCHE = 5
SPERRE = 15 * 60
MAX_TERMINE = 200

ELEMENTE = ["", "holz", "feuer", "erde", "metall", "wasser"]
STEUERZEICHEN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

def echtes_datum(wert: str) -> bool:
    """Die Form allein reicht nicht - den 45. Dreizehnten gibt es nicht."""
    if not wert:
        return True
    try:
        return datetime.date.fromisoformat(wert).isoformat() == wert
    except ValueError:
        return False


# Dieselben Regeln wie in verwaltung.mjs.
# Je Feld: (Hoechstlaenge, Muster, erlaubte Werte, zusaetzliche Pruefung)
FELDER = {
    "datum":      (10,   None, None, echtes_datum),
    "enddatum":   (10,   None, None, echtes_datum),
    "zeit":       (5,    re.compile(r"^(([01]\d|2[0-3]):[0-5]\d)?$"), None, None),
    "art":        (40,   None, None, None),
    "element":    (10,   None, ELEMENTE, None),
    "titel":      (160,  None, None, None),
    "text":       (1500, None, None, None),
    "preis":      (40,   None, None, None),
    "ort":        (80,   None, None, None),
    "leistungen": (400,  None, None, None),
    "buchung":    (300,  re.compile(r"^(https://[^\s\"'<>]{4,})?$"), None, None),
    "plaetze":    (40,   None, None, None),
}


# ============================================================
#   Hilfen
# ============================================================

def b64url(roh: bytes) -> str:
    return base64.urlsafe_b64encode(roh).decode().rstrip("=")


def datei_lesen(pfad, ersatz):
    try:
        return json.loads(pfad.read_text(encoding="utf-8"))
    except Exception:
        return ersatz


def datei_schreiben(pfad, daten):
    ABLAGE.mkdir(exist_ok=True)
    pfad.write_text(json.dumps(daten, ensure_ascii=False, indent=1), encoding="utf-8")


def csv_lesen(text: str):
    """Wie die Fassung in plaetze.mjs."""
    zeilen, feld, zeile, in_quote = [], "", [], False
    i = 0
    while i < len(text):
        c = text[i]
        if in_quote:
            if c == '"':
                if i + 1 < len(text) and text[i + 1] == '"':
                    feld += '"'
                    i += 1
                else:
                    in_quote = False
            else:
                feld += c
        elif c == '"':
            in_quote = True
        elif c == ",":
            zeile.append(feld); feld = ""
        elif c == "\n":
            zeile.append(feld); zeilen.append(zeile); zeile = []; feld = ""
        elif c != "\r":
            feld += c
        i += 1
    if feld or zeile:
        zeile.append(feld); zeilen.append(zeile)
    if not zeilen:
        return []

    def norm(s):
        s = s.strip().lower()
        for a, b in (("ä", "a"), ("ö", "o"), ("ü", "u")):
            s = s.replace(a, b)
        return re.sub(r"[^a-z]", "", s)

    schluessel = {
        "datum": "datum", "enddatum": "enddatum", "uhrzeit": "zeit", "zeit": "zeit",
        "art": "art", "element": "element", "titel": "titel",
        "beschreibung": "text", "text": "text",
        "preis": "preis", "ort": "ort", "leistungen": "leistungen",
        "platze": "plaetze", "plaetze": "plaetze", "status": "plaetze",
        "buchung": "buchung", "buchungslink": "buchung", "link": "buchung",
    }
    kopf = [norm(x) for x in zeilen[0]]
    ergebnis = []
    for r in zeilen[1:]:
        if not any(z.strip() for z in r):
            continue
        o = {}
        for i, h in enumerate(kopf):
            k = schluessel.get(h)
            if k:
                o[k] = (r[i] if i < len(r) else "").strip()
        ergebnis.append(o)
    return ergebnis


def termine_pruefen(rohe):
    if not isinstance(rohe, list):
        return None, "Es wurde keine Liste übermittelt."
    if len(rohe) > MAX_TERMINE:
        return None, f"Höchstens {MAX_TERMINE} Einträge."

    sauber = []
    for i, roh in enumerate(rohe, 1):
        if not isinstance(roh, dict):
            return None, f"Eintrag {i} ist unbrauchbar."
        eintrag = {}
        for name, (maxlen, muster, liste, pruefer) in FELDER.items():
            wert = "" if roh.get(name) is None else str(roh.get(name))
            wert = STEUERZEICHEN.sub("", wert.replace("\r\n", "\n")).strip()
            if len(wert) > maxlen:
                return None, f"Eintrag {i}: „{name}“ ist zu lang (höchstens {maxlen} Zeichen)."
            if liste is not None and wert.lower() not in liste:
                return None, f"Eintrag {i}: „{name}“ hat einen unbekannten Wert."
            if muster is not None and not muster.match(wert):
                return None, f"Eintrag {i}: „{name}“ hat ein ungültiges Format."
            if pruefer is not None and not pruefer(wert):
                return None, f"Eintrag {i}: „{name}“ ist kein gültiges Datum."
            eintrag[name] = wert.lower() if liste is not None else wert
        if not eintrag["titel"]:
            return None, f"Eintrag {i} braucht einen Titel."
        if eintrag["enddatum"] and eintrag["datum"] and eintrag["enddatum"] < eintrag["datum"]:
            return None, f"Eintrag {i}: Das Ende liegt vor dem Anfang."
        sauber.append(eintrag)
    return sauber, None


# ============================================================
#   Passwort und Sitzung - Nachbau von verwaltung.mjs
# ============================================================

def passwort_stimmt(eingabe: str, gespeichert: str) -> bool:
    teile = (gespeichert or "").split("$")
    if len(teile) != 6 or teile[0] != "scrypt":
        return False
    try:
        n, r, p = int(teile[1]), int(teile[2]), int(teile[3])
        salz = base64.b64decode(teile[4])
        soll = base64.b64decode(teile[5])
        ist = hashlib.scrypt(eingabe.encode("utf-8"), salt=salz,
                             n=n, r=r, p=p, dklen=len(soll),
                             maxmem=256 * 1024 * 1024)
    except Exception:
        return False
    return hmac.compare_digest(ist, soll)


def sitzung_bauen(geheimnis: str) -> str:
    inhalt = b64url(json.dumps({
        "bis": int((time.time() + SITZUNGSDAUER) * 1000),
        "z": b64url(secrets.token_bytes(9)),
    }).encode())
    zeichen = b64url(hmac.new(geheimnis.encode(), inhalt.encode(), hashlib.sha256).digest())
    return inhalt + "." + zeichen


def sitzung_gilt(merkmal, geheimnis: str) -> bool:
    if not merkmal or not isinstance(merkmal, str) or len(merkmal) > 400:
        return False
    if "." not in merkmal:
        return False
    inhalt, _, zeichen = merkmal.rpartition(".")
    soll = b64url(hmac.new(geheimnis.encode(), inhalt.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(zeichen, soll):
        return False
    try:
        roh = base64.urlsafe_b64decode(inhalt + "=" * (-len(inhalt) % 4))
        return json.loads(roh).get("bis", 0) > time.time() * 1000
    except Exception:
        return False


# ============================================================
#   Server
# ============================================================

class H(http.server.SimpleHTTPRequestHandler):

    # ---------- Werkzeuge ----------

    def antwort(self, code, obj, kopf=None):
        roh = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("cache-control", "no-store, private")
        self.send_header("content-length", str(len(roh)))
        for name, wert in (kopf or {}).items():
            self.send_header(name, wert)
        self.end_headers()
        self.wfile.write(roh)

    def keks(self, name):
        roh = self.headers.get("cookie") or ""
        for teil in roh.split(";"):
            if "=" in teil:
                k, _, v = teil.partition("=")
                if k.strip() == name:
                    return urllib.parse.unquote(v.strip())
        return None

    def koerper(self):
        try:
            laenge = int(self.headers.get("content-length") or 0)
            if laenge <= 0 or laenge > 512 * 1024:
                return {}
            return json.loads(self.rfile.read(laenge))
        except Exception:
            return {}

    def umgebung(self):
        return os.environ.get("VERWALTUNG_PASSWORT"), os.environ.get("VERWALTUNG_GEHEIMNIS")

    # ---------- Termine holen (wie plaetze.mjs) ----------

    def termine_quelle(self):
        eigene = datei_lesen(TERMINDATEI, None)
        if eigene and eigene.get("termine"):
            return {"termine": eigene["termine"], "quelle": "verwaltung"}
        try:
            rq = urllib.request.Request(TABELLE, headers={"user-agent": "Mozilla/5.0"})
            zeilen = csv_lesen(urllib.request.urlopen(rq, timeout=8).read().decode("utf-8", "ignore"))
            if zeilen:
                return {"termine": zeilen, "quelle": "tabelle"}
        except Exception:
            pass
        return None

    # ---------- GET ----------

    def do_GET(self):
        teile = urllib.parse.urlparse(self.path)

        if teile.path == "/api/plaetze":
            q = urllib.parse.parse_qs(teile.query)
            if q.get("tabelle", [""])[0] != "termine":
                return self.antwort(400, {"fehler": "unbekannte Anfrage"})
            daten = self.termine_quelle()
            if not daten:
                return self.antwort(502, {"fehler": "keine Quelle erreichbar"})
            return self.antwort(200, daten)

        if teile.path.startswith("/api/verwaltung"):
            return self.verwaltung("GET", teile)

        return super().do_GET()

    def do_POST(self):
        return self.verwaltung("POST", urllib.parse.urlparse(self.path))

    def do_PUT(self):
        return self.verwaltung("PUT", urllib.parse.urlparse(self.path))

    # ---------- Verwaltung (wie verwaltung.mjs) ----------

    def verwaltung(self, art, teile):
        if not teile.path.startswith("/api/verwaltung"):
            return self.antwort(404, {"fehler": "unbekannt"})

        hashwort, geheimnis = self.umgebung()
        if not hashwort or not geheimnis or len(geheimnis) < 24:
            return self.antwort(503, {
                "fehler": "Der Verwaltungsbereich ist noch nicht eingerichtet. "
                          "Siehe zugang-einrichten.py.",
                "eingerichtet": False,
            })

        if art != "GET" and self.headers.get("x-verwaltung") != "1":
            return self.antwort(400, {"fehler": "Ungültige Anfrage."})

        pfad = re.sub(r"^/api/verwaltung/?", "", teile.path)
        angemeldet = sitzung_gilt(self.keks(KEKS), geheimnis)

        if pfad == "status" and art == "GET":
            return self.antwort(200, {"angemeldet": angemeldet, "eingerichtet": True})

        if pfad == "anmeldung" and art == "POST":
            return self.anmelden(hashwort, geheimnis)

        if pfad == "abmeldung" and art == "POST":
            return self.antwort(200, {"angemeldet": False}, {
                "set-cookie": f"{KEKS}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"})

        if not angemeldet:
            return self.antwort(401, {"fehler": "Nicht angemeldet.", "angemeldet": False})

        if pfad == "termine" and art == "GET":
            daten = datei_lesen(TERMINDATEI, None) or {}
            return self.antwort(200, {
                "termine": daten.get("termine", []),
                "stand": daten.get("stand", 0),
                "benutzt": bool(daten.get("termine")),
            })

        if pfad == "termine" and art == "PUT":
            koerper = self.koerper()
            sauber, fehler = termine_pruefen(koerper.get("termine"))
            if fehler:
                return self.antwort(400, {"fehler": fehler})
            vorher = datei_lesen(TERMINDATEI, None) or {}
            if vorher.get("stand") and koerper.get("stand") and vorher["stand"] != koerper["stand"]:
                return self.antwort(409, {
                    "fehler": "Inzwischen wurde an anderer Stelle gespeichert. "
                              "Bitte die Seite neu laden.",
                    "konflikt": True})
            stand = int(time.time() * 1000)
            datei_schreiben(TERMINDATEI, {"termine": sauber, "stand": stand})
            return self.antwort(200, {"gespeichert": True, "stand": stand, "anzahl": len(sauber)})

        if pfad == "tabelle" and art == "GET":
            daten = self.termine_quelle()
            if not daten:
                return self.antwort(502, {"fehler": "Die Tabelle war nicht erreichbar."})
            sauber, fehler = termine_pruefen(daten["termine"])
            if fehler:
                return self.antwort(422, {"fehler": "Die Tabelle enthält: " + fehler})
            return self.antwort(200, {"termine": sauber, "quelle": daten["quelle"]})

        return self.antwort(404, {"fehler": "Unbekannte Anfrage."})

    def anmelden(self, hashwort, geheimnis):
        kennung = b64url(hmac.new(geheimnis.encode(),
                                  ("ip:" + (self.client_address[0] or "?")).encode(),
                                  hashlib.sha256).digest())[:24]
        schutz = datei_lesen(SPERRDATEI, {})
        stand = schutz.get(kennung, {"versuche": 0, "bis": 0})
        if stand["bis"] > time.time():
            minuten = int((stand["bis"] - time.time()) / 60) + 1
            return self.antwort(429, {
                "fehler": f"Zu viele Fehlversuche. Bitte in {minuten} Minuten erneut versuchen."})

        eingabe = str(self.koerper().get("passwort") or "")
        beginn = time.time()
        stimmt = 0 < len(eingabe) <= 200 and passwort_stimmt(eingabe, hashwort)
        rest = 0.3 - (time.time() - beginn)
        if rest > 0:
            time.sleep(rest)

        if not stimmt:
            versuche = stand["versuche"] + 1
            schutz[kennung] = {
                "versuche": versuche,
                "bis": time.time() + SPERRE * (2 ** (versuche - MAX_VERSUCHE))
                       if versuche >= MAX_VERSUCHE else 0,
            }
            datei_schreiben(SPERRDATEI, schutz)
            return self.antwort(401, {"fehler": "Passwort stimmt nicht."})

        schutz.pop(kennung, None)
        datei_schreiben(SPERRDATEI, schutz)
        return self.antwort(200, {"angemeldet": True}, {
            "set-cookie": f"{KEKS}={sitzung_bauen(geheimnis)}; Path=/; HttpOnly; "
                          f"Secure; SameSite=Strict; Max-Age={SITZUNGSDAUER}"})

    def log_message(self, *a):
        pass


def main():
    hashwort, geheimnis = os.environ.get("VERWALTUNG_PASSWORT"), os.environ.get("VERWALTUNG_GEHEIMNIS")
    print("Website:     http://127.0.0.1:8783")
    if hashwort and geheimnis and len(geheimnis) >= 24:
        print("Verwaltung:  http://127.0.0.1:8783/verwaltung.html")
        print(f"Termine liegen lokal in {TERMINDATEI.relative_to(WURZEL)}")
    else:
        print("Verwaltung:  aus - es fehlen VERWALTUNG_PASSWORT und/oder VERWALTUNG_GEHEIMNIS.")
        print("             Werte erzeugen mit: python3 zugang-einrichten.py")
    print()
    os.chdir(WURZEL / "site")
    http.server.HTTPServer(("127.0.0.1", 8783), H).serve_forever()


if __name__ == "__main__":
    main()
