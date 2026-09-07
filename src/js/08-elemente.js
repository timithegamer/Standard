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
