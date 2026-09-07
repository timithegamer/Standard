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
