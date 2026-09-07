/* ===========================================================
   Auftauchen beim Scrollen

   Ein einziger Beobachter für die ganze Seite. Jedes Element wird
   genau einmal ausgelöst und danach nicht mehr beobachtet — so
   bleibt beim Scrollen nichts liegen, was Arbeit kostet.
   =========================================================== */

var beobachter = null;

function beobachterStarten() {
  var ziele = alle("[data-heben], [data-folge], [data-teilen], .bildvorhang, [data-linie], [data-zeichnen], .weg, .termin");

  // Gezeichnete Pfade brauchen ihre Länge, bevor sie verschwinden dürfen.
  alle("[data-zeichnen]").forEach(function (pfad) {
    try {
      var l = Math.ceil(pfad.getTotalLength());
      if (l) pfad.style.setProperty("--laenge", l);
    } catch (e) {}
  });

  // Zeilen hinter der Maske laufen gestaffelt ein.
  alle("[data-teilen]").forEach(function (block) {
    alle(".zeile__i", block).forEach(function (zeile, i) {
      zeile.style.setProperty("--verzug", (i * 85) + "ms");
    });
  });

  function alleZeigen() {
    ziele.forEach(function (z) { z.classList.add("ist-da"); });
  }

  if (!("IntersectionObserver" in W) || ruhig()) { alleZeigen(); return; }

  beobachter = new IntersectionObserver(function (eintraege) {
    eintraege.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("ist-da");
      beobachter.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });

  ziele.forEach(function (z) { beobachter.observe(z); });

  // Sicherheitsnetz: Inhalt darf nie unsichtbar hängenbleiben, etwa
  // wenn der Beobachter in einem Hintergrund-Tab nicht auslöst.
  setTimeout(alleZeigen, 3500);

  aufraeumen.push(function () { if (beobachter) beobachter.disconnect(); });
}

/* Elemente, die erst später in den Baum kommen (Termine, freie Plätze),
   melden sich hier nach. */
function nachbeobachten(wurzel) {
  if (!wurzel) return;
  var neue = alle("[data-heben], [data-folge], .termin", wurzel);
  if (!beobachter || ruhig()) {
    neue.forEach(function (z) { z.classList.add("ist-da"); });
    return;
  }
  neue.forEach(function (z) { beobachter.observe(z); });
}
