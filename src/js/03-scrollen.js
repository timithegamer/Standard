/* ===========================================================
   Alles, was am Scrollstand hängt

   Kopfzeile, Lesefortschritt, aktiver Menüpunkt, Parallaxe und der
   Rufbalken teilen sich einen Handler. Es gibt genau einen
   Scroll-Zuhörer, nicht fünf.
   =========================================================== */

function scrollenStarten() {
  var kopf = eins("[data-kopf]");
  var fortschritt = eins("[data-fortschritt]");
  var rufbalken = eins("[data-rufbalken]");
  var navverweise = alle(".kopfnav a[href*='#']");
  var parallaxe = alle("[data-parallax]");

  var letzterStand = W.scrollY;
  var hoehe = 0;
  var sichtHoehe = 0;
  var dunkel = [];      // Bereiche, über denen die Kopfzeile hell wird
  var marken = [];      // Sprungziele für den aktiven Menüpunkt

  function nachmessen() {
    hoehe = D.documentElement.scrollHeight - W.innerHeight;
    sichtHoehe = W.innerHeight;

    dunkel = alle(".abschnitt--tinte, .fuss").map(function (el) {
      var k = el.getBoundingClientRect();
      var oben = k.top + W.scrollY;
      return { oben: oben, unten: oben + k.height };
    });

    marken = navverweise.map(function (a) {
      var id = (a.getAttribute("href") || "").split("#")[1];
      var ziel = id ? D.getElementById(id) : null;
      if (!ziel) return null;
      var k = ziel.getBoundingClientRect();
      return { a: a, oben: k.top + W.scrollY, unten: k.top + W.scrollY + k.height };
    }).filter(Boolean);

    parallaxe.forEach(function (el) {
      var k = el.getBoundingClientRect();
      el._oben = k.top + W.scrollY;
      el._hoch = k.height;
    });
  }

  function anstreichen() {
    var y = W.scrollY;

    /* --- Kopfzeile: fest, weg, hell --- */
    if (kopf) {
      kopf.classList.toggle("ist-fest", y > 24);

      // Nach unten scrollen räumt die Zeile weg — aber nie, solange
      // das Menü offen ist oder man ganz oben steht.
      var runter = y > letzterStand && y > sichtHoehe * 0.65;
      var menuOffen = D.body.classList.contains("menu-offen");
      kopf.classList.toggle("ist-weg", runter && !menuOffen);

      // Hell wird die Zeile, sobald ihre Mitte über einer dunklen Fläche liegt.
      var pruef = y + 34;
      var aufDunkel = dunkel.some(function (b) { return pruef >= b.oben && pruef < b.unten; });
      kopf.classList.toggle("ist-hell", aufDunkel);
      var zeiger = eins("[data-zeiger]");
      if (zeiger) zeiger.classList.toggle("auf-tinte", dunkel.some(function (b) {
        return zeigerY >= b.oben - y && zeigerY < b.unten - y;
      }));
    }

    /* --- Lesefortschritt --- */
    if (fortschritt && hoehe > 0) {
      fortschritt.style.setProperty("--anteil", klemme(y / hoehe, 0, 1).toFixed(4));
    }

    /* --- Rufbalken: erst zeigen, wenn der Hero vorbei ist --- */
    if (rufbalken) rufbalken.classList.toggle("ist-da", y > sichtHoehe * 0.6);

    /* --- Aktiver Menüpunkt --- */
    var aktiv = null;
    var blick = y + sichtHoehe * 0.32;
    for (var i = 0; i < marken.length; i++) {
      if (blick >= marken[i].oben && blick < marken[i].unten) { aktiv = marken[i].a; break; }
    }
    navverweise.forEach(function (a) { a.classList.toggle("ist-hier", a === aktiv); });

    /* --- Parallaxe: nur, was gerade im Bild ist --- */
    if (!ruhig()) {
      for (var j = 0; j < parallaxe.length; j++) {
        var el = parallaxe[j];
        if (el._oben == null) continue;
        var mitte = el._oben + el._hoch / 2 - (y + sichtHoehe / 2);
        if (Math.abs(mitte) > sichtHoehe * 1.4) continue;
        var kraft = parseFloat(el.dataset.parallax) || 0.12;
        el.style.transform = "translate3d(0," + (-mitte * kraft).toFixed(2) + "px,0)";
      }
    }

    letzterStand = y;
  }

  var wartet = false;
  function beiScroll() {
    if (wartet) return;
    wartet = true;
    W.requestAnimationFrame(function () { wartet = false; anstreichen(); });
  }

  nachmessen();
  anstreichen();

  aufraeumen.push(an(W, "scroll", beiScroll, { passive: true }));
  aufraeumen.push(an(W, "resize", gebremst(function () { nachmessen(); anstreichen(); }, 160)));

  // Bilder ändern die Höhe der Seite, wenn sie nachladen.
  aufraeumen.push(an(W, "load", function () { nachmessen(); anstreichen(); }));
  if ("ResizeObserver" in W) {
    var ro = new ResizeObserver(gebremst(function () { nachmessen(); anstreichen(); }, 200));
    ro.observe(D.body);
    aufraeumen.push(function () { ro.disconnect(); });
  }
}

/* ===========================================================
   Weiches Scrollen

   Bewusst knapp eingestellt: Die Seite soll sich geführt anfühlen,
   nicht schwammig. Nur mit echter Maus, nie auf dem Handy, nie bei
   "weniger Bewegung" — und jede Tastatureingabe gibt sofort die
   Kontrolle zurück.
   =========================================================== */

function weichesScrollenStarten() {
  if (!hatMaus() || ruhig() || schmal()) return;

  var ziel = W.scrollY;
  var jetzt = ziel;
  var laeuft = false;
  var eigen = false;
  var STAERKE = 0.16;   // höher = direkter

  function grenze() { return Math.max(0, D.documentElement.scrollHeight - W.innerHeight); }

  function schlag() {
    jetzt = misch(jetzt, ziel, STAERKE);
    if (Math.abs(ziel - jetzt) < 0.35) {
      jetzt = ziel;
      laeuft = false;
      takter.weg(schlag);
    }
    eigen = true;
    // "instant" ist zwingend: Ohne das würde die Regel
    // html { scroll-behavior: smooth } jeden dieser Aufrufe noch einmal
    // weich animieren - die Seite käme dann nur noch im Schritttempo
    // hinterher, weil jedes Bild die Animation des vorigen ablöst.
    W.scrollTo({ top: jetzt, behavior: "instant" });
    eigen = false;
  }

  function los() {
    if (laeuft) return;
    laeuft = true;
    takter.dazu(schlag);
  }

  function halt() {
    laeuft = false;
    takter.weg(schlag);
    ziel = jetzt = W.scrollY;
  }

  aufraeumen.push(an(W, "wheel", function (e) {
    if (e.ctrlKey || e.defaultPrevented) return;                 // Zoomen nicht stören
    if (D.body.classList.contains("menu-offen")) return;         // Menü scrollt selbst
    if (e.target && e.target.closest && e.target.closest("textarea, select, .querscroll, .menu__innen")) return;

    e.preventDefault();
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 18;        // Zeilen
    else if (e.deltaMode === 2) d *= W.innerHeight;  // Seiten

    ziel = klemme(ziel + d, 0, grenze());
    los();
  }, { passive: false }));

  // Tastatur, Sprungmarken und der Fokus scrollen weiterhin nativ.
  aufraeumen.push(an(W, "keydown", halt));
  aufraeumen.push(an(D, "click", function (e) {
    if (e.target && e.target.closest && e.target.closest('a[href*="#"]')) setTimeout(halt, 0);
  }, true));

  aufraeumen.push(an(W, "scroll", function () {
    if (!laeuft && !eigen) { ziel = jetzt = W.scrollY; }
  }, { passive: true }));

  aufraeumen.push(an(W, "resize", halt));
}
