# tcm-grohe.at — neue Website

Statische Website. Kein Baukasten, keine Datenbank, kein PHP – nur Dateien.
Läuft auf jedem Hosting, auch auf kostenlosen.

## Was drin ist

```
index.html            Die ganze Website (eine scrollende Seite mit Sprungmarken)
impressum.html        ← enthält noch Lücken, siehe unten
datenschutz.html      ← enthält noch Lücken, siehe unten
termine.json          Reserveliste der Termine
TERMINE-PFLEGEN.md    Anleitung für Sabine
assets/style.css      Gestaltung
assets/app.js         Lädt und sortiert die Termine
assets/fonts.css      Schriften, selbst gehostet
assets/fonts/         8 woff2-Dateien (176 KB)
assets/mark.svg       Das „G" als skalierbare Logodatei
img/web/              Die Bilder, fürs Web verkleinert (1,3 MB)
img/                  Die Originale, falls du größere Zuschnitte brauchst
```

## Lokal ansehen und weiterentwickeln

```bash
python3 dev-server.py
```

Dann http://127.0.0.1:8783 öffnen. Der Entwicklungsserver bildet die
Netlify-Funktion nach, es funktioniert also auch die Termintabelle –
mit den echten Daten aus der Google-Tabelle.

Direkt per Doppelklick auf `index.html` funktioniert **nicht** – der
Browser darf dann weder `termine.json` noch die Funktion laden.

### Warum lokal entwickeln wichtig ist

Netlify rechnet in Credits: **300 im Monat, ein Produktions-Deploy kostet 15.**
Das sind zwanzig Deploys, danach wird die Seite bis zum nächsten Monat
**pausiert** – also offline genommen. Im Gratis-Tarif lässt sich nicht
nachkaufen.

Deshalb: Änderungen lokal entwickeln und sammeln, dann **einmal** hochladen.
Während der Bauphase am besten in Netlify unter *Site configuration →
Build & deploy → Continuous deployment* die automatischen Builds anhalten;
dann kostet auch das Hochladen nach GitHub nichts.

Der laufende Betrieb kostet dagegen kaum etwas: Sabines Terminänderungen
gehen über die Google-Tabelle und lösen **keinen** Deploy aus.

## Die Termintabelle geht über Netlify

Im Ordner `netlify/functions/plaetze.mjs` liegt eine kleine Serverfunktion.
Sie holt die veröffentlichte Google-Tabelle und reicht sie an die Website
weiter. Der Grund: So nimmt der Browser der Besucherin **keinen Kontakt zu
Google auf**. Das hält die Datenschutzerklärung schlank.

Auf Netlify läuft das ohne Zutun; `netlify.toml` im Hauptordner ist schon
eingerichtet. Fehlt die Funktion, fällt die Website automatisch auf
`termine.json` zurück und funktioniert normal weiter.

Freie Plätze bei Workshops trägt Sabine von Hand in die Tabelle ein
(Spalte **Plätze**). Es wird nirgends automatisch nachgefragt.

## Veröffentlichen

Empfehlung: **Netlify**. Kostenlos, HTTPS inklusive, eigene Domain möglich.

1. Auf netlify.com anmelden
2. Den Ordner `site/` auf die Fläche „Deploy manually" ziehen
3. Die Seite ist sofort unter einer Testadresse erreichbar
4. Unter *Domain settings* die eigene Domain hinzufügen

Alternativen mit demselben Ergebnis: Cloudflare Pages, GitHub Pages,
oder jedes klassische Webhosting per FTP.

### Die Domain tcm-grohe.at umziehen

Die Domain liegt aktuell vermutlich bei Jimdo. Zwei Wege:

- **Umziehen:** Bei Jimdo den Auth-Code anfordern und die Domain zum neuen
  Anbieter transferieren. Sauberste Lösung.
- **Nur umbiegen:** Domain bei Jimdo lassen und die DNS-Einträge auf den
  neuen Hoster zeigen lassen. Geht schneller, du bleibst aber Jimdo-Kunde.

> **Vorher prüfen:** Hängt an der Domain eine E-Mail-Adresse? Falls ja,
> darf die beim Umzug nicht abreißen. Die bekannte Adresse
> `sabine.grohe@live.at` läuft über Microsoft und ist davon nicht betroffen.

> **Jimdo erst kündigen, wenn die neue Seite live ist** – und den alten
> Auftritt vorher sichern.

## Noch zu erledigen

**Rechtstexte sind vollständig.** Impressum nach § 5 ECG, Datenschutz mit
meetergo und Netlify als Auftragsverarbeiter. Keine offenen Platzhalter mehr.

**Noch zu besorgen (liegt außerhalb der Website):**

- Auftragsverarbeitungsvertrag mit meetergo und mit Netlify
- Verarbeitungsverzeichnis nach Art. 30 DSGVO (wegen der Gesundheitsdaten
  in der Behandlung auch für Kleinstunternehmen Pflicht)
- `freie-termine.json` wird derzeit **nicht angezeigt**: Solange in
  `assets/app.js` unter `CAL_TERMINE` meetergo-Adressen eingetragen sind,
  läuft die Buchung über meetergo. `freie-termine.json` ist die Rückfallebene,
  falls meetergo einmal wegfällt – dann `CAL_TERMINE` auf `[]` setzen.

**Fehlende Fotos:**

- Ein **Porträt von Sabine in der neuen Praxis**. Aktuell läuft noch das
  alte Bild aus dem Jimdo-Auftritt.
- Eine **Kochworkshop-Situation** (Tisch, Zutaten, Hände beim Schneiden).

## Kleinigkeiten

Die Seite benutzt kein Cookie-Banner, weil sie keine Cookies setzt und
nichts von fremden Servern lädt. Falls später doch etwas dazukommt
(eingebettete Karte, Statistiktool, Google Fonts), braucht sie eines –
und die Datenschutzerklärung muss angepasst werden.
