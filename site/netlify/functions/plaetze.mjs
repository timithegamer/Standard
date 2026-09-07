/**
 * Holt die veröffentlichte Termintabelle und reicht sie an die Website weiter.
 *
 * Warum eine Serverfunktion? Damit der Browser der Besucherin keinen Kontakt
 * zu Google aufnimmt - es geht keine IP-Adresse dorthin. Antwortet die
 * Funktion nicht, faellt die Website auf termine.json zurueck.
 */

// Erlaubte Termintabelle. Fest verdrahtet, damit die Funktion nicht
// als offener Weiterleiter fuer beliebige Adressen dienen kann.
const TABELLE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSXpfe7o0zV075kfvaDYblYd0gHVr8jEgQuJncrYrYCACr9fI0pGCBvtknXJSmVKykNDdU9K1bA_FE_/pub?gid=938045566&single=true&output=csv";

export default async (request) => {
  const p = new URL(request.url).searchParams;

  // Termintabelle ueber den Server holen, damit der Browser der Besucherin
  // keinen Kontakt zu Google aufnimmt.
  if (p.get("tabelle") === "termine") {
    try {
      const r = await fetch(TABELLE, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return new Response("", { status: 502 });
      return new Response(await r.text(), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "cache-control": "public, max-age=180, s-maxage=180"
        }
      });
    } catch (e) {
      return new Response("", { status: 504 });
    }
  }

  return new Response("unbekannte Anfrage", { status: 400 });
};

export const config = { path: "/api/plaetze" };
