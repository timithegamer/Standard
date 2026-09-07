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
