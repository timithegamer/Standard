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
