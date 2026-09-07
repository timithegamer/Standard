/* ===========================================================
   Vollflächiges Menü

   Öffnet als Fläche, die Punkte laufen gestaffelt ein. Beim Öffnen
   wandert der Fokus hinein, beim Schliessen zurück auf den Knopf —
   sonst wäre die Bewegung schön und die Bedienung kaputt.
   =========================================================== */

function menuStarten() {
  var knopf = eins("#menuknopf");
  var menu = eins("#menu");
  if (!knopf || !menu) return;

  var offen = false;
  var vorherFokus = null;

  function zuTun(e) {
    // Tab im offenen Menü darf nicht hinter das Menü fallen.
    if (!offen) return;
    if (e.key === "Escape") { schliessen(); return; }
    if (e.key !== "Tab") return;

    var fangbar = alle('a[href], button:not([disabled])', menu)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!fangbar.length) return;

    var erste = fangbar[0];
    var letzte = fangbar[fangbar.length - 1];
    if (e.shiftKey && D.activeElement === erste) { e.preventDefault(); letzte.focus(); }
    else if (!e.shiftKey && D.activeElement === letzte) { e.preventDefault(); erste.focus(); }
  }

  function oeffnen() {
    offen = true;
    vorherFokus = D.activeElement;
    menu.hidden = false;
    // Ein Bildtakt Pause, damit der Übergang greift statt zu springen.
    W.requestAnimationFrame(function () {
      menu.classList.add("ist-offen");
    });
    knopf.setAttribute("aria-expanded", "true");
    D.body.classList.add("menu-offen", "haelt");
    var erste = eins("a", menu);
    if (erste) setTimeout(function () { erste.focus(); }, 260);
  }

  function schliessen() {
    if (!offen) return;
    offen = false;
    menu.classList.remove("ist-offen");
    knopf.setAttribute("aria-expanded", "false");
    D.body.classList.remove("menu-offen", "haelt");
    setTimeout(function () { if (!offen) menu.hidden = true; }, ruhig() ? 0 : 420);
    if (vorherFokus && vorherFokus.focus) vorherFokus.focus();
  }

  aufraeumen.push(an(knopf, "click", function () { offen ? schliessen() : oeffnen(); }));
  aufraeumen.push(an(menu, "click", function (e) {
    if (e.target.closest("a")) schliessen();
  }));
  aufraeumen.push(an(D, "keydown", zuTun));

  // Wird das Fenster breit genug für die normale Navigation, ist das
  // Menü überflüssig — sonst bliebe eine unsichtbare Falle stehen.
  aufraeumen.push(an(W, "resize", gebremst(function () {
    if (offen && !schmal() && W.innerWidth >= 992) schliessen();
  }, 200)));
}
