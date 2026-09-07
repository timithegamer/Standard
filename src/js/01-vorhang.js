/* ===========================================================
   Vorhang — der Moment vor dem Hero

   Er hält höchstens gut eine Sekunde. Länger warten zu lassen wäre
   Selbstzweck: Wer eine Praxis sucht, will ankommen, nicht zusehen.
   =========================================================== */

function vorhangHeben() {
  var vorhang = eins("#vorhang");
  var koerper = D.body;

  function weg() {
    koerper.classList.remove("haelt");
    if (!vorhang) return;
    vorhang.classList.add("ist-weg");
    // Erst wenn die Bewegung durch ist, aus dem Baum nehmen.
    setTimeout(function () {
      if (vorhang.parentNode) vorhang.parentNode.removeChild(vorhang);
    }, 1500);
  }

  if (!vorhang || ruhig()) {
    if (vorhang && vorhang.parentNode) vorhang.parentNode.removeChild(vorhang);
    koerper.classList.remove("haelt");
    starteHero();
    return;
  }

  koerper.classList.add("haelt");

  var gehoben = false;
  function einmal() {
    if (gehoben) return;
    gehoben = true;
    weg();
    // Der Hero legt kurz nach dem Vorhang los, nicht gleichzeitig.
    setTimeout(starteHero, 220);
  }

  // Fertig, sobald die Seite geladen ist — spätestens aber nach 1,4 s.
  if (D.readyState === "complete") setTimeout(einmal, 420);
  else an(W, "load", function () { setTimeout(einmal, 260); });
  setTimeout(einmal, 1400);
}

/* Der Hero inszeniert sich selbst, sobald der Vorhang oben ist. */
function starteHero() {
  var hero = eins(".hero");
  if (!hero) return;
  hero.classList.add("ist-da");
  alle("[data-hero-folge]", hero).forEach(function (el, i) {
    el.style.setProperty("--verzug", (i * 90) + "ms");
    el.classList.add("ist-da");
  });
  var feld = eins(".hero__feld");
  if (feld) feld.classList.add("ist-da");
}
