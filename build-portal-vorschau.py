#!/usr/bin/env python3
"""Baut eine Einzeldatei-Vorschau des Verwaltungsbereichs.

    python3 build.py && python3 build-portal-vorschau.py

Ergebnis: vorschau/verwaltung-vorschau.html - eine Datei zum Anschauen
der Oberflaeche, ohne Server.

WICHTIG: Das ist ausdruecklich KEIN echter Verwaltungsbereich. Die
Anmeldung ist nachgestellt, es wird nichts gespeichert, und es gibt
keinerlei Schutz. Der Sinn ist einzig, die Bedienung zu beurteilen,
bevor irgendetwas veroeffentlicht wird.

Der nachgestellte Server steht nur in dieser Datei. In site/ und in
src/ landet davon nichts - die ausgelieferte Seite enthaelt keinen
solchen Code.
"""

import base64
import mimetypes
import pathlib
import re

SITE = pathlib.Path("site")
ZIEL = pathlib.Path("vorschau/verwaltung-vorschau.html")
ZIEL.parent.mkdir(exist_ok=True)


def datauri(pfad: pathlib.Path) -> str:
    typ = mimetypes.guess_type(pfad.name)[0] or "application/octet-stream"
    if pfad.suffix == ".woff2":
        typ = "font/woff2"
    return f"data:{typ};base64,{base64.b64encode(pfad.read_bytes()).decode()}"


html = (SITE / "verwaltung.html").read_text(encoding="utf-8")

# --- Schriften einbetten ---
fonts = (SITE / "assets/fonts.css").read_text(encoding="utf-8")
fonts = re.sub(r"url\('fonts/([^']+)'\)",
               lambda m: f"url('{datauri(SITE / 'assets/fonts' / m.group(1))}')",
               fonts)

stil = (SITE / "assets/style.css").read_text(encoding="utf-8")
vstil = (SITE / "assets/verwaltung.css").read_text(encoding="utf-8")
vjs = (SITE / "assets/verwaltung.js").read_text(encoding="utf-8")

html = re.sub(r'<link rel="stylesheet" href="assets/fonts\.css(?:\?v=[0-9a-f]+)?">',
              lambda m: f"<style>\n{fonts}\n</style>", html)
html = re.sub(r'<link rel="stylesheet" href="assets/style\.css(?:\?v=[0-9a-f]+)?">',
              lambda m: f"<style>\n{stil}\n</style>", html)
html = re.sub(r'<link rel="stylesheet" href="assets/verwaltung\.css(?:\?v=[0-9a-f]+)?">',
              lambda m: f"<style>\n{vstil}\n</style>", html)
html = re.sub(r'<link rel="icon"[^>]*>\s*', "", html)

# --- Der nachgestellte Server ---
# Er faengt genau die Adressen ab, die sonst an die Netlify-Funktion
# gingen, und antwortet aus dem Arbeitsspeicher. Sobald die Seite neu
# geladen wird, ist alles wieder wie am Anfang.
STUB = r"""
<script>
(function () {
  var BEISPIEL = [
    { datum: "2026-09-25", enddatum: "", zeit: "15:00", art: "Kochworkshop",
      element: "metall", titel: "Herbst und das Metall-Element – rund um Lunge & Immunsystem",
      text: "Im Herbst stärkt das Metall-Element unsere Abwehrkraft. Die Lunge spielt eine zentrale Rolle für Immunsystem, Haut und Atemwege.",
      preis: "135 €", ort: "Pinsdorf", leistungen: "", buchung: "", plaetze: "frei" },
    { datum: "2026-11-06", enddatum: "", zeit: "15:00", art: "Kochworkshop",
      element: "", titel: "Hausmittel nach der TCM",
      text: "Bewährte Hausmittel aus der Traditionellen Chinesischen Medizin für den Alltag.",
      preis: "135 €", ort: "Pinsdorf", leistungen: "", buchung: "", plaetze: "3" },
    { datum: "2026-11-20", enddatum: "", zeit: "15:00", art: "Kochworkshop",
      element: "wasser", titel: "Winter und das Wasser-Element – rund um die Nieren",
      text: "Der Winter gehört zum Wasser-Element und den Nieren – unserer Kraftquelle für Regeneration, Vitalität und innere Stabilität.",
      preis: "135 €", ort: "Pinsdorf", leistungen: "", buchung: "", plaetze: "" },
    { datum: "", enddatum: "", zeit: "", art: "Kur", element: "",
      titel: "Frühlingskur",
      text: "Entwurf – wird angezeigt, sobald ein Datum eingetragen ist.",
      preis: "", ort: "", leistungen: "Privatzimmer mit Bad · Verpflegung · 3× Tuina Massage",
      buchung: "", plaetze: "" }
  ];

  var angemeldet = false;
  var termine = JSON.parse(JSON.stringify(BEISPIEL));
  var stand = Date.now() - 3600e3;

  function antwort(daten, status) {
    return Promise.resolve(new Response(JSON.stringify(daten), {
      status: status || 200,
      headers: { "content-type": "application/json" }
    }));
  }

  var echtesFetch = window.fetch.bind(window);
  window.fetch = function (adresse, einstellungen) {
    var pfad = String(adresse || "");
    if (pfad.indexOf("/api/verwaltung/") !== 0) return echtesFetch(adresse, einstellungen);

    var was = pfad.replace("/api/verwaltung/", "");
    var art = ((einstellungen || {}).method || "GET").toUpperCase();
    var koerper = {};
    try { koerper = JSON.parse((einstellungen || {}).body || "{}"); } catch (e) {}

    // Etwas Verzögerung, damit sich die Bedienung echt anfühlt.
    return new Promise(function (fertig) {
      setTimeout(function () {
        if (was === "status") return fertig(antwort({ angemeldet: angemeldet, eingerichtet: true }));

        if (was === "anmeldung" && art === "POST") {
          if (!koerper.passwort) return fertig(antwort({ fehler: "Bitte das Passwort eingeben." }, 401));
          angemeldet = true;
          return fertig(antwort({ angemeldet: true }));
        }
        if (was === "abmeldung") { angemeldet = false; return fertig(antwort({ angemeldet: false })); }
        if (!angemeldet) return fertig(antwort({ fehler: "Nicht angemeldet.", angemeldet: false }, 401));

        if (was === "termine" && art === "GET") {
          return fertig(antwort({ termine: JSON.parse(JSON.stringify(termine)), stand: stand, benutzt: true }));
        }
        if (was === "termine" && art === "PUT") {
          var liste = koerper.termine || [];
          for (var i = 0; i < liste.length; i++) {
            if (!String(liste[i].titel || "").trim()) {
              return fertig(antwort({ fehler: "Eintrag " + (i + 1) + " braucht einen Titel." }, 400));
            }
          }
          termine = JSON.parse(JSON.stringify(liste));
          stand = Date.now();
          return fertig(antwort({ gespeichert: true, stand: stand, anzahl: termine.length }));
        }
        if (was === "tabelle") {
          return fertig(antwort({ termine: JSON.parse(JSON.stringify(BEISPIEL)), quelle: "tabelle" }));
        }
        return fertig(antwort({ fehler: "Unbekannte Anfrage." }, 404));
      }, 260);
    });
  };

  // Ein Band, das nicht zu übersehen ist.
  document.addEventListener("DOMContentLoaded", function () {
    var band = document.createElement("div");
    band.setAttribute("role", "note");
    band.style.cssText = "position:sticky;top:0;z-index:99;background:#A8483C;color:#fff;"
      + "padding:.7rem 1rem;font:600 .875rem/1.45 Karla,system-ui,sans-serif;text-align:center";
    band.textContent = "Vorschau ohne Server — Anmeldung und Speichern sind hier nur nachgestellt. "
      + "Jedes Passwort wird angenommen, nichts wird gespeichert, es gibt keinen Schutz. "
      + "Nur zum Beurteilen der Bedienung.";
    document.body.insertBefore(band, document.body.firstChild);
  });
})();
</script>
"""

html = html.replace('<script src="assets/verwaltung.js', STUB + '<script src="assets/verwaltung.js')
html = re.sub(r'<script src="assets/verwaltung\.js(?:\?v=[0-9a-f]+)?"></script>',
              lambda m: f"<script>\n{vjs}\n</script>", html)

html = html.replace("<title>", "<!-- Vorschau ohne Server. Nicht veroeffentlichen. -->\n<title>", 1)

ZIEL.write_text(html, encoding="utf-8")
kb = ZIEL.stat().st_size // 1024
print(f"{ZIEL}  {kb} KB")

uebrig = re.findall(r'(?:src|href)="(?!#|data:|tel:|mailto:|https://)[^"]+"', html)
print("Noch externe/relative Verweise:", uebrig or "keine")
