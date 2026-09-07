/**
 * Verwaltungsbereich: Workshops und Kuren pflegen.
 *
 * Was hier passiert, passiert auf dem Server. Das ist der Punkt: Auf einer
 * statischen Seite laesst sich nichts absichern, was im Browser entschieden
 * wird - ein Passwort im JavaScript koennte jeder im Quelltext lesen.
 *
 * Aufbau
 *   Passwort   Als scrypt-Hash in der Umgebungsvariable VERWALTUNG_PASSWORT.
 *              Das Klartextpasswort steht nirgends, auch nicht bei Netlify.
 *   Sitzung    Ein mit VERWALTUNG_GEHEIMNIS signiertes Merkmal in einem
 *              HttpOnly-Cookie. Es laesst sich nicht faelschen, und das
 *              JavaScript der Seite kommt nicht daran.
 *   Bremse     Nach fuenf Fehlversuchen ist die Adresse gesperrt. Gezaehlt
 *              wird ueber einen Hash der IP, nicht ueber die IP selbst.
 *   Daten      Im Blob-Speicher, nicht im Git-Verzeichnis. Eine Aenderung
 *              loest damit keinen Deploy aus und kostet keine Credits.
 *
 * Fehlt eine der beiden Umgebungsvariablen, verweigert die Funktion alles.
 * Sie faellt zu, nicht auf.
 */

import { getStore } from "@netlify/blobs";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEKS = "sg_sitzung";
const SITZUNGSDAUER = 8 * 60 * 60 * 1000;   // acht Stunden
const MAX_VERSUCHE = 5;
const SPERRE = 15 * 60 * 1000;
const MAX_TERMINE = 200;

/* ============================================================
   Antworten
   ============================================================ */

function json(daten, status = 200, kopf = {}) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      "x-robots-tag": "noindex, nofollow",
      ...kopf
    }
  });
}

/* ============================================================
   Passwort
   ============================================================ */

/** Format: scrypt$N$r$p$salz$hash - Salz und Hash base64. */
async function passwortStimmt(eingabe, gespeichert) {
  const teile = String(gespeichert || "").split("$");
  if (teile.length !== 6 || teile[0] !== "scrypt") return false;

  const N = parseInt(teile[1], 10);
  const r = parseInt(teile[2], 10);
  const p = parseInt(teile[3], 10);
  if (!N || !r || !p || N > (1 << 20)) return false;

  let salz, soll;
  try {
    salz = Buffer.from(teile[4], "base64");
    soll = Buffer.from(teile[5], "base64");
  } catch (e) { return false; }
  if (!salz.length || soll.length < 16) return false;

  let ist;
  try {
    ist = await scryptAsync(Buffer.from(String(eingabe), "utf8"), salz, soll.length,
                            { N, r, p, maxmem: 256 * 1024 * 1024 });
  } catch (e) { return false; }

  return ist.length === soll.length && timingSafeEqual(ist, soll);
}

/* ============================================================
   Sitzung
   ============================================================ */

function b64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sitzungBauen(geheimnis) {
  const inhalt = b64url(JSON.stringify({
    bis: Date.now() + SITZUNGSDAUER,
    z: b64url(randomBytes(9))
  }));
  const zeichen = b64url(createHmac("sha256", geheimnis).update(inhalt).digest());
  return inhalt + "." + zeichen;
}

function sitzungGilt(merkmal, geheimnis) {
  if (typeof merkmal !== "string" || merkmal.length > 400) return false;
  const punkt = merkmal.lastIndexOf(".");
  if (punkt < 1) return false;

  const inhalt = merkmal.slice(0, punkt);
  const zeichen = merkmal.slice(punkt + 1);
  const soll = b64url(createHmac("sha256", geheimnis).update(inhalt).digest());

  // Erst die Unterschrift pruefen, dann erst den Inhalt anschauen.
  const a = Buffer.from(zeichen), b = Buffer.from(soll);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const roh = Buffer.from(inhalt.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const d = JSON.parse(roh);
    return typeof d.bis === "number" && d.bis > Date.now();
  } catch (e) { return false; }
}

function keksLesen(request, name) {
  const roh = request.headers.get("cookie") || "";
  for (const teil of roh.split(";")) {
    const i = teil.indexOf("=");
    if (i < 0) continue;
    if (teil.slice(0, i).trim() === name) return decodeURIComponent(teil.slice(i + 1).trim());
  }
  return null;
}

function keksSetzen(wert, sekunden) {
  return [
    KEKS + "=" + wert,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=" + sekunden
  ].join("; ");
}

/* ============================================================
   Fehlversuche bremsen
   ============================================================ */

function kennung(ip, geheimnis) {
  return b64url(createHmac("sha256", geheimnis).update("ip:" + (ip || "?")).digest()).slice(0, 24);
}

async function schutzLesen(speicher, k) {
  try {
    return (await speicher.get(k, { type: "json" })) || { versuche: 0, bis: 0 };
  } catch (e) {
    return { versuche: 0, bis: 0 };
  }
}

/* ============================================================
   Termine pruefen
   ============================================================ */

const ELEMENTE = ["", "holz", "feuer", "erde", "metall", "wasser"];

// Steuerzeichen raus, Zeilenumbruch darf bleiben.
const STEUERZEICHEN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/* Ein Datum muss es wirklich geben. Die Form allein reicht nicht:
   Aus 2026-13-45 macht JavaScript stillschweigend den 14.02.2027. */
function echtesDatum(wert) {
  if (!wert) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const d = new Date(wert + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === wert;
}

const FELDER = {
  datum:      { max: 10,  pruefer: echtesDatum },
  enddatum:   { max: 10,  pruefer: echtesDatum },
  zeit:       { max: 5,   muster: /^(([01]\d|2[0-3]):[0-5]\d)?$/ },
  art:        { max: 40 },
  element:    { max: 10,  liste: ELEMENTE },
  titel:      { max: 160 },
  text:       { max: 1500 },
  preis:      { max: 40 },
  ort:        { max: 80 },
  leistungen: { max: 400 },
  // Nur https. Sonst liesse sich ueber die Buchungsadresse ein
  // javascript:-Verweis in die oeffentliche Seite schreiben.
  buchung:    { max: 300, muster: /^(https:\/\/[^\s"'<>]{4,})?$/ },
  plaetze:    { max: 40 }
};

function terminePruefen(rohe) {
  if (!Array.isArray(rohe)) return { fehler: "Es wurde keine Liste übermittelt." };
  if (rohe.length > MAX_TERMINE) return { fehler: "Höchstens " + MAX_TERMINE + " Einträge." };

  const sauber = [];
  for (let i = 0; i < rohe.length; i++) {
    const roh = rohe[i];
    if (!roh || typeof roh !== "object") return { fehler: "Eintrag " + (i + 1) + " ist unbrauchbar." };

    const eintrag = {};
    for (const name of Object.keys(FELDER)) {
      const regel = FELDER[name];
      let wert = roh[name] == null ? "" : String(roh[name]);
      wert = wert.replace(/\r\n/g, "\n").replace(STEUERZEICHEN, "").trim();

      if (wert.length > regel.max) {
        return { fehler: "Eintrag " + (i + 1) + ": „" + name + "“ ist zu lang (höchstens " + regel.max + " Zeichen)." };
      }
      if (regel.liste && regel.liste.indexOf(wert.toLowerCase()) === -1) {
        return { fehler: "Eintrag " + (i + 1) + ": „" + name + "“ hat einen unbekannten Wert." };
      }
      if (regel.muster && !regel.muster.test(wert)) {
        return { fehler: "Eintrag " + (i + 1) + ": „" + name + "“ hat ein ungültiges Format." };
      }
      if (regel.pruefer && !regel.pruefer(wert)) {
        return { fehler: "Eintrag " + (i + 1) + ": „" + name + "“ ist kein gültiges Datum." };
      }
      eintrag[name] = regel.liste ? wert.toLowerCase() : wert;
    }

    if (!eintrag.titel) return { fehler: "Eintrag " + (i + 1) + " braucht einen Titel." };
    if (eintrag.enddatum && eintrag.datum && eintrag.enddatum < eintrag.datum) {
      return { fehler: "Eintrag " + (i + 1) + ": Das Ende liegt vor dem Anfang." };
    }
    sauber.push(eintrag);
  }
  return { termine: sauber };
}

/* ============================================================
   Die Funktion
   ============================================================ */

export default async (request, context) => {
  const hashwort = process.env.VERWALTUNG_PASSWORT;
  const geheimnis = process.env.VERWALTUNG_GEHEIMNIS;

  // Fehlt die Einrichtung, ist hier zu. Nicht offen.
  if (!hashwort || !geheimnis || geheimnis.length < 24) {
    return json({
      fehler: "Der Verwaltungsbereich ist noch nicht eingerichtet.",
      eingerichtet: false
    }, 503);
  }

  const pfad = new URL(request.url).pathname.replace(/^\/api\/verwaltung\/?/, "");
  const art = request.method.toUpperCase();

  // Fremde Seiten sollen keine Aenderungen ausloesen koennen. Zusammen mit
  // SameSite=Strict ist das der Schutz gegen untergeschobene Anfragen: eine
  // eigene Kopfzeile zwingt fremde Herkunft in eine Vorabfrage, die hier
  // nicht beantwortet wird.
  if (art !== "GET" && request.headers.get("x-verwaltung") !== "1") {
    return json({ fehler: "Ungültige Anfrage." }, 400);
  }

  const angemeldet = sitzungGilt(keksLesen(request, KEKS), geheimnis);

  /* ---------- Zustand ---------- */
  if (pfad === "status" && art === "GET") {
    return json({ angemeldet, eingerichtet: true });
  }

  /* ---------- Anmelden ---------- */
  if (pfad === "anmeldung" && art === "POST") {
    const ip = (context && context.ip) || request.headers.get("x-nf-client-connection-ip") || "";
    const k = kennung(ip, geheimnis);
    let schutz = null;

    try {
      schutz = getStore({ name: "verwaltung-schutz", consistency: "strong" });
      const stand = await schutzLesen(schutz, k);
      if (stand.bis > Date.now()) {
        const min = Math.ceil((stand.bis - Date.now()) / 60000);
        return json({ fehler: "Zu viele Fehlversuche. Bitte in " + min + " Minuten erneut versuchen." }, 429);
      }
    } catch (e) { /* ohne Speicher eben ohne Bremse */ }

    let eingabe = "";
    try {
      const koerper = await request.json();
      eingabe = String((koerper && koerper.passwort) || "");
    } catch (e) {}

    const beginn = Date.now();
    const stimmt = eingabe.length > 0 && eingabe.length <= 200
      && await passwortStimmt(eingabe, hashwort);

    // Jede Antwort braucht ungefaehr gleich lang, egal wie sie ausfaellt.
    const rest = 300 - (Date.now() - beginn);
    if (rest > 0) await new Promise((r) => setTimeout(r, rest));

    if (!stimmt) {
      if (schutz) {
        try {
          const stand = await schutzLesen(schutz, k);
          const versuche = stand.versuche + 1;
          await schutz.setJSON(k, {
            versuche,
            bis: versuche >= MAX_VERSUCHE
              ? Date.now() + SPERRE * Math.pow(2, versuche - MAX_VERSUCHE)
              : 0
          });
        } catch (e) {}
      }
      return json({ fehler: "Passwort stimmt nicht." }, 401);
    }

    if (schutz) { try { await schutz.delete(k); } catch (e) {} }

    return json({ angemeldet: true }, 200, {
      "set-cookie": keksSetzen(sitzungBauen(geheimnis), SITZUNGSDAUER / 1000)
    });
  }

  /* ---------- Abmelden ---------- */
  if (pfad === "abmeldung" && art === "POST") {
    return json({ angemeldet: false }, 200, { "set-cookie": keksSetzen("", 0) });
  }

  /* ---------- Ab hier nur angemeldet ---------- */
  if (!angemeldet) return json({ fehler: "Nicht angemeldet.", angemeldet: false }, 401);

  const speicher = getStore({ name: "termine", consistency: "strong" });

  /* ---------- Termine lesen ---------- */
  if (pfad === "termine" && art === "GET") {
    const daten = (await speicher.get("aktuell", { type: "json" })) || null;
    return json({
      termine: (daten && daten.termine) || [],
      stand: (daten && daten.stand) || 0,
      benutzt: !!(daten && daten.termine && daten.termine.length)
    });
  }

  /* ---------- Termine schreiben ---------- */
  if (pfad === "termine" && art === "PUT") {
    let koerper;
    try { koerper = await request.json(); }
    catch (e) { return json({ fehler: "Die Daten waren nicht lesbar." }, 400); }

    const geprueft = terminePruefen(koerper && koerper.termine);
    if (geprueft.fehler) return json({ fehler: geprueft.fehler }, 400);

    // Zwei offene Fenster sollen sich nicht gegenseitig ueberschreiben.
    const vorher = (await speicher.get("aktuell", { type: "json" })) || null;
    if (vorher && vorher.stand && koerper.stand && vorher.stand !== koerper.stand) {
      return json({
        fehler: "Inzwischen wurde an anderer Stelle gespeichert. Bitte die Seite neu laden.",
        konflikt: true
      }, 409);
    }

    const stand = Date.now();
    await speicher.setJSON("aktuell", { termine: geprueft.termine, stand });
    return json({ gespeichert: true, stand, anzahl: geprueft.termine.length });
  }

  /* ---------- Aus der Google-Tabelle uebernehmen ---------- */
  if (pfad === "tabelle" && art === "GET") {
    try {
      const r = await fetch(new URL("/api/plaetze?tabelle=termine", request.url));
      if (!r.ok) return json({ fehler: "Die Tabelle war nicht erreichbar." }, 502);
      const d = await r.json();
      const geprueft = terminePruefen(d.termine || []);
      if (geprueft.fehler) return json({ fehler: "Die Tabelle enthält: " + geprueft.fehler }, 422);
      return json({ termine: geprueft.termine, quelle: d.quelle });
    } catch (e) {
      return json({ fehler: "Die Tabelle war nicht erreichbar." }, 502);
    }
  }

  return json({ fehler: "Unbekannte Anfrage." }, 404);
};

export const config = { path: "/api/verwaltung/*" };
