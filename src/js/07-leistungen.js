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
