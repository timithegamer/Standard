#!/usr/bin/env python3
"""Baut site/ aus src/.

    python3 build.py

Es gibt bewusst kein npm und keinen Bundler. Der Bauschritt macht nur
drei Dinge:

  1. src/pages/*.html      -> site/*.html   (Rumpf aus src/layout/document.html,
                                             Bausteine aus src/partials/)
  2. src/css/*.css         -> site/assets/style.css   (der Reihe nach zusammengelegt)
  3. src/js/*.js           -> site/assets/app.js      (dito, in eine IIFE gepackt)

Danach bekommen style.css und app.js eine Kennung aus dem Dateiinhalt
angehaengt (?v=...), damit Browser nach einer Aenderung nicht die alte
Fassung aus dem Zwischenspeicher zeigen.

Bilder, Schriften und die JSON-Dateien liegen unveraendert in site/ und
werden nicht angefasst.

WICHTIG: site/*.html, site/assets/style.css und site/assets/app.js sind
erzeugte Dateien. Wer sie direkt bearbeitet, verliert die Aenderung beim
naechsten Bauen. Bearbeitet wird immer src/.
"""

import hashlib
import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).parent
SRC = WURZEL / "src"
SITE = WURZEL / "site"

WARNUNG = ("Erzeugte Datei - nicht direkt bearbeiten.\n"
           "   Quelle: {quelle}\n"
           "   Bauen:  python3 build.py")

# {{> partials/hero.html }}
EINBINDEN = re.compile(r"\{\{>\s*([A-Za-z0-9_./-]+)\s*\}\}")
# {{ titel }}
PLATZHALTER = re.compile(r"\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}")
# <!--meta { ... } meta-->
KOPFDATEN = re.compile(r"^\s*<!--meta\s*(\{.*?\})\s*meta-->\s*", re.S)


def einbinden(text, tiefe=0):
    """Loest {{> pfad }} auf, auch verschachtelt."""
    if tiefe > 12:
        raise RuntimeError("Bausteine sind zu tief verschachtelt (Kreis?)")

    def ersetzen(treffer):
        pfad = SRC / treffer.group(1)
        if not pfad.exists():
            raise FileNotFoundError(f"Baustein fehlt: {treffer.group(1)}")
        return einbinden(pfad.read_text(encoding="utf-8").rstrip("\n"), tiefe + 1)

    return EINBINDEN.sub(ersetzen, text)


def platzhalter(text, werte):
    def ersetzen(treffer):
        return str(werte.get(treffer.group(1), ""))
    return PLATZHALTER.sub(ersetzen, text)


def zusammenlegen(ordner, endung):
    """Legt alle Dateien eines Ordners in Dateinamen-Reihenfolge zusammen."""
    teile = []
    for datei in sorted((SRC / ordner).glob(f"*{endung}")):
        teile.append(f"/* ---------- {datei.name} ---------- */\n")
        teile.append(datei.read_text(encoding="utf-8").strip())
        teile.append("\n\n")
    return "".join(teile).rstrip() + "\n"


def bauen():
    if not SRC.exists():
        sys.exit("src/ fehlt - nichts zu bauen.")

    (SITE / "assets").mkdir(parents=True, exist_ok=True)

    # --- CSS ---
    css = zusammenlegen("css", ".css")
    kopf = "/* " + WARNUNG.format(quelle="src/css/*.css") + " */\n\n"
    (SITE / "assets/style.css").write_text(kopf + css, encoding="utf-8")

    # --- JS ---
    js = zusammenlegen("js", ".js")
    kopf = "/* " + WARNUNG.format(quelle="src/js/*.js") + " */\n"
    js = kopf + '"use strict";\n(function () {\n' + js + "\n})();\n"
    (SITE / "assets/app.js").write_text(js, encoding="utf-8")

    # --- Verwaltungsbereich: eigenes Buendel ---
    # Der Code fuer die Verwaltung hat auf den oeffentlichen Seiten nichts
    # verloren - er wird deshalb getrennt gebaut und nur dort geladen.
    if (SRC / "verwaltung").exists():
        vcss = zusammenlegen("verwaltung", ".css")
        vjs = zusammenlegen("verwaltung", ".js")
        kopf = "/* " + WARNUNG.format(quelle="src/verwaltung/*.css") + " */\n\n"
        (SITE / "assets/verwaltung.css").write_text(kopf + vcss, encoding="utf-8")
        kopf = "/* " + WARNUNG.format(quelle="src/verwaltung/*.js") + " */\n"
        (SITE / "assets/verwaltung.js").write_text(
            kopf + '"use strict";\n(function () {\n' + vjs + "\n})();\n", encoding="utf-8")

    # --- Kennungen fuers Zwischenspeichern ---
    kennung = {}
    for name in ("assets/style.css", "assets/app.js", "assets/fonts.css",
                 "assets/verwaltung.css", "assets/verwaltung.js"):
        datei = SITE / name
        if datei.exists():
            kennung[name] = hashlib.sha1(datei.read_bytes()).hexdigest()[:8]

    # --- Seiten ---
    gebaut = []

    for seite in sorted((SRC / "pages").glob("*.html")):
        roh = seite.read_text(encoding="utf-8")

        daten = {}
        treffer = KOPFDATEN.match(roh)
        if treffer:
            daten = json.loads(treffer.group(1))
            roh = roh[treffer.end():]

        # Kopfbeigaben je Seite: liegt src/partials/kopf-<name>.html vor,
        # wird es in den <head> gelegt (OG-Angaben, strukturierte Daten).
        beigabe = SRC / f"partials/kopf-{seite.stem}.html"
        kopf_extra = einbinden(beigabe.read_text(encoding="utf-8")) if beigabe.exists() else ""

        # Vorspann je Seite: steht vor der Kopfzeile (etwa der Umzugshinweis).
        vorspann_datei = SRC / f"partials/vorspann-{seite.stem}.html"
        vorspann = einbinden(vorspann_datei.read_text(encoding="utf-8")) if vorspann_datei.exists() else ""

        kanonisch = daten.get("kanonisch", "")
        robots = daten.get("robots", "")

        # Seiten duerfen ein anderes Grundgeruest verlangen. Der
        # Verwaltungsbereich ist ein Werkzeug, keine Markenseite - er
        # braucht weder Vorhang noch eigenen Mauszeiger.
        rumpf = (SRC / "layout" / (daten.get("rumpf", "document") + ".html")).read_text(encoding="utf-8")

        werte = {
            "titel": daten.get("titel", ""),
            "beschreibung": daten.get("beschreibung", ""),
            "kanonisch": f'<link rel="canonical" href="{kanonisch}">' if kanonisch else "",
            "robots": f'<meta name="robots" content="{robots}">' if robots else "",
            "koerperklasse": daten.get("koerperklasse", ""),
            "heimat": daten.get("heimat", ""),
            "kopf_extra": kopf_extra,
            "vorspann": vorspann,
            "inhalt": einbinden(roh).strip(),
            "css": f"assets/style.css?v={kennung.get('assets/style.css', '')}",
            "js": f"assets/app.js?v={kennung.get('assets/app.js', '')}",
            "fonts": f"assets/fonts.css?v={kennung.get('assets/fonts.css', '')}",
            "verw_css": f"assets/verwaltung.css?v={kennung.get('assets/verwaltung.css', '')}",
            "verw_js": f"assets/verwaltung.js?v={kennung.get('assets/verwaltung.js', '')}",
        }

        html = platzhalter(einbinden(rumpf), werte)
        html = html.replace(
            "<!--#warnung-->",
            "<!-- " + WARNUNG.format(quelle=f"src/pages/{seite.name}") + " -->",
        )
        # Leerzeilen-Haufen aus weggefallenen Bausteinen zusammenziehen
        html = re.sub(r"\n{3,}", "\n\n", html)

        ziel = SITE / seite.name
        ziel.write_text(html, encoding="utf-8")
        gebaut.append(seite.name)

    print("gebaut:")
    for name in gebaut:
        print(f"  site/{name}")
    for name, k in sorted(kennung.items()):
        print(f"  site/{name}  ?v={k}")


if __name__ == "__main__":
    bauen()
