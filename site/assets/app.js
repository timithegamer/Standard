/* Erzeugte Datei - nicht direkt bearbeiten.
   Quelle: src/js/*.js
   Bauen:  python3 build.py */
"use strict";
(function () {
/* ---------- 00-hilfen.js ---------- */
/* ===========================================================
   Kleine Helfer

   Bewusst ohne fremde Bibliothek. Die Datenschutzerklärung sagt zu,
   dass diese Website nichts von fremden Servern nachlädt — ein
   Animationspaket vom CDN würde diese Zusage brechen. Alles, was
   hier bewegt wird, bewegt eigener Code über transform und opacity.
   =========================================================== */

var W = window;
var D = document;
var WURZEL = D.documentElement;

function eins(wahl, in_) { return (in_ || D).querySelector(wahl); }
function alle(wahl, in_) { return Array.prototype.slice.call((in_ || D).querySelectorAll(wahl)); }

function an(ziel, art, tu, opt) {
  if (!ziel) return function () {};
  ziel.addEventListener(art, tu, opt);
  return function () { ziel.removeEventListener(art, tu, opt); };
}

function klemme(x, min, max) { return x < min ? min : (x > max ? max : x); }
function misch(a, b, t) { return a + (b - a) * t; }

/* Ist "weniger Bewegung" eingestellt? Wird bei jedem Aufruf frisch
   gelesen, damit ein Wechsel in den Systemeinstellungen sofort greift. */
function ruhig() {
  try { return W.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return false; }
}

/* Echte Maus? Nur dann gibt es Zeiger, Magnetknöpfe und Vorschaubilder. */
function hatMaus() {
  try { return W.matchMedia("(hover: hover) and (pointer: fine)").matches; }
  catch (e) { return false; }
}

function schmal() {
  try { return W.matchMedia("(max-width: 47.999rem)").matches; }
  catch (e) { return W.innerWidth < 768; }
}

/* Ein einziger Bildtakt für die ganze Seite. Jede Bewegung hängt
   sich hier ein, statt einen eigenen Takt zu starten — das spart
   Arbeit und hält die Bewegungen synchron. */
var takter = (function () {
  var kunden = [];
  var laeuft = false;

  function schlag(zeit) {
    laeuft = false;
    for (var i = 0; i < kunden.length; i++) kunden[i](zeit);
    if (kunden.length) { laeuft = true; W.requestAnimationFrame(schlag); }
  }

  return {
    dazu: function (tu) {
      if (kunden.indexOf(tu) === -1) kunden.push(tu);
      if (!laeuft) { laeuft = true; W.requestAnimationFrame(schlag); }
    },
    weg: function (tu) {
      var i = kunden.indexOf(tu);
      if (i > -1) kunden.splice(i, 1);
    }
  };
})();

/* Bremse für teure Handler (Grössenänderung, Scrollen ohne Takt). */
function gebremst(tu, ms) {
  var uhr = null;
  return function () {
    var ich = this, args = arguments;
    if (uhr) clearTimeout(uhr);
    uhr = setTimeout(function () { uhr = null; tu.apply(ich, args); }, ms || 150);
  };
}

/* Text, der aus Daten kommt, wird immer maskiert eingesetzt. */
function sicher(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* Alle Aufräumarbeiten sammeln, damit nichts hängenbleibt. */
var aufraeumen = [];
an(W, "pagehide", function () {
  for (var i = 0; i < aufraeumen.length; i++) { try { aufraeumen[i](); } catch (e) {} }
});

/* Zeigerstand — wird vom Zeiger-Modul gepflegt und von anderen
   Modulen mitgelesen (etwa, um die Kopfzeile hell zu schalten). */
var zeigerX = 0, zeigerY = 0;

/* ---------- 01-vorhang.js ---------- */
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

/* ---------- 02-beobachter.js ---------- */
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

/* ---------- 03-scrollen.js ---------- */
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

/* ---------- 04-menu.js ---------- */
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

/* ---------- 05-zeiger.js ---------- */
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

/* ---------- 06-heroFeld.js ---------- */
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
        takt: 0.00016 + Math.random() * 0.00022,  // Tempo
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

  /* y einer Bahn an der Stelle t (0..1) */
  function bahnY(bahn, t) {
    var grund = hoch * bahn.lage;
    var schwung = hoch * 0.14 * bahn.welle;
    return grund
      + Math.sin(t * Math.PI * 2.1 + bahn.phase + zeit * bahn.takt * 1000) * schwung
      + Math.sin(t * Math.PI * 4.6 + bahn.phase * 1.7) * schwung * 0.28;
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
        var puls = 0.5 + 0.5 * Math.sin(zeit * 0.0011 + b * 1.3 + p * 2.1);
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
    maus.staerke = misch(maus.staerke, maus.ziel || 0, 0.06);
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

/* ---------- 07-leistungen.js ---------- */
/* ===========================================================
   Leistungen: Aufklappen und Vorschau am Zeiger

   Es ist immer genau eine Leistung offen. Das hält den Abschnitt
   ruhig und macht die Liste lesbar, statt sie zur Wand aufzublähen.
   =========================================================== */

function leistungenStarten() {
  var liste = eins("[data-leistungen]");
  if (!liste) return;

  var teile = alle(".leistung", liste);
  if (!teile.length) return;

  teile.forEach(function (teil, i) {
    var kopf = eins(".leistung__kopf", teil);
    var kasten = eins(".leistung__inhalt", teil);
    var innen = eins(".leistung__innen", teil);
    if (!kopf || !kasten || !innen) return;

    var id = "leistung-" + (i + 1);
    kasten.id = id;
    kopf.setAttribute("aria-controls", id);
    kopf.setAttribute("aria-expanded", i === 0 ? "true" : "false");
    teil.classList.toggle("ist-offen", i === 0);
    kasten.style.height = i === 0 ? "auto" : "0px";

    aufraeumen.push(an(kopf, "click", function () { umschalten(teil); }));
  });

  function hoeheSetzen(kasten, innen, auf) {
    if (ruhig()) { kasten.style.height = auf ? "auto" : "0px"; return; }

    if (auf) {
      kasten.style.height = innen.offsetHeight + "px";
      // Nach der Bewegung auf auto, damit sich der Inhalt später
      // frei ausdehnen darf (Bilder, Umbrüche bei Grössenänderung).
      var fertig = function (e) {
        if (e.propertyName !== "height") return;
        kasten.style.height = "auto";
        kasten.removeEventListener("transitionend", fertig);
      };
      kasten.addEventListener("transitionend", fertig);
    } else {
      // Von auto lässt sich nicht animieren: erst den Istwert setzen.
      kasten.style.height = kasten.scrollHeight + "px";
      kasten.offsetHeight;   // Erzwingt den Zwischenstand
      kasten.style.height = "0px";
    }
  }

  function umschalten(teil) {
    var offen = teil.classList.contains("ist-offen");

    teile.forEach(function (t) {
      var kopf = eins(".leistung__kopf", t);
      var kasten = eins(".leistung__inhalt", t);
      var innen = eins(".leistung__innen", t);
      if (!kopf || !kasten || !innen) return;

      var soll = (t === teil) && !offen;
      if (t.classList.contains("ist-offen") === soll) return;

      t.classList.toggle("ist-offen", soll);
      kopf.setAttribute("aria-expanded", String(soll));
      hoeheSetzen(kasten, innen, soll);
    });
  }

  // Bei Grössenänderung stimmt eine feste Höhe nicht mehr.
  aufraeumen.push(an(W, "resize", gebremst(function () {
    teile.forEach(function (t) {
      var kasten = eins(".leistung__inhalt", t);
      if (kasten && t.classList.contains("ist-offen")) kasten.style.height = "auto";
    });
  }, 200)));

  vorschauStarten(liste);
}

/* ---------- Bild, das mit dem Zeiger wandert ---------- */
function vorschauStarten(liste) {
  if (!hatMaus() || ruhig()) return;

  var kasten = D.createElement("div");
  kasten.className = "vorschau";
  kasten.setAttribute("aria-hidden", "true");
  var bild = D.createElement("img");
  bild.alt = "";
  bild.decoding = "async";
  // Ein img ohne Quelle gilt als leeres Bild; bis zum ersten Zeigen
  // steht deshalb ein durchsichtiger Punkt drin.
  bild.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  kasten.appendChild(bild);
  D.body.appendChild(kasten);

  var x = 0, y = 0, zx = 0, zy = 0, an_ = false;

  function schlag() {
    zx = misch(zx, x, 0.14);
    zy = misch(zy, y, 0.14);
    kasten.style.transform = "translate3d(" + (zx - kasten.offsetWidth / 2).toFixed(1) + "px,"
      + (zy - kasten.offsetHeight / 2).toFixed(1) + "px,0)";
  }
  takter.dazu(schlag);
  aufraeumen.push(function () { takter.weg(schlag); });

  aufraeumen.push(an(liste, "mousemove", function (e) { x = e.clientX; y = e.clientY; }, { passive: true }));

  aufraeumen.push(an(liste, "mouseover", function (e) {
    var kopf = e.target.closest ? e.target.closest(".leistung__kopf") : null;
    var teil = kopf ? kopf.closest(".leistung") : null;

    // Ist die Leistung schon offen, steht das Bild ohnehin da —
    // dann wäre die Vorschau nur doppelt.
    if (!teil || teil.classList.contains("ist-offen") || !teil.dataset.bild) {
      if (an_) { an_ = false; kasten.classList.remove("ist-da"); }
      return;
    }
    if (bild.getAttribute("src") !== teil.dataset.bild) bild.src = teil.dataset.bild;
    if (!an_) { an_ = true; zx = x; zy = y; kasten.classList.add("ist-da"); }
  }));

  aufraeumen.push(an(liste, "mouseleave", function () {
    an_ = false;
    kasten.classList.remove("ist-da");
  }));
}

/* ---------- 08-elemente.js ---------- */
/* ===========================================================
   Die fünf Wandlungsphasen — begehbar

   Der Kreis ist bedienbar: mit der Maus, mit dem Finger und mit der
   Tastatur (Pfeiltasten wechseln, Eingabe wählt). Die Inhalte stammen
   eins zu eins von der bisherigen Website — hier wird nichts über
   die chinesische Medizin dazuerfunden.
   =========================================================== */

var ELEMENTE = {
  holz: {
    name: "Holz", han: "木", jahreszeit: "Frühling", organ: "Leber",
    satz: "Freier Energiefluss, Entgiftung, emotionale Balance.",
    text: "Der Frühling steht in der TCM für das Holz-Element und die Leber. Sie sorgt für einen freien Energiefluss, Entgiftung und emotionale Balance."
  },
  feuer: {
    name: "Feuer", han: "火", jahreszeit: "Sommer", organ: "Herz",
    satz: "Lebensfreude und Aktivität — ohne innere Hitze und Unruhe.",
    text: "Im Sommer herrscht das Feuer-Element, das für Lebensfreude, Begeisterung und Aktivität steht. Zu viel Hitze kann jedoch innere Unruhe oder Schlafprobleme verursachen."
  },
  erde: {
    name: "Erde", han: "土", jahreszeit: "Spätsommer", organ: "Milz",
    satz: "Die Mitte: Verdauung, Gewicht, Energie aus der Nahrung.",
    text: "Die Erde bildet unsere innere Mitte. Milz und Magen sind die Quelle unserer Energie — sie entscheiden mit darüber, wie viel Kraft aus dem entsteht, was wir essen."
  },
  metall: {
    name: "Metall", han: "金", jahreszeit: "Herbst", organ: "Lunge",
    satz: "Abwehrkraft, Haut und Atemwege vor dem Winter.",
    text: "Im Herbst stärkt das Metall-Element unsere Abwehrkraft. Die Lunge spielt eine zentrale Rolle für Immunsystem, Haut und Atemwege."
  },
  wasser: {
    name: "Wasser", han: "水", jahreszeit: "Winter", organ: "Niere",
    satz: "Regeneration, Vitalität, innere Stabilität.",
    text: "Der Winter gehört zum Wasser-Element und den Nieren — unserer Kraftquelle für Regeneration, Vitalität und innere Stabilität."
  }
};

var REIHE = ["holz", "feuer", "erde", "metall", "wasser"];

function elementeStarten() {
  var kreis = eins("[data-wuxing]");
  var tafel = eins("[data-wuxing-tafel]");
  if (!kreis || !tafel) return;

  var knoepfe = alle(".wx-knopf", kreis);
  var boegen = alle(".wx-bogen", kreis);
  var wechsel = eins("[data-wuxing-wechsel]", tafel);
  if (!knoepfe.length || !wechsel) return;

  var gewaehlt = null;

  function zeigen(schluessel, weich) {
    var e = ELEMENTE[schluessel];
    if (!e || schluessel === gewaehlt) return;
    gewaehlt = schluessel;

    knoepfe.forEach(function (k) {
      var ist = k.dataset.element === schluessel;
      k.classList.toggle("ist-gewaehlt", ist);
      k.setAttribute("aria-pressed", String(ist));
      k.setAttribute("tabindex", ist ? "0" : "-1");
    });

    // Der Bogen, der aus diesem Element herausführt: er nährt das nächste.
    boegen.forEach(function (b) {
      b.classList.toggle("ist-aktiv", b.dataset.von === schluessel);
    });

    tafel.style.setProperty("--el", "var(--el-" + schluessel + "-h)");

    var naechstes = ELEMENTE[REIHE[(REIHE.indexOf(schluessel) + 1) % REIHE.length]];
    var inhalt =
      '<div class="wxt__kopf">' +
        '<span class="wxt__han han" aria-hidden="true">' + sicher(e.han) + '</span>' +
        '<span>' +
          '<span class="wxt__name">' + sicher(e.name) + '</span><br>' +
          '<span class="wxt__zeit">' + sicher(e.jahreszeit) + ' · ' + sicher(e.organ) + '</span>' +
        '</span>' +
      '</div>' +
      '<p class="wxt__satz">' + sicher(e.satz) + '</p>' +
      '<p class="wxt__text">' + sicher(e.text) + '</p>' +
      '<dl class="wxt__daten">' +
        '<div class="wxt__reihe"><dt>Jahreszeit</dt><dd>' + sicher(e.jahreszeit) + '</dd></div>' +
        '<div class="wxt__reihe"><dt>Organ</dt><dd>' + sicher(e.organ) + '</dd></div>' +
        '<div class="wxt__reihe"><dt>Nährt</dt><dd>' + sicher(naechstes.name) + '</dd></div>' +
      '</dl>';

    if (!weich || ruhig()) { wechsel.innerHTML = inhalt; return; }

    wechsel.classList.add("ist-blass");
    setTimeout(function () {
      wechsel.innerHTML = inhalt;
      wechsel.classList.remove("ist-blass");
    }, 180);
  }

  knoepfe.forEach(function (k, i) {
    var schluessel = k.dataset.element;

    aufraeumen.push(an(k, "click", function () { zeigen(schluessel, true); }));
    aufraeumen.push(an(k, "mouseenter", function () {
      if (hatMaus()) zeigen(schluessel, true);
    }));
    aufraeumen.push(an(k, "focus", function () { zeigen(schluessel, true); }));

    aufraeumen.push(an(k, "keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        zeigen(schluessel, true);
        return;
      }
      var schritt = 0;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") schritt = 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") schritt = -1;
      else return;

      e.preventDefault();
      var ziel = knoepfe[(i + schritt + knoepfe.length) % knoepfe.length];
      if (ziel) ziel.focus();
    }));
  });

  zeigen(knoepfe[0].dataset.element, false);
}

/* ---------- 09-termine.js ---------- */
/* ===========================================================
   Termine — laden, sortieren, Vergangenes ausblenden

   Reihenfolge der Quellen (unverändert gegenüber der bisherigen Seite):
     1. Google-Tabelle über die eigene Serverfunktion  -> TABELLE_URL
     2. termine.json neben der Seite
     3. eingebettete Reserve im HTML (#termine-reserve)

   Die Tabelle wird über die eigene Serverfunktion geholt, damit der
   Browser der Besucherin keinen Kontakt zu Google aufnimmt.
   Gepflegt wird nur Quelle 1 (siehe TERMINE-PFLEGEN.md).
   =========================================================== */

var TABELLE_URL = "/api/plaetze?tabelle=termine";
var PLAETZE_URL = "";   // Tabelle "Freie Termine", falls sie einmal genutzt wird

var WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
var MONATE = ["Jänner", "Februar", "März", "April", "Mai", "Juni",
              "Juli", "August", "September", "Oktober", "November", "Dezember"];

/* ---------- Datum ---------- */

function datumLesen(wert) {
  if (!wert) return null;
  var s = String(wert).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);            // 2026-09-25
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);        // 25.09.2026
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  var d = new Date(s);
  return isNaN(d) ? null : d;
}

function heute() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ---------- CSV ---------- */

function csvLesen(text) {
  var zeilen = [], feld = "", zeile = [], inQuote = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { feld += '"'; i++; }
        else inQuote = false;
      } else feld += c;
    } else if (c === '"') inQuote = true;
    else if (c === ",") { zeile.push(feld); feld = ""; }
    else if (c === "\n") { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; }
    else if (c !== "\r") feld += c;
  }
  if (feld.length || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  if (!zeilen.length) return [];

  var norm = function (s) {
    return s.trim().toLowerCase()
      .replace(/[äöü]/g, function (m) { return { "ä": "a", "ö": "o", "ü": "u" }[m]; })
      .replace(/[^a-z]/g, "");
  };
  var kopf = zeilen[0].map(norm);
  var SCHLUESSEL = {
    datum: "datum", enddatum: "enddatum", uhrzeit: "zeit", zeit: "zeit",
    art: "art", element: "element", titel: "titel",
    beschreibung: "text", text: "text",
    preis: "preis", ort: "ort", leistungen: "leistungen",
    platze: "plaetze", plaetze: "plaetze", status: "plaetze",
    dauer: "dauer", leistung: "leistung", hinweis: "hinweis",
    buchung: "buchung", buchungslink: "buchung", link: "buchung"
  };
  return zeilen.slice(1)
    .filter(function (r) { return r.some(function (z) { return z.trim() !== ""; }); })
    .map(function (r) {
      var o = {};
      kopf.forEach(function (h, i) {
        var k = SCHLUESSEL[h];
        if (k) o[k] = (r[i] || "").trim();
      });
      return o;
    });
}

/* ---------- Laden ---------- */

async function termineLaden() {
  if (TABELLE_URL) {
    try {
      var r = await fetch(TABELLE_URL, { cache: "no-store" });
      if (r.ok) {
        var rows = csvLesen(await r.text());
        if (rows.length) return { termine: rows, quelle: "tabelle" };
      }
    } catch (e) { /* still weiter zur nächsten Quelle */ }
  }
  try {
    var r2 = await fetch("termine.json", { cache: "no-store" });
    if (r2.ok) {
      var d = await r2.json();
      if (d && d.termine) return { termine: d.termine, quelle: "datei" };
    }
  } catch (e) { /* still weiter zur nächsten Quelle */ }

  var el = D.getElementById("termine-reserve");
  if (el) {
    try {
      var d2 = JSON.parse(el.textContent);
      return { termine: d2.termine || [], quelle: "reserve" };
    } catch (e) { /* aufgeben */ }
  }
  return { termine: [], quelle: "keine" };
}

/* ---------- Aufbereiten ---------- */

function aufbereiten(rohe) {
  var grenze = heute();
  return rohe
    .map(function (t) {
      var von = datumLesen(t.datum);
      var bis = datumLesen(t.enddatum) || von;
      var o = {};
      for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) o[k] = t[k];
      o._von = von; o._bis = bis;
      return o;
    })
    .filter(function (t) { return t._von && t._bis >= grenze; })
    .sort(function (a, b) { return a._von - b._von; });
}

/* ---------- Kalendereintrag (.ics) ----------
   Funktioniert mit Kalender auf iPhone und Mac, mit Outlook und Google. */

function icsZeit(d, zeit) {
  var teile = (zeit || "09:00").split(":").map(Number);
  var p = function (n) { return String(n).padStart(2, "0"); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
    + "T" + p(teile[0] || 0) + p(teile[1] || 0) + "00";
}

function icsDatei(o) {
  var stempel = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  var p = function (n) { return String(n).padStart(2, "0"); };
  var tag = function (d) { return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()); };

  var start, ende;
  if (o.ganztaegig) {
    var nachEnde = new Date(o.bis);
    nachEnde.setDate(nachEnde.getDate() + 1);
    start = "DTSTART;VALUE=DATE:" + tag(o.von);
    ende = "DTEND;VALUE=DATE:" + tag(nachEnde);
  } else {
    var hm = (o.zeit || "09:00").split(":").map(Number);
    var schluss = new Date(o.von);
    schluss.setHours((hm[0] || 0) + 4, hm[1] || 0);   // Workshops dauern rund vier Stunden
    start = "DTSTART:" + icsZeit(o.von, o.zeit);
    ende = "DTEND:" + icsZeit(schluss, p(schluss.getHours()) + ":" + p(schluss.getMinutes()));
  }

  var roh = function (s) {
    return String(s || "").replace(/\\/g, "\\\\")
      .replace(/[,;]/g, function (m) { return "\\" + m; })
      .replace(/\n/g, "\\n");
  };
  var zeilen = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sabine Grohe//TCM//DE",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    "UID:" + Date.now() + "-" + Math.random().toString(36).slice(2) + "@tcm-grohe.at",
    "DTSTAMP:" + stempel, start, ende,
    "SUMMARY:" + roh(o.titel),
    "DESCRIPTION:" + roh(o.beschreibung),
    "LOCATION:" + roh(o.ort),
    "END:VEVENT", "END:VCALENDAR"
  ];
  // Zeilenenden nach Norm: CRLF
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(zeilen.join("\r\n"));
}

/* ---------- Darstellen ---------- */

function standSchild(wert) {
  var roh = String(wert == null ? "" : wert).trim();
  var w = roh.toLowerCase();

  // Eine Zahl in der Spalte "Plätze" heisst: so viele sind noch frei.
  // Ab drei oder weniger wird das Schildchen dringlicher eingefärbt.
  var zahl = roh.match(/^(\d+)/);
  if (zahl) {
    var n = parseInt(zahl[1], 10);
    if (n <= 0) return '<span class="stand stand--voll">Ausgebucht</span>';
    var klasse = n <= 3 ? "stand--wenige" : "stand--frei";
    var text = n === 1 ? "1 freier Platz" : n + " freie Plätze";
    return '<span class="stand ' + klasse + '">' + text + "</span>";
  }

  if (w.indexOf("ausgeb") === 0 || w.indexOf("voll") === 0) return '<span class="stand stand--voll">Ausgebucht</span>';
  if (w.indexOf("wenig") === 0) return '<span class="stand stand--wenige">Wenige Plätze</span>';
  if (w.indexOf("frei") === 0) return '<span class="stand stand--frei">Plätze frei</span>';
  return "";
}

function zeitraum(t) {
  var v = t._von, b = t._bis;
  var mehrtaegig = b.getTime() !== v.getTime();

  if (!mehrtaegig) {
    return '<div class="termin__tag">' + v.getDate() + '.</div>'
      + '<div class="termin__monat">' + MONATE[v.getMonth()] + '</div>'
      + '<div class="termin__jahr">' + v.getFullYear() + '</div>'
      + (t.zeit ? '<div class="termin__zeit">ab ' + sicher(t.zeit) + ' Uhr</div>' : "");
  }

  var gleicherMonat = v.getMonth() === b.getMonth();
  return '<div class="termin__tag">' + v.getDate() + '.–' + b.getDate() + '.</div>'
    + '<div class="termin__monat">'
      + (gleicherMonat ? MONATE[v.getMonth()] : MONATE[v.getMonth()] + " / " + MONATE[b.getMonth()])
    + '</div>'
    + '<div class="termin__jahr">' + v.getFullYear() + '</div>'
    + '<div class="termin__zeit">' + (Math.round((b - v) / 864e5) + 1) + ' Tage</div>';
}

function terminHTML(t) {
  var schluessel = (t.element || "").toLowerCase();
  var el = ELEMENTE[schluessel];
  var farbe = el ? "var(--el-" + schluessel + ")" : "var(--el-neutral)";
  var art = t.art || "Termin";

  return '<article class="termin" style="--el:' + farbe + '" data-art="' + sicher(art) + '">'
    + '<div class="termin__wann">' + zeitraum(t) + '</div>'
    + '<div class="termin__was">'
      + '<div class="termin__meta">'
        + '<span class="termin__art">' + sicher(art) + '</span>'
        + (el ? '<span class="termin__element">' + sicher(el.name) + '-Element · ' + sicher(el.jahreszeit) + '</span>' : "")
      + '</div>'
      + '<h3 class="termin__titel">' + sicher(t.titel || "") + '</h3>'
      + (t.text ? '<p class="termin__text">' + sicher(t.text) + '</p>' : "")
      + '<div class="termin__fakten">'
        + (t.preis ? '<span><b>' + sicher(t.preis) + '</b></span>' : "")
        + (t.ort ? '<span>' + sicher(t.ort) + '</span>' : "")
        + (t.leistungen ? '<span>' + sicher(t.leistungen) + '</span>' : "")
      + '</div>'
    + '</div>'
    + '<div class="termin__tat">'
      + standSchild(t.plaetze)
      + (t.buchung
        ? '<a class="knopf knopf--geist knopf--klein" href="' + sicher(t.buchung) + '" target="_blank" rel="noopener noreferrer">Platz buchen</a>'
        : '<button class="knopf knopf--geist knopf--klein" type="button"'
          + ' data-anmeldung="' + sicher(t.titel || art) + '"'
          + ' data-datum="' + sicher(t._von.toLocaleDateString("de-AT")) + '"'
          + ' data-art="' + sicher(art) + '">Anmelden</button>')
      + '<a class="termin__kalender" download="'
        + sicher((t.titel || art).replace(/[^\wäöüßÄÖÜ ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 45))
        + '.ics" href="' + icsDatei({
            titel: t.titel || art,
            beschreibung: (t.text || "") + (t.preis ? "\n\nPreis: " + t.preis : ""),
            ort: t.ort || "",
            von: t._von, bis: t._bis, zeit: t.zeit,
            ganztaegig: t._bis.getTime() !== t._von.getTime()
          }) + '">In den Kalender</a>'
    + '</div>'
  + '</article>';
}

function termineZeigen(liste) {
  var kasten = D.getElementById("termine-liste");
  if (!kasten) return;

  if (!liste.length) {
    kasten.innerHTML = '<div class="termine__leer">'
      + '<p>Zurzeit sind keine Termine ausgeschrieben.</p>'
      + '<p style="margin-top:.6rem"><a href="mailto:sabine.grohe@live.at?subject=Info%20zu%20neuen%20Terminen">Schreiben Sie mir</a>'
      + ' — ich sage Ihnen Bescheid, sobald die nächsten Workshops feststehen.</p>'
      + '</div>';
  } else {
    kasten.innerHTML = liste.map(terminHTML).join("");
    nachbeobachten(kasten);
  }

  aufraeumen.push(an(kasten, "click", function (ev) {
    var b = ev.target.closest("button[data-anmeldung]");
    if (!b) return;
    workshopAnmelden(b.dataset.anmeldung, b.dataset.datum, b.dataset.art);
  }));

  // Filter nur zeigen, wenn es wirklich mehrere Arten gibt.
  var arten = [];
  liste.forEach(function (t) {
    var a = t.art || "Termin";
    if (arten.indexOf(a) === -1) arten.push(a);
  });

  var leiste = D.getElementById("termine-filter");
  if (!leiste) return;

  leiste.hidden = arten.length < 2;
  if (arten.length < 2) return;

  leiste.innerHTML = '<button class="filter" data-f="alle" aria-pressed="true">Alle</button>'
    + arten.map(function (a) {
        return '<button class="filter" data-f="' + sicher(a) + '" aria-pressed="false">' + sicher(a) + "</button>";
      }).join("");

  aufraeumen.push(an(leiste, "click", function (ev) {
    var b = ev.target.closest(".filter");
    if (!b) return;
    alle(".filter", leiste).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    var f = b.dataset.f;
    alle(".termin", kasten).forEach(function (k) {
      k.hidden = !(f === "alle" || k.dataset.art === f);
    });
  }));
}

/* ---------- 10-buchen.js ---------- */
/* ===========================================================
   Online-Buchung (meetergo) und freie Behandlungstermine

   Es ist bewusst nichts von meetergo eingebettet: Die Schaltflächen
   führen auf eine eigene Seite von meetergo. Erst dort werden Daten
   übermittelt — genau so steht es in der Datenschutzerklärung.
   =========================================================== */

var BUCHUNGEN = [
  {
    titel: "TCM Beratung",
    text: "Das ausführliche Erstgespräch mit Pulstastung, Zungenschau und Gesichtsdiagnose. Daraus ergibt sich, welche Methoden für Sie infrage kommen — und ich kann bei Bedarf eine individuelle Kräutermischung erstellen.",
    link: "https://cal.meetergo.com/sabinegrohe/tcm-beratung"
  },
  {
    titel: "Tuina Massage",
    text: "Die traditionelle Heilmassage der chinesischen Medizin — bei Bedarf ergänzt durch Moxa, Schröpfen oder Gua Sha.",
    link: "https://cal.meetergo.com/sabinegrohe/tuina-massage"
  }
];

function buchungZeigen() {
  var kasten = D.getElementById("buchwege");
  if (!kasten) return false;

  if (!BUCHUNGEN.length) { kasten.hidden = true; return false; }

  kasten.hidden = false;
  kasten.innerHTML = BUCHUNGEN.map(function (t) {
    return '<article class="buchkarte">'
      + '<h3 class="buchkarte__titel">' + sicher(t.titel) + '</h3>'
      + '<p class="buchkarte__text">' + sicher(t.text) + '</p>'
      + '<p class="buchkarte__tat">'
        + '<a class="knopf" href="' + sicher(t.link) + '" target="_blank" rel="noopener noreferrer">'
        + '<span class="knopf__text"><span data-schub="Termin wählen">Termin wählen</span></span>'
        + '</a>'
      + '</p>'
    + '</article>';
  }).join("");

  // Solange online gebucht werden kann, wäre eine zweite, von Hand
  // gepflegte Terminliste nur eine Quelle für Doppelbuchungen.
  var liste = D.getElementById("plaetze-liste");
  var fuss = D.getElementById("plaetze-stand");
  if (liste) liste.hidden = true;
  if (fuss) fuss.hidden = true;

  return true;
}

/* ---------- Freie Behandlungstermine (Reserve) ---------- */

async function plaetzeLaden() {
  if (PLAETZE_URL) {
    try {
      var r = await fetch(PLAETZE_URL, { cache: "no-store" });
      if (r.ok) {
        var rows = csvLesen(await r.text());
        if (rows.length) return rows;
      }
    } catch (e) { /* weiter zur nächsten Quelle */ }
  }
  try {
    var r2 = await fetch("freie-termine.json", { cache: "no-store" });
    if (r2.ok) {
      var d = await r2.json();
      if (d && d.termine) return d.termine;
    }
  } catch (e) { /* weiter zur nächsten Quelle */ }

  var el = D.getElementById("plaetze-reserve");
  if (el) {
    try { return (JSON.parse(el.textContent) || {}).termine || []; } catch (e) {}
  }
  return [];
}

function platzHTML(s) {
  var d = s._von;
  var wann = WOCHENTAGE[d.getDay()] + ", " + d.getDate() + ". " + MONATE[d.getMonth()];
  var wunsch = d.toLocaleDateString("de-AT") + " um " + (s.zeit || "") + " Uhr";

  return '<article class="platz">'
    + '<div class="platz__wann">'
      + '<div class="platz__tag">' + sicher(wann) + '</div>'
      + '<div class="platz__zeit">' + sicher(s.zeit || "") + ' Uhr</div>'
    + '</div>'
    + '<div class="platz__was">'
      + '<span>' + sicher(s.leistung || "Behandlungstermin") + '</span>'
      + '<span class="platz__dauer">' + sicher(s.dauer || "")
        + (s.hinweis ? " · " + sicher(s.hinweis) : "") + '</span>'
    + '</div>'
    + '<button class="knopf knopf--geist knopf--klein" type="button"'
      + ' data-wunsch="' + sicher(wunsch) + '"'
      + ' data-leistung="' + sicher(s.leistung || "Behandlungstermin") + '">'
      + 'Diesen Termin anfragen'
    + '</button>'
  + '</article>';
}

function plaetzeZeigen(liste) {
  var kasten = D.getElementById("plaetze-liste");
  var fuss = D.getElementById("plaetze-stand");
  if (!kasten) return;

  if (!liste.length) {
    kasten.innerHTML = '<div class="plaetze__leer">'
      + '<p>Zurzeit sind keine Termine online freigegeben.</p>'
      + '<p style="margin-top:.6rem">Bitte rufen Sie an unter '
      + '<a href="tel:+436765566998">+43 676 5566998</a> — wir finden gemeinsam einen Termin.</p>'
      + '</div>';
    if (fuss) fuss.textContent = "";
    return;
  }

  kasten.innerHTML = liste.map(platzHTML).join("");
  if (fuss) {
    fuss.textContent = liste.length + " freie" + (liste.length === 1 ? "r" : "")
      + " Termin" + (liste.length === 1 ? "" : "e")
      + " · Stand " + new Date().toLocaleDateString("de-AT");
  }

  aufraeumen.push(an(kasten, "click", function (ev) {
    var b = ev.target.closest("button[data-wunsch]");
    if (!b) return;
    terminUebernehmen(b.dataset.wunsch, b.dataset.leistung);
  }));
}

/* ---------- 11-formular.js ---------- */
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

/* ---------- 12-kleinkram.js ---------- */
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

/* ---------- 99-start.js ---------- */
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

})();
