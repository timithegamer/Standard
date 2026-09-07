/* ===========================================================
   Eigener Zeiger, magnetische Knöpfe, Bildvorschau

   Alles davon gibt es nur mit echter Maus. Auf Touchgeräten wird
   nichts davon eingehängt — kein toter Code, der mitläuft.
   =========================================================== */

function zeigerStarten() {
  if (!hatMaus() || ruhig()) return;

  var huelle = eins("[data-zeiger]");
  var ring = eins("[data-zeiger-ring]");
  var punkt = eins("[data-zeiger-punkt]");
  if (!huelle || !ring || !punkt) return;

  var wortfeld = eins("[data-zeiger-wort]");
  var rx = W.innerWidth / 2, ry = W.innerHeight / 2;
  var px = rx, py = ry;
  zeigerX = rx; zeigerY = ry;

  function schlag() {
    // Der Punkt folgt schnell, der Ring bleibt zurück — daraus
    // entsteht der Eindruck von Trägheit.
    px = misch(px, zeigerX, 0.55);
    py = misch(py, zeigerY, 0.55);
    rx = misch(rx, zeigerX, 0.16);
    ry = misch(ry, zeigerY, 0.16);
    punkt.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0)";
    ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
  }
  takter.dazu(schlag);
  aufraeumen.push(function () { takter.weg(schlag); });

  var wach = false;
  aufraeumen.push(an(W, "mousemove", function (e) {
    zeigerX = e.clientX; zeigerY = e.clientY;
    if (!wach) {
      // Beim ersten Mal ohne Nachlauf setzen, sonst fliegt der Ring
      // quer über den Bildschirm.
      wach = true;
      px = rx = zeigerX; py = ry = zeigerY;
      huelle.classList.add("ist-wach");
    }
  }, { passive: true }));

  aufraeumen.push(an(W, "mousedown", function () { huelle.classList.add("ist-gedrueckt"); }));
  aufraeumen.push(an(W, "mouseup", function () { huelle.classList.remove("ist-gedrueckt"); }));
  aufraeumen.push(an(D, "mouseleave", function () { huelle.classList.remove("ist-wach"); }));
  aufraeumen.push(an(D, "mouseenter", function () { if (wach) huelle.classList.add("ist-wach"); }));

  // Ein einziger Zuhörer statt einer pro Verweis.
  var ANFASSBAR = 'a, button, input, select, textarea, label, [role="button"], .wx-knopf';

  aufraeumen.push(an(D, "mouseover", function (e) {
    var t = e.target.closest ? e.target.closest(ANFASSBAR) : null;
    var mitWort = e.target.closest ? e.target.closest("[data-zeiger-hinweis]") : null;

    huelle.classList.toggle("ist-aktiv", !!t && !mitWort);
    huelle.classList.toggle("hat-wort", !!mitWort);
    if (wortfeld) wortfeld.textContent = mitWort ? (mitWort.dataset.zeigerHinweis || "") : "";
  }, true));
}

/* ---------- Magnetische Knöpfe ---------- */
function magnetStarten() {
  if (!hatMaus() || ruhig()) return;

  alle("[data-magnet]").forEach(function (el) {
    var kraft = parseFloat(el.dataset.magnet) || 0.28;
    var kasten = null;

    function messen() { kasten = el.getBoundingClientRect(); }

    aufraeumen.push(an(el, "mouseenter", function () {
      messen();
      el.classList.add("ist-gefangen");
    }));

    aufraeumen.push(an(el, "mousemove", function (e) {
      if (!kasten) messen();
      var dx = e.clientX - (kasten.left + kasten.width / 2);
      var dy = e.clientY - (kasten.top + kasten.height / 2);
      el.style.setProperty("--mx", (dx * kraft).toFixed(1) + "px");
      el.style.setProperty("--my", (dy * kraft * 0.7).toFixed(1) + "px");
    }));

    aufraeumen.push(an(el, "mouseleave", function () {
      el.classList.remove("ist-gefangen");
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    }));
  });
}
