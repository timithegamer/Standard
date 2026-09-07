/* ---------- Jahreszahl, Ortszeit, Laufband ---------- */

function jahrEintragen() {
  alle("[data-jahr]").forEach(function (e) {
    e.textContent = new Date().getFullYear();
  });
}

/* Die Uhr zeigt die Zeit in Pinsdorf, nicht die des Besuchers —
   sonst wäre die Angabe wertlos. */
function uhrStarten() {
  var felder = alle("[data-uhr]");
  if (!felder.length) return;

  var format;
  try {
    format = new Intl.DateTimeFormat("de-AT", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Vienna"
    });
  } catch (e) {
    format = new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function stellen() {
    var t = format.format(new Date());
    felder.forEach(function (f) { f.textContent = t; });
  }

  stellen();
  var uhr = setInterval(stellen, 20000);
  aufraeumen.push(function () { clearInterval(uhr); });
}

/* Das Laufband braucht seinen Inhalt zweimal, damit der Umlauf
   nahtlos ist. Es wird hier verdoppelt statt im HTML — so steht
   der Text nur einmal in der Quelle. */
function laufbandFuellen() {
  alle("[data-laufband]").forEach(function (spur) {
    if (spur.dataset.gefuellt) return;
    spur.innerHTML += spur.innerHTML;
    spur.dataset.gefuellt = "1";
  });
}
