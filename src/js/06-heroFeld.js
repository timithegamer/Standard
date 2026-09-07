/* ===========================================================
   Qi-Feld im Hero

   Sieben Leitbahnen, die langsam durchs Bild ziehen, und darauf
   einzelne Punkte, die im Takt aufleuchten. Das Bild ist nicht
   beliebig: Leitbahnen und Punkte sind das, worum es in der Praxis
   geht. Der Zeiger lenkt die Bahnen sacht ab — mehr nicht, es soll
   ein Feld bleiben, kein Spielzeug.

   Rechenaufwand: rund 400 Punkte je Bild. Ausserhalb des Sichtfelds
   und in einem Hintergrund-Tab steht alles still.
   =========================================================== */

function heroFeldStarten() {
  var flaeche = eins(".hero__feld");
  if (!flaeche || !flaeche.getContext) return;

  var stift = flaeche.getContext("2d", { alpha: true });
  if (!stift) return;

  var breit = 0, hoch = 0, dpr = 1;
  var maus = { x: -9999, y: -9999, staerke: 0 };
  var zeit = 0;
  var sichtbar = true;
  var laeuftGerade = false;

  var wenig = schmal();
  var BAHNEN = wenig ? 4 : 7;
  var PUNKTE_JE_BAHN = wenig ? 26 : 46;
  var REICHWEITE = 190;

  var bahnen = [];

  function aufbauen() {
    bahnen = [];
    for (var b = 0; b < BAHNEN; b++) {
      bahnen.push({
        lage: (b + 0.7) / (BAHNEN + 0.5),        // Höhe im Bild
        welle: 0.35 + Math.random() * 0.5,        // Ausschlag
        // Bogenmass je Sekunde. 0,10 bis 0,24 heisst: eine volle
        // Welle dauert zwischen gut 25 und gut 60 Sekunden. Qi
        // treibt, es flackert nicht.
        takt: 0.10 + Math.random() * 0.14,
        phase: Math.random() * Math.PI * 2,
        dicke: b % 3 === 0 ? 1.35 : 0.8,
        kraft: b % 3 === 0 ? 0.2 : 0.1,           // Deckkraft
        // Zwei bis drei Punkte je Bahn, an festen Stellen
        punkte: [0.22 + Math.random() * 0.12,
                 0.52 + Math.random() * 0.1,
                 0.78 + Math.random() * 0.12]
      });
    }
  }

  function messen() {
    var k = flaeche.getBoundingClientRect();
    dpr = Math.min(W.devicePixelRatio || 1, 2);
    breit = Math.max(1, Math.round(k.width));
    hoch = Math.max(1, Math.round(k.height));
    flaeche.width = Math.round(breit * dpr);
    flaeche.height = Math.round(hoch * dpr);
    stift.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* y einer Bahn an der Stelle t (0..1).
     zeit kommt in Millisekunden herein, gerechnet wird in Sekunden. */
  function bahnY(bahn, t) {
    var s = zeit * 0.001;
    var grund = hoch * bahn.lage;
    var schwung = hoch * 0.14 * bahn.welle;
    return grund
      + Math.sin(t * Math.PI * 2.1 + bahn.phase + s * bahn.takt) * schwung
      + Math.sin(t * Math.PI * 4.6 + bahn.phase * 1.7 + s * bahn.takt * 0.4) * schwung * 0.28;
  }

  function malen() {
    stift.clearRect(0, 0, breit, hoch);

    for (var b = 0; b < bahnen.length; b++) {
      var bahn = bahnen[b];
      var xs = [], ys = [];

      for (var i = 0; i <= PUNKTE_JE_BAHN; i++) {
        var t = i / PUNKTE_JE_BAHN;
        var x = t * breit;
        var y = bahnY(bahn, t);

        // Der Zeiger drückt die Bahn zur Seite, mit weichem Auslauf.
        if (maus.staerke > 0.01) {
          var dx = x - maus.x, dy = y - maus.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < REICHWEITE && d > 0.001) {
            var f = (1 - d / REICHWEITE);
            f = f * f * 26 * maus.staerke;
            y += (dy / d) * f;
            x += (dx / d) * f * 0.35;
          }
        }
        xs.push(x); ys.push(y);
      }

      // Weiche Kurve durch die Stützpunkte
      stift.beginPath();
      stift.moveTo(xs[0], ys[0]);
      for (var j = 1; j < xs.length - 1; j++) {
        var mx = (xs[j] + xs[j + 1]) / 2;
        var my = (ys[j] + ys[j + 1]) / 2;
        stift.quadraticCurveTo(xs[j], ys[j], mx, my);
      }
      stift.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
      stift.strokeStyle = "rgba(86, 113, 35, " + bahn.kraft + ")";
      stift.lineWidth = bahn.dicke;
      stift.stroke();

      // Punkte auf der Bahn
      for (var p = 0; p < bahn.punkte.length; p++) {
        var tp = bahn.punkte[p];
        var idx = Math.round(tp * PUNKTE_JE_BAHN);
        var puls = 0.5 + 0.5 * Math.sin(zeit * 0.00035 + b * 1.3 + p * 2.1);
        var r = 1.6 + puls * 2.2;
        stift.beginPath();
        stift.arc(xs[idx], ys[idx], r, 0, Math.PI * 2);
        stift.fillStyle = "rgba(86, 113, 35, " + (0.1 + puls * 0.3) + ")";
        stift.fill();
      }
    }
  }

  function schlag(t) {
    zeit = t || 0;
    // Die Ablenkung klingt aus, wenn die Maus das Feld verlässt.
    maus.staerke = misch(maus.staerke, maus.ziel || 0, 0.035);
    malen();
  }

  function anwerfen() {
    if (laeuftGerade || !sichtbar) return;
    laeuftGerade = true;
    takter.dazu(schlag);
  }
  function anhalten() {
    if (!laeuftGerade) return;
    laeuftGerade = false;
    takter.weg(schlag);
  }

  aufbauen();
  messen();

  if (ruhig()) {
    // Ein einziges, stehendes Bild — die Zeichnung bleibt, die Bewegung geht.
    malen();
    return;
  }

  anwerfen();

  if (hatMaus()) {
    var hero = eins(".hero");
    aufraeumen.push(an(hero, "mousemove", function (e) {
      var k = flaeche.getBoundingClientRect();
      maus.x = e.clientX - k.left;
      maus.y = e.clientY - k.top;
      maus.ziel = 1;
    }, { passive: true }));
    aufraeumen.push(an(hero, "mouseleave", function () { maus.ziel = 0; }));
  }

  aufraeumen.push(an(W, "resize", gebremst(function () {
    messen();
    if (!laeuftGerade) malen();
  }, 200)));

  // Im Hintergrund-Tab und ausserhalb des Bildes wird nicht gerechnet.
  aufraeumen.push(an(D, "visibilitychange", function () {
    if (D.hidden) anhalten(); else anwerfen();
  }));

  if ("IntersectionObserver" in W) {
    var io = new IntersectionObserver(function (e) {
      sichtbar = e[0].isIntersecting;
      if (sichtbar && !D.hidden) anwerfen(); else anhalten();
    }, { threshold: 0 });
    io.observe(flaeche);
    aufraeumen.push(function () { io.disconnect(); });
  }

  aufraeumen.push(anhalten);
}
