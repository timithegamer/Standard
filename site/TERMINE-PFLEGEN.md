# Termine pflegen

> **Behandlungstermine laufen über meetergo** – dort trägt Sabine ihre
> Arbeitszeiten ein, den Rest macht der Kalender allein. Diese Anleitung
> hier betrifft nur die **Workshops und Kuren**.

Für Sabine. Du brauchst dafür kein Programm und keine Website-Kenntnisse –
nur eine Google-Tabelle, die du wie jede andere Tabelle bearbeitest.

## Wie es funktioniert

Du trägst Termine in **eine einzige Tabelle** ein. Die Website liest diese
Tabelle bei jedem Besuch neu.

Das heißt:

- **Vorbei ist weg.** Ein Termin verschwindet von selbst, sobald sein Datum
  vorüber ist. Du musst nie etwas löschen.
- **Reihenfolge stimmt immer.** Die Website sortiert nach Datum, egal in
  welcher Reihenfolge du eintippst.
- **Änderungen sind sofort da.** Speichern passiert in Google Tabellen
  automatisch; auf der Website ist es nach ein paar Minuten sichtbar.

---

## Die Einrichtung ist erledigt

Die Tabelle ist angelegt, veröffentlicht und mit der Website verbunden.
Du musst ab jetzt nur noch tippen – der Rest passiert von selbst.

Kleiner Hinweis: Google gibt die veröffentlichte Tabelle ein paar Minuten
lang zwischengespeichert heraus. Änderungen sind also nicht in derselben
Sekunde online, aber innerhalb weniger Minuten.

<details>
<summary>Wie es eingerichtet wurde (nur zum Nachschlagen)</summary>

### 1. Tabelle anlegen

Neue Google-Tabelle erstellen. In die **erste Zeile** kommen genau diese
Spaltenüberschriften:

| Datum | Enddatum | Uhrzeit | Art | Element | Titel | Beschreibung | Preis | Ort | Leistungen | Buchung | Plätze |
|-------|----------|---------|-----|---------|-------|--------------|-------|-----|------------|---------|--------|

### 2. Tabelle veröffentlichen

In der Tabelle: **Datei → Freigeben → Im Web veröffentlichen**

- Links: das Tabellenblatt auswählen
- Rechts: **Kommagetrennte Werte (.csv)** auswählen
- Auf **Veröffentlichen** klicken
- Die angezeigte Adresse kopieren

> Wichtig: „Im Web veröffentlichen" macht nur diese eine Tabelle öffentlich
> lesbar. Das ist beabsichtigt – die Termine sollen ja jeder sehen können.
> Schreib nichts Privates hinein.

### 3. Adresse eintragen

In der Datei `assets/app.js`, ganz oben, die kopierte Adresse einsetzen:

```js
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv";
```

</details>

---

## Eine Zeile ausfüllen

Nur **Datum** und **Titel** sind Pflicht. Alles andere darf leer bleiben –
was leer ist, wird auf der Website einfach weggelassen.

**Datum** — `25.09.2026`. Das Datum, an dem der Termin stattfindet.

**Enddatum** — nur bei mehrtägigen Sachen wie einer Kur (`17.10.2026`).
Bei einem eintägigen Workshop leer lassen. Ein mehrtägiger Termin bleibt bis
zum Enddatum sichtbar.

**Uhrzeit** — `15:00`. Erscheint als „ab 15:00 Uhr".

**Art** — `Kochworkshop` oder `Kur`. Du kannst auch etwas Neues schreiben,
zum Beispiel `Vortrag`. Sobald es zwei verschiedene Arten gibt, erscheinen
auf der Website automatisch Filterknöpfe.

**Element** — eines von: `holz`, `feuer`, `erde`, `metall`, `wasser`
(klein geschrieben). Bestimmt die Farbe des Strichs neben dem Datum und den
Zusatz „Metall-Element · Herbst". Passt kein Element, leer lassen.

**Titel** — die Überschrift, z. B. `Winter und das Wasser-Element – rund um die Nieren`.

**Beschreibung** — der erklärende Absatz darunter.

**Preis** — `135 €`.

**Ort** — `Pinsdorf`, `Hochkrimml`, …

**Leistungen** — nur bei Kuren sinnvoll, für die Aufzählung, was inkludiert
ist. Mit `·` trennen: `Privatzimmer mit Bad · Verpflegung · 3× Tuina Massage`

**Buchung** — **bitte leer lassen.** Workshops und Kuren werden nicht online
gebucht. Der Knopf auf der Website heißt dann **„Anmelden"** und füllt das
Kontaktformular schon mit dem richtigen Termin aus. Wer lieber anruft, ruft an.

**Plätze** — hier darf entweder eine **Zahl** stehen oder ein Wort.

- Eine Zahl, zum Beispiel `6`, wird zu **„6 freie Plätze"**. Bei `1` steht
  „1 freier Platz", bei `0` steht „Ausgebucht". Drei oder weniger färbt das
  Schildchen dringlicher ein.
- Sonst gehen `frei`, `wenige` oder `ausgebucht`.
- Leer lassen, wenn du nichts dazu sagen willst — dann erscheint kein
  Schildchen.

> Diese Angabe pflegst du **selbst**. Die Website fragt nirgends nach und
> rechnet nichts aus – es steht genau das da, was du hineinschreibst.
> Änderst du es in der Tabelle, steht es beim nächsten Aufruf auf der Seite.

---

## Beispielzeile

| | |
|---|---|
| Datum | `20.11.2026` |
| Enddatum | *(leer)* |
| Uhrzeit | `15:00` |
| Art | `Kochworkshop` |
| Element | `wasser` |
| Titel | `Winter und das Wasser-Element – rund um die Nieren` |
| Beschreibung | `Der Winter gehört zum Wasser-Element und den Nieren …` |
| Preis | `135 €` |
| Ort | `Pinsdorf` |
| Leistungen | *(leer)* |
| Plätze | `frei` |

---

## Häufige Fragen

**Ich habe einen Termin eingetragen, er erscheint aber nicht.**
Drei Möglichkeiten: Das Datum liegt in der Vergangenheit. Oder das
Datumsfeld ist leer oder falsch geschrieben – es muss `25.09.2026` heißen.
Oder die Seite zeigt noch die alte Fassung: einmal mit `Strg`+`Shift`+`R`
(Mac: `Cmd`+`Shift`+`R`) neu laden.

**Kann ich einen Termin absagen?**
Zeile löschen. Oder bei **Plätze** `ausgebucht` eintragen, wenn er sichtbar
bleiben soll.

**Kann ich einen Termin schon vorbereiten, ohne dass er erscheint?**
Ja – schreib eine Zeile ohne Datum. Ohne Datum wird sie nicht angezeigt.
Sobald du das Datum einträgst, ist sie live.

So liegt gerade die **Frühlingskur** bereit: Die Zeile steht schon da, mit
den Leistungen aus der Herbstkur, aber ohne Datum. Sie erscheint in dem
Moment auf der Website, in dem Datum und Enddatum eingetragen sind. Text und
Preis vorher noch anpassen – im Beschreibungsfeld steht bisher „ENTWURF".

**Was passiert, wenn die Tabelle mal nicht erreichbar ist?**
Dann zeigt die Website die Termine aus der Reservedatei `termine.json`, die
mit auf dem Server liegt. Es steht also nie eine leere Seite da.

**Was, wenn gar kein Termin mehr in der Zukunft liegt?**
Dann steht dort automatisch „Zurzeit sind keine Termine ausgeschrieben"
mit einem Link, damit sich Interessierte trotzdem melden können.

---

# Behandlungstermine (meetergo)

## Der Grundsatz

**Was in Sabines Kalender steht, kann online nicht mehr gebucht werden.**

meetergo schaut vor jeder Anfrage in den verbundenen Apple-Kalender. Ist die
Zeit dort belegt, verschwindet sie von der Website. Sabine muss also nichts
zusätzlich pflegen — sie trägt Termine so ein wie immer.

## Wenn jemand anruft oder in der Praxis einen Termin ausmacht

**Den Termin sofort in den Kalender am iPhone eintragen.** Am besten noch
während des Telefonats. Mehr ist nicht nötig — der Platz ist danach online weg.

Drei Dinge, an denen es scheitern kann:

1. **Der richtige Kalender.** Der Termin muss in den Kalender, den meetergo
   prüft. Wer mehrere hat (Privat, Arbeit, Familie), trägt entweder immer in
   denselben ein oder verbindet alle. Nachsehen unter
   *Settings → Calendars*: dort muss beim betreffenden Kalender die Prüfung
   auf Terminüberschneidungen eingeschaltet sein.

2. **Nicht sofort, aber schnell.** Der Abgleich mit dem Apple-Kalender
   passiert nicht in derselben Sekunde, sondern innerhalb weniger Minuten.
   Deshalb: gleich eintragen, nicht am Abend.

3. **Der Termin muss als „belegt“ gelten.** Ganztägige Notizen oder Einträge,
   die als „frei“ markiert sind, blockieren nichts.

## Die Alternative: selbst über die Buchungsseite eintragen

Statt in den Kalender kann Sabine den Termin auch über ihre eigene
Buchungsseite eintragen, mit dem Namen der Kundin:

- https://cal.meetergo.com/sabinegrohe/tuina-massage
- https://cal.meetergo.com/sabinegrohe/tcm-beratung

Vorteil: Die Kundin bekommt automatisch eine Bestätigung und eine Erinnerung,
und alle Termine liegen an einer Stelle. Nachteil: ein paar Klicks mehr als
ein Eintrag im Kalender.

Für Stammkundinnen, die ohnehin am Telefon buchen, ist der Kalendereintrag
schneller. Für neue Kundinnen lohnt sich der Weg über die Buchungsseite,
weil die Erinnerung mitkommt.

## Damit nichts kollidiert

Zwischen dem Telefonat und dem Eintrag im Kalender könnte theoretisch jemand
online denselben Platz buchen. In der Praxis kaum ein Thema, aber zwei
Einstellungen entschärfen es ganz:

- **Vorlaufzeit** beim Termintyp: „frühestens in 24 Stunden buchbar“.
  Dann kann niemand einen Platz für gleich wegschnappen.
- **Pufferzeit** zwischen zwei Terminen, damit nicht direkt hintereinander
  gebucht wird.

Beides steht beim jeweiligen Termintyp unter *Limits*.

## Urlaub und längere Abwesenheiten

Nicht einzeln blockieren, sondern *Availability → Out of office* benutzen.
Ein Eintrag für den ganzen Zeitraum.
