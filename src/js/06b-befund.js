/* ===========================================================
   Befund — zwischen den Ansichten umschalten

   Jede der drei Untersuchungen kennt drei Ansichten. Beim Wechsel
   zeichnet sich der Umriss neu — das macht sichtbar, dass hier etwas
   anderes angeschaut wird, statt nur ein Bild gegen ein anderes zu
   tauschen.

   Ohne JavaScript bleibt jeweils die erste Ansicht stehen und die
   Schaltflächen sind ausgeblendet: Der Abschnitt bleibt vollständig
   lesbar, er lässt sich nur nicht umschalten.
   =========================================================== */

function befundStarten() {
  var teile = alle("[data-befund]");
  if (!teile.length) return;

  teile.forEach(function (teil) {
    var bild = eins(".befund__bild", teil);
    var erklaerung = eins("[data-erklaerung]", teil);
    var knoepfe = alle(".befund__modi button", teil);
    if (!bild || !knoepfe.length) return;

    var gruppen = alle("g[data-modus]", bild);
    var aktiv = null;

    /* Den Umriss der neuen Ansicht noch einmal ziehen. Die Länge des
       Pfades steht schon in --laenge; sie wird beim Start einmal
       gemessen, damit hier nichts nachgerechnet werden muss. */
    function nachzeichnen(gruppe) {
      if (ruhig() || !gruppe.animate) return;

      alle("[data-zeichnen]", gruppe).forEach(function (pfad) {
        var laenge = parseFloat(pfad.style.getPropertyValue("--laenge"));
        if (!laenge) {
          try { laenge = pfad.getTotalLength(); } catch (e) { return; }
        }
        if (!laenge) return;

        var dauer = parseInt(pfad.style.getPropertyValue("--zeichendauer"), 10) || 1400;
        var strich = laenge + " " + laenge;

        try {
          pfad.animate(
            [{ strokeDasharray: strich, strokeDashoffset: laenge },
             { strokeDasharray: strich, strokeDashoffset: 0 }],
            { duration: Math.round(dauer * 0.7), easing: "cubic-bezier(.33, 1, .68, 1)" }
          );
        } catch (e) { /* dann eben ohne Nachzeichnen */ }
      });
    }

    function zeigen(modus, vomBenutzer) {
      if (modus === aktiv) return;

      var knopf = null;
      knoepfe.forEach(function (k) {
        var ist = k.dataset.modus === modus;
        k.setAttribute("aria-pressed", String(ist));
        if (ist) knopf = k;
      });
      if (!knopf) return;

      aktiv = modus;

      var neue = null;
      gruppen.forEach(function (g) {
        var ist = g.dataset.modus === modus;
        g.classList.toggle("ist-an", ist);
        if (ist) neue = g;
      });

      if (erklaerung) erklaerung.textContent = knopf.dataset.text || "";
      if (neue && vomBenutzer) nachzeichnen(neue);
    }

    knoepfe.forEach(function (k) {
      aufraeumen.push(an(k, "click", function () { zeigen(k.dataset.modus, true); }));
    });

    // Den Anfangszustand aus der Auszeichnung übernehmen, ohne zu
    // zeichnen — das übernimmt beim ersten Sichtbarwerden der
    // Beobachter über [data-zeichnen].
    var erster = knoepfe.filter(function (k) {
      return k.getAttribute("aria-pressed") === "true";
    })[0] || knoepfe[0];
    aktiv = erster.dataset.modus;
  });
}
