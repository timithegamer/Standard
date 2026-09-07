# tcm-grohe.at

Website der TCM-Praxis von Sabine Grohe in Pinsdorf, Oberösterreich.

Statische Seite. Kein Baukasten, keine Datenbank, kein npm, kein Bundler.
Am Ende stehen HTML-, CSS- und JS-Dateien in `site/`, die auf jedem Hosting
laufen.

## Ordner

```
build.py              Baut site/ aus src/
src/
  layout/             Das Dokumentgerüst
  pages/              Eine Datei je Seite (Kopfdaten + Inhalt)
  partials/           Bausteine: Hero, Leistungen, Fuss, …
  css/                Wird der Reihe nach zu site/assets/style.css
  js/                 Wird der Reihe nach zu site/assets/app.js
site/                 Was hochgeladen wird
  index.html          erzeugt
  impressum.html      erzeugt
  datenschutz.html    erzeugt
  danke.html          erzeugt
  404.html            erzeugt
  assets/style.css    erzeugt
  assets/app.js       erzeugt
  assets/fonts.css    Schriften, selbst gehostet
  assets/fonts/       8 woff2-Dateien (204 KB)
  assets/mark.svg     Das „G“ als Logodatei und Favicon
  img/web/            Bilder, fürs Web verkleinert
  termine.json        Reserveliste der Termine
  freie-termine.json  Reserveliste der freien Behandlungstermine
  netlify/functions/  Serverfunktion für die Termintabelle
TERMINE-PFLEGEN.md    Anleitung für Sabine
RECHTLICHES-OFFEN.md  Interner Stand, gehört nicht ins Netz
```

**Wichtig:** `site/*.html`, `site/assets/style.css` und `site/assets/app.js`
sind **erzeugte Dateien**. Wer sie direkt bearbeitet, verliert die Änderung
beim nächsten Bauen. Bearbeitet wird immer `src/`.

Alles, was in `site/` liegt, ist später über das Netz erreichbar. Interne
Notizen gehören deshalb in den Hauptordner, nicht dorthin.

## Bauen

```bash
python3 build.py
```

Danach stehen die fertigen Dateien in `site/`. Der Bauschritt hängt an
`style.css` und `app.js` eine Kennung aus dem Dateiinhalt an (`?v=…`), damit
Browser nach einer Änderung nicht die alte Fassung aus dem Zwischenspeicher
zeigen.

Netlify baut **nicht** selbst — `netlify.toml` lädt einfach `site/` hoch.
Das heisst: **vor dem Hochladen bauen.** Sonst geht der alte Stand online.

## Lokal ansehen

```bash
python3 build.py && python3 dev-server.py
```

Dann `http://127.0.0.1:8783` öffnen. Der Entwicklungsserver bildet die
Netlify-Funktion nach, es funktioniert also auch die Termintabelle — mit den
echten Daten aus der Google-Tabelle.

Direkt per Doppelklick auf `index.html` funktioniert **nicht**: Der Browser
darf dann weder `termine.json` noch die Funktion laden.

### Warum lokal entwickeln wichtig ist

Netlify rechnet in Credits: **300 im Monat, ein Produktions-Deploy kostet 15.**
Das sind zwanzig Deploys, danach wird die Seite bis zum nächsten Monat
**pausiert** — also offline genommen. Im Gratis-Tarif lässt sich nicht
nachkaufen.

Deshalb: Änderungen lokal sammeln, dann **einmal** hochladen.

Der laufende Betrieb kostet dagegen kaum etwas: Sabines Terminänderungen
gehen über die Google-Tabelle und lösen **keinen** Deploy aus.

## Die Termintabelle geht über Netlify

In `site/netlify/functions/plaetze.mjs` liegt eine kleine Serverfunktion. Sie
holt die veröffentlichte Google-Tabelle und reicht sie an die Website weiter.
Der Grund: So nimmt der Browser der Besucherin **keinen Kontakt zu Google
auf**. Das hält die Datenschutzerklärung schlank.

Fehlt die Funktion, fällt die Website automatisch auf `termine.json` zurück
und funktioniert normal weiter.

## Keine fremden Bibliotheken

Die Datenschutzerklärung sagt zu, dass diese Seite nichts von fremden Servern
nachlädt — weder Schriften noch Skripte. Deshalb liegt auch der Code für
Bewegung und Interaktion (rund 18 KB gepackt) im Projekt und kommt nicht von
einem CDN. Wer hier eine Bibliothek einbindet, muss die Datenschutzerklärung
mit ändern.

## Vorschau als Einzeldatei

```bash
python3 build.py && python3 build-vorschau.py
```

Legt `vorschau/tcm-grohe.html` an: eine einzige Datei mit eingebetteten
Bildern, Schriften, CSS und JS. Praktisch zum Herumschicken.

## Barrierefreiheit und Bewegung

Die Seite prüft `prefers-reduced-motion`. Ist weniger Bewegung eingestellt,
entfallen Vorhang, Parallaxe, weiches Scrollen und der eigene Mauszeiger —
der Inhalt bleibt vollständig. Ohne JavaScript ist ebenfalls alles lesbar:
Die Aufklapper stehen dann offen, nichts ist versteckt.
