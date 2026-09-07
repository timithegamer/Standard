#!/usr/bin/env python3
"""Baut aus dem Website-Ordner eine einzelne HTML-Datei fuer die Vorschau.
Bilder, Schriften, CSS und JS werden eingebettet - die Seite laedt dann
nichts mehr von aussen nach."""
import base64, mimetypes, pathlib, re

SITE = pathlib.Path("site")
ZIEL = pathlib.Path("vorschau/tcm-grohe.html")
ZIEL.parent.mkdir(exist_ok=True)

def datauri(pfad: pathlib.Path) -> str:
    typ = mimetypes.guess_type(pfad.name)[0] or "application/octet-stream"
    if pfad.suffix == ".woff2":
        typ = "font/woff2"
    return f"data:{typ};base64,{base64.b64encode(pfad.read_bytes()).decode()}"

html = (SITE / "index.html").read_text()

# --- Schriften: woff2-Dateien in die fonts.css einbetten
fonts = (SITE / "assets/fonts.css").read_text()
fonts = re.sub(r"url\('fonts/([^']+)'\)",
               lambda m: f"url('{datauri(SITE / 'assets/fonts' / m.group(1))}')",
               fonts)

css = (SITE / "assets/style.css").read_text()
js  = (SITE / "assets/app.js").read_text()

# --- Stylesheet-Verweise durch die echten Regeln ersetzen
html = re.sub(r'<link rel="stylesheet" href="assets/fonts\.css(?:\?v=[0-9a-f]+)?">',
              lambda m: f"<style>\n{fonts}\n</style>", html)
html = re.sub(r'<link rel="stylesheet" href="assets/style\.css(?:\?v=[0-9a-f]+)?">',
              lambda m: f"<style>\n{css}\n</style>", html)

# --- Termine als Reserve einbetten: in der Einzeldatei gibt es kein
#     termine.json zum Nachladen.
termine = (SITE / "termine.json").read_text()
html = re.sub(r'<script src="assets/app\.js(?:\?v=[0-9a-f]+)?"></script>',
              lambda m: ('<script type="application/json" id="termine-fallback">'
                         + termine + '</script>\n<script>\n' + js + '\n</script>'), html)

# --- Bilder einbetten
def bild(m):
    quelle = m.group(1)
    pfad = SITE / quelle
    return f'src="{datauri(pfad)}"' if pfad.is_file() else m.group(0)

html = re.sub(r'src="(img/[^"]+)"', bild, html)

# --- Impressum und Datenschutz mit in die Einzeldatei nehmen,
#     damit die Verweise auch in der Vorschau funktionieren.
unterseiten = ""
for name, kennung in (("impressum", "seite-impressum"), ("datenschutz", "seite-datenschutz")):
    quelle = (SITE / f"{name}.html").read_text()
    inhalt = quelle[quelle.index("<main"):quelle.index("</main>") + 7]
    inhalt = inhalt.replace('href="index.html"', 'href="#top"')
    inhalt = re.sub(r'href="(impressum|datenschutz)\.html"',
                    lambda m: f'href="#seite-{m.group(1)}"', inhalt)
    unterseiten += f'<div class="unterseite" id="{kennung}" hidden>{inhalt}</div>\n'

html = html.replace("</main>", "</main>\n" + unterseiten, 1)
html = re.sub(r'href="(impressum|datenschutz)\.html"',
              lambda m: f'href="#seite-{m.group(1)}"', html)

# Kleiner Umschalter: eine Datei, drei Seiten.
html = html.replace("</body>", """<script>
(function () {
  function zeigen() {
    const ziel = document.getElementById(location.hash.slice(1));
    const istUnterseite = !!(ziel && ziel.classList.contains("unterseite"));
    document.getElementById("inhalt").hidden = istUnterseite;
    document.querySelectorAll(".unterseite").forEach(u => { u.hidden = u !== ziel; });
    if (istUnterseite) window.scrollTo(0, 0);
  }
  addEventListener("hashchange", zeigen);
  zeigen();
})();
</script>
</body>""")

ZIEL.write_text(html)
kb = ZIEL.stat().st_size // 1024
uebrig = re.findall(r'(?:src|href)="(?!#|data:|tel:|mailto:|https://)[^"]+"', html)
print(f"{ZIEL}  {kb} KB")
print("Noch externe/relative Verweise:", uebrig or "keine")
