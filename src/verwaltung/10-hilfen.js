/* ===========================================================
   Verwaltungsbereich - Grundlagen

   Die Oberflaeche wird ueber DOM-Aufrufe gebaut, nicht ueber
   innerHTML. Damit kann aus einem Termintext gar nichts erst
   ausbrechen - es gibt keine Stelle, an der Text als Auszeichnung
   gelesen wuerde.
   =========================================================== */

var D = document;
var W = window;

function eins(wahl, in_) { return (in_ || D).querySelector(wahl); }
function alle(wahl, in_) { return Array.prototype.slice.call((in_ || D).querySelectorAll(wahl)); }

function an(ziel, art, tu, opt) {
  if (ziel) ziel.addEventListener(art, tu, opt);
}

/**
 * el("div", {class: "x"}, ["Text", el("b", {}, ["fett"])])
 * Attribute mit dem Wert null oder undefined werden weggelassen.
 */
function el(tag, merkmale, kinder) {
  var k = D.createElement(tag);
  if (merkmale) {
    for (var name in merkmale) {
      if (!Object.prototype.hasOwnProperty.call(merkmale, name)) continue;
      var wert = merkmale[name];
      if (wert == null || wert === false) continue;
      if (name === "class") k.className = wert;
      else if (name === "text") k.textContent = wert;
      else if (name === "wert") k.value = wert;             // nie als Attribut
      else if (name.indexOf("on") === 0) k.addEventListener(name.slice(2), wert);
      else if (wert === true) k.setAttribute(name, "");
      else k.setAttribute(name, String(wert));
    }
  }
  (kinder || []).forEach(function (kind) {
    if (kind == null || kind === false) return;
    k.appendChild(typeof kind === "string" ? D.createTextNode(kind) : kind);
  });
  return k;
}

function leeren(knoten) {
  while (knoten && knoten.firstChild) knoten.removeChild(knoten.firstChild);
}

/* ---------- Verbindung zum Server ---------- */

var FEHLER_VERBINDUNG = "Keine Verbindung zum Server. Bitte noch einmal versuchen.";

/**
 * Ruft die Verwaltungsfunktion auf. Die eigene Kopfzeile x-verwaltung
 * gehoert zum Schutz gegen untergeschobene Anfragen von fremden Seiten -
 * ohne sie lehnt der Server jede Aenderung ab.
 */
async function ruf(pfad, art, koerper) {
  var einstellungen = {
    method: art || "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "x-verwaltung": "1" }
  };
  if (koerper !== undefined) {
    einstellungen.headers["content-type"] = "application/json";
    einstellungen.body = JSON.stringify(koerper);
  }

  var antwort;
  try {
    antwort = await fetch("/api/verwaltung/" + pfad, einstellungen);
  } catch (e) {
    return { ok: false, status: 0, daten: { fehler: FEHLER_VERBINDUNG } };
  }

  var daten = {};
  try { daten = await antwort.json(); } catch (e) {}
  return { ok: antwort.ok, status: antwort.status, daten: daten };
}

/* ---------- Datum und Zeit ---------- */

var MONATE = ["Jänner", "Februar", "März", "April", "Mai", "Juni",
              "Juli", "August", "September", "Oktober", "November", "Dezember"];

function datumLesen(wert) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(wert || ""));
  if (!m) return null;
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d) ? null : d;
}

function datumSchreiben(wert) {
  var d = datumLesen(wert);
  if (!d) return "";
  return d.getDate() + ". " + MONATE[d.getMonth()] + " " + d.getFullYear();
}

function istVergangen(wert) {
  var d = datumLesen(wert);
  if (!d) return false;
  var heute = new Date();
  heute.setHours(0, 0, 0, 0);
  return d < heute;
}

function uhrzeit(zeitstempel) {
  if (!zeitstempel) return "";
  try {
    return new Date(zeitstempel).toLocaleString("de-AT", {
      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });
  } catch (e) { return ""; }
}
