/* ===========================================================
   Termine — laden, sortieren, Vergangenes ausblenden

   Reihenfolge der Quellen:
     1. eigene Serverfunktion -> TABELLE_URL
        Sie liefert, was im Verwaltungsbereich eingetragen ist, und
        faellt selbst auf die Google-Tabelle zurueck.
     2. termine.json neben der Seite
     3. eingebettete Reserve im HTML (#termine-reserve)

   Alles laeuft ueber die eigene Funktion, damit der Browser der
   Besucherin keinen Kontakt zu Google aufnimmt.
   Gepflegt wird ueber /verwaltung.html (siehe TERMINE-PFLEGEN.md).
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
        // Die Serverfunktion liefert fertiges JSON. Sie nimmt, was im
        // Verwaltungsbereich eingetragen ist, und faellt selbst auf die
        // Google-Tabelle zurueck, wenn dort nichts steht.
        var vomServer = await r.json();
        if (vomServer && vomServer.termine && vomServer.termine.length) {
          return { termine: vomServer.termine, quelle: vomServer.quelle || "server" };
        }
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

/* Nur echte Web-Adressen duerfen in ein href. Sonst liesse sich ueber
   eine gepflegte Buchungsadresse ein javascript:-Verweis in die Seite
   schreiben - das Maskieren allein verhindert das nicht. */
function sichereAdresse(wert) {
  var s = String(wert == null ? "" : wert).trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

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
      + (sichereAdresse(t.buchung)
        ? '<a class="knopf knopf--geist knopf--klein" href="' + sicher(sichereAdresse(t.buchung)) + '" target="_blank" rel="noopener noreferrer">Platz buchen</a>'
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
