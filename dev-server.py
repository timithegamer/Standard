"""Lokaler Entwicklungsserver.

Bildet die Netlify-Funktion aus site/netlify/functions/plaetze.mjs nach,
damit sich die Website mit echten Daten testen laesst, ohne zu deployen.
Jeder Produktions-Deploy kostet bei Netlify 15 von 300 Monats-Credits -
das Entwickeln soll davon nichts verbrauchen.

Starten:   python3 dev-server.py
Aufrufen:  http://127.0.0.1:8783

ACHTUNG: Diese Datei ist ein Nachbau. Wird plaetze.mjs geaendert,
muss sie mitgeaendert werden, sonst testet man etwas anderes,
als spaeter live laeuft.
"""
import http.server, json, re, urllib.request, urllib.parse, os

ERLAUBT = re.compile(r'^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$')
TABELLE = ("https://docs.google.com/spreadsheets/d/e/2PACX-1vSXpfe7o0zV075kfvaDYblYd0gHVr8jEg"
           "QuJncrYrYCACr9fI0pGCBvtknXJSmVKykNDdU9K1bA_FE_/pub?gid=938045566&single=true&output=csv")

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        teile = urllib.parse.urlparse(self.path)
        if teile.path == "/api/plaetze":
            q0 = urllib.parse.parse_qs(teile.query)
            if q0.get("tabelle", [""])[0] == "termine":
                try:
                    rq = urllib.request.Request(TABELLE, headers={"user-agent": "Mozilla/5.0"})
                    csvtext = urllib.request.urlopen(rq, timeout=8).read()
                except Exception as e:
                    return self.antwort(502, {"fehler": str(e)[:60]})
                self.send_response(200)
                self.send_header("content-type", "text/csv; charset=utf-8")
                self.send_header("content-length", str(len(csvtext)))
                self.end_headers()
                self.wfile.write(csvtext)
                return
            q = urllib.parse.parse_qs(teile.query)
            nutzer, art = q.get("user",[""])[0], q.get("type",[""])[0]
            if nutzer and art:
                von, bis = q.get("start",[""])[0], q.get("end",[""])[0]
                if not (ERLAUBT.match(nutzer) and ERLAUBT.match(art)
                        and re.match(r"^\d{4}-\d{2}-\d{2}$", von) and re.match(r"^\d{4}-\d{2}-\d{2}$", bis)):
                    return self.antwort(400, {"fehler": "ungueltig"})
                try:
                    u = (f"https://api.cal.com/v2/slots?eventTypeSlug={art}&username={nutzer}"
                         f"&start={von}&end={bis}")
                    rq = urllib.request.Request(u, headers={"cal-api-version": "2024-09-04", "user-agent": "Mozilla/5.0 (kompatibel; tcm-grohe.at)"})
                    d = json.loads(urllib.request.urlopen(rq, timeout=8).read())
                except Exception as e:
                    return self.antwort(502, {"fehler": str(e)[:60]})
                z = sum(len(v) for v in (d.get("data") or {}).values())
                return self.antwort(200, {"zeiten": z})
            kennung = q.get("event", [""])[0]
            if not ERLAUBT.match(kennung):
                return self.antwort(400, {"fehler": "ungueltige Kennung"})
            try:
                req = urllib.request.Request(f"https://cal.com/{kennung}", headers={
                    "user-agent": "Mozilla/5.0 (kompatibel; tcm-grohe.at)",
                    "accept-language": "de-AT,de;q=0.9"})
                seite = urllib.request.urlopen(req, timeout=8).read().decode("utf-8", "ignore")
            except Exception as e:
                return self.antwort(502, {"fehler": str(e)[:60]})
            m = re.search(r'\\?"capacity\\?"\s*:\s*\{(.*?)\}', seite)
            if not m:
                return self.antwort(200, {"unbegrenzt": True})
            d = json.loads(("{" + m.group(1) + "}").replace('\\"', '"'))
            return self.antwort(200, {"begrenzt": d.get("limited") is True,
                                      "gesamt": d.get("total"),
                                      "belegt": d.get("confirmedCount"),
                                      "frei": d.get("spotsRemaining")})
        return super().do_GET()

    def antwort(self, code, obj):
        roh = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(roh)))
        self.end_headers()
        self.wfile.write(roh)

    def log_message(self, *a): pass

os.chdir("site")
http.server.HTTPServer(("127.0.0.1", 8783), H).serve_forever()
