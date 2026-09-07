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
