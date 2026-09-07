/* ===========================================================
   Start

   Alles, was ohne Netz auskommt, läuft sofort. Die Termine kommen
   danach nach — die Seite ist vorher schon vollständig bedienbar.
   =========================================================== */

(function start() {
  jahrEintragen();
  laufbandFuellen();
  uhrStarten();

  beobachterStarten();
  scrollenStarten();
  weichesScrollenStarten();
  menuStarten();
  zeigerStarten();
  magnetStarten();

  heroFeldStarten();
  leistungenStarten();
  elementeStarten();

  vorhangHeben();

  // Termine und Buchung brauchen das Netz und dürfen den Rest nicht aufhalten.
  (async function nachladen() {
    if (D.getElementById("termine-liste")) {
      try {
        var d = await termineLaden();
        termineZeigen(aufbereiten(d.termine));
      } catch (e) {
        termineZeigen([]);
      }
    }

    var onlineLaeuft = buchungZeigen();

    if (!onlineLaeuft && D.getElementById("plaetze-liste")) {
      try {
        plaetzeZeigen(aufbereiten(await plaetzeLaden()));
      } catch (e) {
        plaetzeZeigen([]);
      }
    }
  })();
})();
