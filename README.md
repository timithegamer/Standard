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
  verwaltung.html     erzeugt (interner Bereich, passwortgeschützt)
  assets/verwaltung.* erzeugt (nur für den internen Bereich)
  termine.json        Reserveliste der Termine
  freie-termine.json  Reserveliste der freien Behandlungstermine
  netlify/functions/  plaetze.mjs (öffentlich) und verwaltung.mjs (intern)
src/verwaltung/       Quellen des internen Bereichs
zugang-einrichten.py  Erzeugt Passwort-Hash und Sitzungsschlüssel
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

## Wo die Termine herkommen

`site/netlify/functions/plaetze.mjs` beantwortet `/api/plaetze` und probiert
drei Quellen der Reihe nach:

1. **Blob-Speicher** – was im Verwaltungsbereich eingetragen wurde.
2. **Google-Tabelle** – die frühere Pflege, bleibt als Rückfall bestehen.
3. Antwortet die Funktion gar nicht, nimmt die Website `termine.json`.

Es gibt also drei Ebenen, bevor die Terminliste leer wäre. Der Browser der
Besucherin nimmt dabei nie selbst Kontakt zu Google auf – das hält die
Datenschutzerklärung schlank.

## Verwaltungsbereich

Unter `/verwaltung.html` liegt ein passwortgeschützter Bereich, über den
Sabine Workshops und Kuren pflegt. Die Daten liegen in **Netlify Blobs**,
nicht im Git-Verzeichnis. Das ist der entscheidende Punkt: Eine
Terminänderung löst damit **keinen Deploy aus** und kostet keine Credits.

### Einrichten

```bash
python3 zugang-einrichten.py
```

Das Skript fragt nach einem Passwort und gibt zwei Werte aus. Beide bei
Netlify unter *Site configuration → Environment variables* eintragen:

| Variable | Inhalt |
|---|---|
| `VERWALTUNG_PASSWORT` | scrypt-Hash des Passworts |
| `VERWALTUNG_GEHEIMNIS` | Zufallswert, mit dem die Sitzung unterschrieben wird |

Danach einmal neu veröffentlichen, damit die Funktionen die Variablen
sehen. Das Klartextpasswort wird nirgends gespeichert – auch nicht bei
Netlify. Geht es verloren, erzeugt man einfach einen neuen Hash.

**Ohne diese beiden Variablen verweigert der Bereich jede Anfrage** und
antwortet mit 503. Er fällt zu, nicht auf.

### Wie er geschützt ist

Auf einer statischen Seite lässt sich nichts absichern, was im Browser
entschieden wird – ein Passwort im JavaScript könnte jeder im Quelltext
lesen. Deshalb sitzt der ganze Schutz in `verwaltung.mjs`:

- **Passwort** als scrypt-Hash, verglichen in konstanter Zeit.
- **Sitzung** als HMAC-signiertes Merkmal in einem Cookie mit `HttpOnly`,
  `Secure` und `SameSite=Strict`. Das JavaScript der Seite kommt nicht daran.
- **Fehlversuche** werden gezählt; nach fünf ist die Adresse fünfzehn
  Minuten gesperrt, danach länger. Gespeichert wird nur ein Hash der IP.
- **Fremde Seiten** können keine Änderung auslösen: Jede schreibende
  Anfrage braucht die Kopfzeile `x-verwaltung`, die aus fremder Herkunft
  eine Vorabfrage erzwingt, welche der Server nicht beantwortet.
- **Alle Eingaben** werden serverseitig geprüft: Längen, Datumswerte,
  erlaubte Elemente. Buchungsadressen müssen mit `https://` beginnen –
  sonst ließe sich über dieses Feld ein `javascript:`-Verweis in die
  öffentliche Seite schreiben.

### Lokal ausprobieren

`dev-server.py` bildet beide Funktionen nach, samt Anmeldung. Die Termine
landen dabei in `.arbeit/` statt im Blob-Speicher:

```bash
export VERWALTUNG_PASSWORT='scrypt$...'
export VERWALTUNG_GEHEIMNIS='...'
python3 build.py && python3 dev-server.py
```

Bei jeder Änderung an den Funktionen muss `dev-server.py` mitgezogen
werden – sonst testet man etwas anderes, als später läuft.

## Keine fremden Bibliotheken im Browser

Die Datenschutzerklärung sagt zu, dass diese Seite nichts von fremden Servern
nachlädt — weder Schriften noch Skripte. Deshalb liegt auch der Code für
Bewegung und Interaktion (rund 18 KB gepackt) im Projekt und kommt nicht von
einem CDN. Wer hier eine Bibliothek einbindet, muss die Datenschutzerklärung
mit ändern.

Eine einzige npm-Abhängigkeit gibt es trotzdem: `@netlify/blobs`. Sie läuft
ausschließlich in den Serverfunktionen und wird nie an den Browser
ausgeliefert. Netlify installiert sie beim Deploy selbst; lokal braucht man
sie nicht, weil `dev-server.py` den Speicher durch eine Datei ersetzt.

## Vorschau als Einzeldatei

```bash
python3 build.py && python3 build-vorschau.py
```

Legt `vorschau/tcm-grohe.html` an: eine einzige Datei mit eingebetteten
Bildern, Schriften, CSS und JS. Praktisch zum Herumschicken.

Für den Verwaltungsbereich gibt es dasselbe:

```bash
python3 build.py && python3 build-portal-vorschau.py
```

Legt `vorschau/verwaltung-vorschau.html` an — die Oberfläche mit einem
nachgestellten Server, damit sich die Bedienung ohne Deploy beurteilen
lässt. **Das ist kein echter Zugang:** Die Anmeldung nimmt jedes Passwort
an, es wird nichts gespeichert, es gibt keinen Schutz. Der nachgestellte
Server steht ausschließlich in diesem Skript; in `site/` und `src/` landet
davon nichts.

## Barrierefreiheit und Bewegung

Die Seite prüft `prefers-reduced-motion`. Ist weniger Bewegung eingestellt,
entfallen Vorhang, Parallaxe, weiches Scrollen und der eigene Mauszeiger —
der Inhalt bleibt vollständig. Ohne JavaScript ist ebenfalls alles lesbar:
Die Aufklapper stehen dann offen, nichts ist versteckt.
