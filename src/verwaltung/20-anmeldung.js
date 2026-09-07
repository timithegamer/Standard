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
