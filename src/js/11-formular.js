/* ===========================================================
   Formular vorbereiten

   Wer oben einen Termin oder Workshop anklickt, soll unten nicht
   noch einmal alles eintippen: Anliegen und Wunschtermin stehen
   schon drin, der Fokus sitzt im ersten leeren Feld.
   =========================================================== */

function formularVorbereiten(o) {
  var feld = D.getElementById("f-termin");
  var art = D.getElementById("f-anliegen");
  var form = eins(".form");
  var ziel = D.getElementById("anfrage");
  if (!feld || !form || !ziel) return;

  feld.value = o.wunsch;
  if (art) {
    var passt = Array.prototype.some.call(art.options, function (x) { return x.value === o.anliegen; });
    if (passt) art.value = o.anliegen;
  }

  var hinweis = eins(".form__uebernommen", form);
  if (!hinweis) {
    hinweis = D.createElement("p");
    hinweis.className = "form__uebernommen";
    hinweis.setAttribute("role", "status");
    form.prepend(hinweis);
  }
  hinweis.innerHTML = o.notiz;

  ziel.scrollIntoView({ behavior: ruhig() ? "auto" : "smooth", block: "start" });
  setTimeout(function () {
    var name = D.getElementById("f-name");
    if (name) name.focus({ preventScroll: true });
  }, ruhig() ? 60 : 520);
}

function terminUebernehmen(wunsch, leistung) {
  formularVorbereiten({
    anliegen: "Behandlungstermin",
    wunsch: wunsch,
    notiz: "Gewählter Termin: <strong>" + sicher(wunsch) + "</strong> — " + sicher(leistung)
      + ". Bitte ergänzen Sie noch Ihren Namen und Ihre Telefonnummer."
  });
}

function workshopAnmelden(titel, datum, art) {
  formularVorbereiten({
    anliegen: art === "Kur" ? "Kur" : "Kochworkshop",
    wunsch: titel + " am " + datum,
    notiz: "Anmeldung zu: <strong>" + sicher(titel) + "</strong>, " + sicher(datum)
      + ". Bitte ergänzen Sie Ihren Namen, Ihre Telefonnummer und — falls Sie nicht"
      + " allein kommen — die Anzahl der Personen."
  });
}
