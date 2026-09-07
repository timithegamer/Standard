/**
 * Liefert die Termine an die Website.
 *
 * Reihenfolge der Quellen:
 *   1. Blob-Speicher  — was im Verwaltungsbereich eingetragen wurde
 *   2. Google-Tabelle — die bisherige Pflege, bleibt als Rueckfall bestehen
 *
 * Antwortet die Funktion gar nicht, faellt die Website auf termine.json
 * zurueck. Es gibt also drei Ebenen, bevor die Seite leer waere.
 *
 * Warum ueberhaupt eine Serverfunktion? Damit der Browser der Besucherin
 * keinen Kontakt zu Google aufnimmt - es geht keine IP-Adresse dorthin.
 */


// Erlaubte Termintabelle. Fest verdrahtet, damit die Funktion nicht
// als offener Weiterleiter fuer beliebige Adressen dienen kann.
const TABELLE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSXpfe7o0zV075kfvaDYblYd0gHVr8jEgQuJncrYrYCACr9fI0pGCBvtknXJSmVKykNDdU9K1bA_FE_/pub?gid=938045566&single=true&output=csv";

/* ---------- CSV lesen (wie bisher, nur jetzt auf dem Server) ---------- */

function csvLesen(text) {
  const zeilen = [];
  let feld = "", zeile = [], inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { feld += '"'; i++; }
        else inQuote = false;
      } else feld += c;
    } else if (c === '"') inQuote = true;
    else if (c === ",") { zeile.push(feld); feld = ""; }
    else if (c === "\n") { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; }
    else if (c !== "\r") feld += c;
  }
  if (feld.length || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  if (!zeilen.length) return [];

  const norm = (s) => s.trim().toLowerCase()
    .replace(/[äöü]/g, (m) => ({ "ä": "a", "ö": "o", "ü": "u" }[m]))
    .replace(/[^a-z]/g, "");

  const SCHLUESSEL = {
    datum: "datum", enddatum: "enddatum", uhrzeit: "zeit", zeit: "zeit",
    art: "art", element: "element", titel: "titel",
    beschreibung: "text", text: "text",
    preis: "preis", ort: "ort", leistungen: "leistungen",
    platze: "plaetze", plaetze: "plaetze", status: "plaetze",
    buchung: "buchung", buchungslink: "buchung", link: "buchung"
  };

  const kopf = zeilen[0].map(norm);
  return zeilen.slice(1)
    .filter((r) => r.some((z) => z.trim() !== ""))
    .map((r) => {
      const o = {};
      kopf.forEach((h, i) => {
        const k = SCHLUESSEL[h];
        if (k) o[k] = (r[i] || "").trim();
      });
      return o;
    });
}

function antwort(daten, sekunden) {
  return new Response(JSON.stringify(daten), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${sekunden}, s-maxage=${sekunden}`
    }
  });
}

export default async (request) => {
  const p = new URL(request.url).searchParams;
  if (p.get("tabelle") !== "termine") {
    return new Response("unbekannte Anfrage", { status: 400 });
  }

  // 1. Verwaltungsbereich. Sobald dort etwas steht, gilt das.
  //
  // Das Blob-Paket wird erst hier geladen und der Fehlerfall bewusst
  // verschluckt: Wenn beim Deploy etwas mit der Abhaengigkeit schiefgeht,
  // soll die oeffentliche Terminliste trotzdem stehen - dann eben aus
  // der Tabelle. Ein Verpackungsfehler darf die Website nicht leeren.
  try {
    const { getStore } = await import("@netlify/blobs");
    const speicher = getStore({ name: "termine", consistency: "strong" });
    const daten = await speicher.get("aktuell", { type: "json" });
    if (daten && Array.isArray(daten.termine) && daten.termine.length) {
      return antwort({ termine: daten.termine, quelle: "verwaltung" }, 60);
    }
  } catch (e) {
    // Kein Blob-Speicher erreichbar - dann eben die Tabelle.
  }

  // 2. Google-Tabelle.
  try {
    const r = await fetch(TABELLE, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const zeilen = csvLesen(await r.text());
      if (zeilen.length) return antwort({ termine: zeilen, quelle: "tabelle" }, 180);
    }
    return new Response("", { status: 502 });
  } catch (e) {
    return new Response("", { status: 504 });
  }
};

export const config = { path: "/api/plaetze" };
