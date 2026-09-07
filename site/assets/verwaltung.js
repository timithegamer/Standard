/* Erzeugte Datei - nicht direkt bearbeiten.
   Quelle: src/verwaltung/*.js
   Bauen:  python3 build.py */
"use strict";
(function () {
/* ---------- 10-hilfen.js ---------- */
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

/* ---------- 20-anmeldung.js ---------- */
/* ===========================================================
   An- und Abmelden

   Das Passwort verlaesst dieses Formular nur einmal, auf dem Weg zum
   Server. Was zurueckkommt, ist ein Cookie, an das dieses JavaScript
   nicht herankommt (HttpOnly). Es gibt hier also nichts, was sich aus
   dem Browser auslesen liesse.
   =========================================================== */

var zustand = {
  termine: [],
  stand: 0,
  schmutzig: false
};

function ansichtZeigen(welche) {
  var anmeldung = eins("[data-anmeldung]");
  var verwaltung = eins("[data-verwaltung]");
  if (anmeldung) anmeldung.hidden = welche !== "anmeldung";
  if (verwaltung) verwaltung.hidden = welche !== "verwaltung";
}

function anmeldefehler(text) {
  var feld = eins("[data-anmeldefehler]");
  if (!feld) return;
  feld.textContent = text || "";
  feld.hidden = !text;
}

async function anmeldungPruefen() {
  var a = await ruf("status");

  if (a.status === 503) {
    ansichtZeigen("anmeldung");
    anmeldefehler(a.daten.fehler
      || "Der Verwaltungsbereich ist noch nicht eingerichtet.");
    var form = eins("[data-anmeldeform]");
    if (form) form.hidden = true;
    return false;
  }

  if (a.ok && a.daten.angemeldet) {
    ansichtZeigen("verwaltung");
    await termineHolen();
    return true;
  }

  ansignal();
  return false;
}

function ansignal() {
  ansichtZeigen("anmeldung");
  var feld = eins("#v-passwort");
  if (feld) { feld.value = ""; setTimeout(function () { feld.focus(); }, 50); }
}

/** Wird gerufen, wenn der Server mitten in der Arbeit 401 meldet. */
function sitzungAbgelaufen() {
  ansignal();
  anmeldefehler("Die Sitzung ist abgelaufen. Bitte erneut anmelden.");
}

function anmeldungStarten() {
  var form = eins("[data-anmeldeform]");
  var knopf = eins("[data-anmeldeknopf]");
  if (!form) return;

  an(form, "submit", async function (e) {
    e.preventDefault();
    anmeldefehler("");

    var feld = eins("#v-passwort");
    var passwort = feld ? feld.value : "";
    if (!passwort) { anmeldefehler("Bitte das Passwort eingeben."); return; }

    if (knopf) { knopf.disabled = true; }
    var a = await ruf("anmeldung", "POST", { passwort: passwort });
    if (knopf) { knopf.disabled = false; }

    if (a.ok && a.daten.angemeldet) {
      if (feld) feld.value = "";
      ansichtZeigen("verwaltung");
      await termineHolen();
      return;
    }
    anmeldefehler(a.daten.fehler || "Anmeldung nicht möglich.");
    if (feld) { feld.value = ""; feld.focus(); }
  });

  an(eins("[data-abmelden]"), "click", async function () {
    if (zustand.schmutzig
        && !confirm("Es gibt nicht gespeicherte Änderungen. Trotzdem abmelden?")) return;
    await ruf("abmeldung", "POST");
    zustand.termine = [];
    zustand.stand = 0;
    zustand.schmutzig = false;
    ansignal();
  });
}

/* ---------- 30-liste.js ---------- */
/* ===========================================================
   Die Liste der Workshops und Kuren

   Beim Tippen wird nichts neu gezeichnet - sonst spränge der Cursor
   aus dem Feld. Geändert wird nur der Zustand und die Zusammenfassung
   in der Kopfzeile des jeweiligen Eintrags. Neu gezeichnet wird erst,
   wenn ein Eintrag dazukommt oder verschwindet.
   =========================================================== */

var ELEMENTFARBEN = {
  "":       "var(--el-neutral)",
  holz:     "var(--el-holz)",
  feuer:    "var(--el-feuer)",
  erde:     "var(--el-erde)",
  metall:   "var(--el-metall)",
  wasser:   "var(--el-wasser)"
};

var ELEMENTNAMEN = [
  ["", "— kein Element —"],
  ["holz", "Holz · Frühling · Leber"],
  ["feuer", "Feuer · Sommer · Herz"],
  ["erde", "Erde · Spätsommer · Milz"],
  ["metall", "Metall · Herbst · Lunge"],
  ["wasser", "Wasser · Winter · Niere"]
];

// Dieselben Grenzen prueft die Serverfunktion noch einmal. Hier stehen
// sie, damit man den Fehler sieht, bevor man auf Speichern drueckt.
var FELDER = [
  // gruppe "oben" steht über den kurzen Feldern, "unten" darunter.
  { name: "titel",      gruppe: "oben",  art: "text",    titel: "Titel", max: 160,
    platzhalter: "Herbst und das Metall-Element" },

  { name: "datum",      gruppe: "kurz",  art: "date",    titel: "Datum",
    hilfe: "Ohne Datum erscheint der Termin nicht auf der Website — praktisch für Entwürfe." },
  { name: "enddatum",   gruppe: "kurz",  art: "date",    titel: "Ende",
    hilfe: "Nur bei mehrtägigen Terminen, etwa einer Kur." },
  { name: "zeit",       gruppe: "kurz",  art: "time",    titel: "Beginn" },
  { name: "art",        gruppe: "kurz",  art: "liste",   titel: "Art", max: 40,
    vorschlaege: ["Kochworkshop", "Kur"],
    hilfe: "Steuert die Filterknöpfe auf der Website." },
  { name: "element",    gruppe: "kurz",  art: "auswahl", titel: "Element",
    hilfe: "Färbt den Eintrag und nennt Jahreszeit und Organ." },
  { name: "preis",      gruppe: "kurz",  art: "text",    titel: "Preis", max: 40,
    platzhalter: "135 €" },
  { name: "ort",        gruppe: "kurz",  art: "text",    titel: "Ort", max: 80,
    platzhalter: "Pinsdorf" },
  { name: "plaetze",    gruppe: "kurz",  art: "text",    titel: "Plätze", max: 40,
    platzhalter: "frei",
    hilfe: "„frei“, „wenige“, „ausgebucht“ — oder eine Zahl wie „3“." },

  { name: "text",       gruppe: "unten", art: "fliess",  titel: "Beschreibung", max: 1500,
    platzhalter: "Worum es in diesem Workshop geht …" },
  { name: "leistungen", gruppe: "unten", art: "fliess",  titel: "Enthaltene Leistungen", max: 400,
    platzhalter: "Privatzimmer mit Bad · Verpflegung · 3× Tuina Massage",
    hilfe: "Mit · getrennt. Vor allem für Kuren gedacht." },
  { name: "buchung",    gruppe: "unten", art: "url",     titel: "Buchungslink", max: 300,
    platzhalter: "https://…",
    hilfe: "Leer lassen, dann führt der Knopf zum Anfrageformular der Website." }
];

var LEERER_TERMIN = {
  datum: "", enddatum: "", zeit: "", art: "", element: "", titel: "",
  text: "", preis: "", ort: "", leistungen: "", buchung: "", plaetze: ""
};

/* ---------- Meldungen und Zustand ---------- */

function meldung(text, art) {
  var feld = eins("[data-meldung]");
  if (!feld) return;
  feld.textContent = text || "";
  feld.className = "meldung" + (art === "fehler" ? " meldung--fehler" : "");
  feld.hidden = !text;
  if (text) feld.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function schmutzigSetzen(ja) {
  zustand.schmutzig = ja;
  var hinweis = eins("[data-schmutzig]");
  var knopf = eins("[data-speichern]");
  if (hinweis) hinweis.hidden = !ja;
  if (knopf) knopf.disabled = !ja;
}

function standSchreiben() {
  var feld = eins("[data-stand]");
  if (!feld) return;
  var n = zustand.termine.length;
  var teile = [n === 1 ? "1 Eintrag" : n + " Einträge"];
  if (zustand.stand) teile.push("zuletzt gespeichert " + uhrzeit(zustand.stand));
  feld.textContent = teile.join(" · ");
}

/* ---------- Laden ---------- */

function nachDatum(a, b) {
  if (!a.datum && !b.datum) return 0;
  if (!a.datum) return 1;          // Entwürfe ans Ende
  if (!b.datum) return -1;
  return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : 0);
}

async function termineHolen() {
  var a = await ruf("termine");
  if (a.status === 401) { sitzungAbgelaufen(); return; }
  if (!a.ok) { meldung(a.daten.fehler || "Die Termine konnten nicht geladen werden.", "fehler"); return; }

  zustand.termine = (a.daten.termine || []).slice().sort(nachDatum);
  zustand.stand = a.daten.stand || 0;
  schmutzigSetzen(false);
  zeichnen();

  if (!zustand.termine.length) {
    meldung("Noch keine Termine hinterlegt. Solange hier nichts steht, "
      + "zeigt die Website weiter die Google-Tabelle.");
  } else {
    meldung("");
  }
}

/* ---------- Zeichnen ---------- */

function zeichnen() {
  var liste = eins("[data-liste]");
  if (!liste) return;
  leeren(liste);

  if (!zustand.termine.length) {
    liste.appendChild(el("div", { class: "vleer" }, [
      el("p", { text: "Hier ist noch nichts eingetragen." }),
      el("p", { style: "margin-top:.5rem",
                text: "Legen Sie oben einen Workshop an — oder übernehmen Sie die "
                    + "bestehenden Termine aus der Google-Tabelle." })
    ]));
  } else {
    zustand.termine.forEach(function (t, i) {
      liste.appendChild(eintragBauen(t, i));
    });
  }
  standSchreiben();
}

function zusammenfassung(t) {
  var teile = [];
  if (t.art) teile.push(t.art);
  if (t.zeit) teile.push("ab " + t.zeit + " Uhr");
  if (t.preis) teile.push(t.preis);
  if (t.ort) teile.push(t.ort);
  if (t.plaetze) teile.push("Plätze: " + t.plaetze);
  return teile;
}

function kopfFuellen(kopf, t) {
  leeren(kopf);

  var wann = t.datum
    ? datumSchreiben(t.datum) + (t.enddatum && t.enddatum !== t.datum
        ? " – " + datumSchreiben(t.enddatum) : "")
    : "ohne Datum";

  kopf.appendChild(el("span", { class: "eintrag__wann" }, [
    D.createTextNode(t.datum ? datumSchreiben(t.datum) : "—"),
    el("small", { text: t.datum ? (t.enddatum && t.enddatum !== t.datum ? "bis " + datumSchreiben(t.enddatum) : "") || " " : "Entwurf" })
  ]));

  var unten = el("span", { class: "eintrag__unten" });
  zusammenfassung(t).forEach(function (s) { unten.appendChild(el("span", { text: s })); });
  if (!t.datum) {
    unten.appendChild(el("span", { class: "eintrag__warnung",
      text: "wird auf der Website nicht angezeigt" }));
  } else if (istVergangen(t.datum)) {
    unten.appendChild(el("span", { class: "eintrag__warnung", text: "liegt in der Vergangenheit" }));
  }

  kopf.appendChild(el("span", { class: "eintrag__namen" }, [
    el("span", { class: "eintrag__titel", text: t.titel || "(ohne Titel)", title: t.titel || "" }),
    unten
  ]));

  kopf.appendChild(el("span", { class: "eintrag__pfeil", "aria-hidden": "true" }));
  kopf.setAttribute("aria-label", (t.titel || "Eintrag") + ", " + wann);
}

function eintragBauen(t, i) {
  var karte = el("article", {
    class: "eintrag" + (t.__offen ? " ist-offen" : ""),
    style: "--el:" + (ELEMENTFARBEN[t.element] || ELEMENTFARBEN[""])
  });

  var inhalt = el("div", { class: "eintrag__inhalt" });
  inhalt.hidden = !t.__offen;

  var kopf = el("button", {
    class: "eintrag__kopf",
    type: "button",
    "aria-expanded": t.__offen ? "true" : "false"
  });
  kopfFuellen(kopf, t);

  an(kopf, "click", function () {
    t.__offen = !t.__offen;
    karte.classList.toggle("ist-offen", !!t.__offen);
    inhalt.hidden = !t.__offen;
    kopf.setAttribute("aria-expanded", t.__offen ? "true" : "false");
  });

  function geaendert() {
    karte.style.setProperty("--el", ELEMENTFARBEN[t.element] || ELEMENTFARBEN[""]);
    kopfFuellen(kopf, t);
    schmutzigSetzen(true);
  }

  // Der Titel steht oben - er ist das Feld, das man zuerst sucht.
  function gruppe(name) { return FELDER.filter(function (f) { return f.gruppe === name; }); }

  gruppe("oben").forEach(function (f) {
    inhalt.appendChild(feldBauen(f, t, i, geaendert));
  });

  inhalt.appendChild(el("div", { class: "vgitter vgitter--drei" },
    gruppe("kurz").map(function (f) { return feldBauen(f, t, i, geaendert); })));

  gruppe("unten").forEach(function (f) {
    inhalt.appendChild(feldBauen(f, t, i, geaendert));
  });

  inhalt.appendChild(el("div", { class: "eintrag__fuss" }, [
    el("span", { class: "hilfe",
      text: "Änderungen werden erst mit „Speichern“ übernommen." }),
    el("button", {
      class: "loeschen", type: "button",
      onclick: function () {
        if (!confirm("„" + (t.titel || "Dieser Eintrag") + "“ wirklich löschen?")) return;
        zustand.termine.splice(i, 1);
        schmutzigSetzen(true);
        zeichnen();
        meldung("Eintrag entfernt. Mit „Speichern“ wird das übernommen.");
      }
    }, ["Eintrag löschen"])
  ]));

  karte.appendChild(kopf);
  karte.appendChild(inhalt);
  return karte;
}

function feldBauen(f, t, i, geaendert) {
  var kennung = "f-" + f.name + "-" + i;
  var kinder = [el("label", { for: kennung, text: f.titel })];
  var eingabe;

  if (f.art === "auswahl") {
    eingabe = el("select", { id: kennung },
      ELEMENTNAMEN.map(function (paar) {
        return el("option", { value: paar[0], text: paar[1], selected: t[f.name] === paar[0] });
      }));

  } else if (f.art === "fliess") {
    eingabe = el("textarea", {
      id: kennung, rows: f.name === "text" ? 5 : 3,
      maxlength: f.max, placeholder: f.platzhalter
    });
    eingabe.value = t[f.name] || "";

  } else if (f.art === "liste") {
    eingabe = el("input", {
      id: kennung, type: "text", list: "arten-" + i,
      maxlength: f.max, placeholder: f.platzhalter
    });
    eingabe.value = t[f.name] || "";
    kinder.push(el("datalist", { id: "arten-" + i },
      (f.vorschlaege || []).map(function (v) { return el("option", { value: v }); })));

  } else {
    eingabe = el("input", {
      id: kennung,
      type: f.art === "url" ? "url" : f.art,
      maxlength: f.max,
      placeholder: f.platzhalter,
      inputmode: f.art === "url" ? "url" : null
    });
    eingabe.value = t[f.name] || "";
  }

  var zaehler = null;
  if (f.max && (f.art === "fliess" || f.name === "titel")) {
    zaehler = el("span", { class: "zeichen" });
  }

  function zaehlerSetzen() {
    if (!zaehler) return;
    var rest = f.max - (eingabe.value || "").length;
    zaehler.textContent = rest + " Zeichen frei";
    zaehler.classList.toggle("ist-knapp", rest < 40);
  }

  an(eingabe, "input", function () {
    t[f.name] = eingabe.value;
    zaehlerSetzen();
    geaendert();
  });
  an(eingabe, "change", function () {
    t[f.name] = eingabe.value;
    geaendert();
  });

  kinder.push(eingabe);
  if (f.hilfe) kinder.push(el("span", { class: "hilfe", text: f.hilfe }));
  if (zaehler) kinder.push(zaehler);

  var feld = el("div", { class: "form__feld" }, kinder);
  zaehlerSetzen();
  return feld;
}

/* ---------- 40-sichern.js ---------- */
/* ===========================================================
   Speichern, Anlegen, Übernehmen
   =========================================================== */

/** Prueft, was der Server ohnehin noch einmal prueft - nur frueher. */
function vorabPruefen() {
  for (var i = 0; i < zustand.termine.length; i++) {
    var t = zustand.termine[i];
    if (!String(t.titel || "").trim()) {
      return "Eintrag " + (i + 1) + " braucht einen Titel.";
    }
    if (t.enddatum && t.datum && t.enddatum < t.datum) {
      return "Bei „" + t.titel + "“ liegt das Ende vor dem Anfang.";
    }
    if (t.enddatum && !t.datum) {
      return "Bei „" + t.titel + "“ steht ein Ende, aber kein Anfang.";
    }
    if (t.buchung && !/^https:\/\//.test(t.buchung)) {
      return "Der Buchungslink bei „" + t.titel + "“ muss mit https:// beginnen.";
    }
  }
  return null;
}

async function speichern() {
  var knopf = eins("[data-speichern]");
  var einwand = vorabPruefen();
  if (einwand) { meldung(einwand, "fehler"); return; }

  if (knopf) knopf.disabled = true;
  meldung("Wird gespeichert …");

  var a = await ruf("termine", "PUT", {
    termine: zustand.termine,
    stand: zustand.stand
  });

  if (a.status === 401) { sitzungAbgelaufen(); return; }

  if (!a.ok) {
    meldung(a.daten.fehler || "Das Speichern hat nicht geklappt.", "fehler");
    if (knopf) knopf.disabled = false;
    return;
  }

  zustand.stand = a.daten.stand || 0;
  zustand.termine.sort(nachDatum);
  schmutzigSetzen(false);
  zeichnen();
  meldung("Gespeichert. Die Website zeigt die Änderung innerhalb einer Minute.");
}

function neuerEintrag(art) {
  var t = {};
  for (var k in LEERER_TERMIN) {
    if (Object.prototype.hasOwnProperty.call(LEERER_TERMIN, k)) t[k] = LEERER_TERMIN[k];
  }
  t.art = art || "";
  if (art === "Kochworkshop") { t.zeit = "15:00"; t.ort = "Pinsdorf"; }

  t.__offen = true;          // gleich zum Ausfüllen offen
  zustand.termine.unshift(t);
  schmutzigSetzen(true);
  zeichnen();
  meldung("");

  var erstes = eins(".eintrag .form__feld input");
  if (erstes) erstes.focus();
}

async function ausTabelleUebernehmen() {
  if (zustand.termine.length
      && !confirm("Die bestehenden " + zustand.termine.length + " Einträge werden durch "
                + "die Google-Tabelle ersetzt. Fortfahren?")) return;

  meldung("Tabelle wird gelesen …");
  var a = await ruf("tabelle");

  if (a.status === 401) { sitzungAbgelaufen(); return; }
  if (!a.ok) { meldung(a.daten.fehler || "Die Tabelle war nicht erreichbar.", "fehler"); return; }

  var neue = a.daten.termine || [];
  if (!neue.length) { meldung("Die Tabelle enthält keine Termine.", "fehler"); return; }

  zustand.termine = neue.sort(nachDatum);
  schmutzigSetzen(true);
  zeichnen();
  meldung(neue.length + " Einträge übernommen. Bitte durchsehen und dann speichern. "
        + "Ab dem Speichern liest die Website die Google-Tabelle nicht mehr.");
}

function sichernStarten() {
  an(eins("[data-speichern]"), "click", speichern);
  an(eins("[data-uebernehmen]"), "click", ausTabelleUebernehmen);

  alle("[data-neu]").forEach(function (k) {
    an(k, "click", function () { neuerEintrag(k.dataset.neu); });
  });

  // Mit Strg+S beziehungsweise Cmd+S speichern.
  an(D, "keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      var bereich = eins("[data-verwaltung]");
      if (bereich && !bereich.hidden) { e.preventDefault(); if (zustand.schmutzig) speichern(); }
    }
  });

  // Nicht versehentlich mit ungesicherten Änderungen weggehen.
  an(W, "beforeunload", function (e) {
    if (!zustand.schmutzig) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

/* ---------- 99-start.js ---------- */
/* ---------- Start ---------- */

(function start() {
  anmeldungStarten();
  sichernStarten();
  anmeldungPruefen();
})();

})();
