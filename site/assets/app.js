/* ============================================================
   Termine — lädt, sortiert, blendet Vergangenes aus.

   Reihenfolge der Quellen:
     1. Google-Tabelle (als CSV veröffentlicht)  -> SHEET_CSV_URL
     2. termine.json neben der Seite
     3. eingebettete Reserve im HTML (#termine-fallback)

   Sabine pflegt normalerweise nur Quelle 1.
   ============================================================ */

// Die Termintabelle wird ueber die eigene Serverfunktion geholt, damit der
// Browser der Besucherin keinen Kontakt zu Google aufnimmt. Steht die Funktion
// nicht zur Verfuegung, greift termine.json als Reserve.
const SHEET_CSV_URL = "/api/plaetze?tabelle=termine";

// Tabelle "Freie Termine" (die buchbaren Behandlungstermine)
const SLOTS_CSV_URL = "";

// Online-Terminbuchung über meetergo.
// Jeder Eintrag wird zu einer Karte im Abschnitt "Termin buchen".
// Ist die Liste leer, erscheint stattdessen die Liste der freien Termine
// aus der Tabelle (siehe SLOTS_CSV_URL).
const CAL_TERMINE = [
  {
    titel: "TCM Beratung",
    text: "Das ausführliche Erstgespräch mit Pulstastung, Zungenschau und Gesichtsdiagnose. Daraus ergibt sich, welche Methoden für Sie infrage kommen – und ich kann bei Bedarf eine individuelle Kräutermischung erstellen.",
    link: "https://cal.meetergo.com/sabinegrohe/tcm-beratung"
  },
  {
    titel: "Tuina Massage",
    text: "Die traditionelle Heilmassage der chinesischen Medizin – bei Bedarf ergänzt durch Moxa, Schröpfen oder Gua Sha.",
    link: "https://cal.meetergo.com/sabinegrohe/tuina-massage"
  }
];

const WOCHENTAGE = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];

const MONATE = ["Jänner","Februar","März","April","Mai","Juni",
                "Juli","August","September","Oktober","November","Dezember"];

// Plaetze der Workshops pflegt Sabine von Hand in der Tabelle
// (Spalte "Status"). Es geht dafuer keine Anfrage nach aussen.

const ELEMENTE = {
  holz:   { name: "Holz",   jahreszeit: "Frühling" },
  feuer:  { name: "Feuer",  jahreszeit: "Sommer" },
  erde:   { name: "Erde",   jahreszeit: "Spätsommer" },
  metall: { name: "Metall", jahreszeit: "Herbst" },
  wasser: { name: "Wasser", jahreszeit: "Winter" }
};

/* ---------- Datum ---------- */

function parseDatum(wert) {
  if (!wert) return null;
  const s = String(wert).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);          // 2026-09-25
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);      // 25.09.2026
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function heute() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ---------- CSV ---------- */

function parseCSV(text) {
  const zeilen = [];
  let feld = "", zeile = [], inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
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

  const norm = s => s.trim().toLowerCase().replace(/[äöü]/g, m => ({ "ä":"a","ö":"o","ü":"u" }[m])).replace(/[^a-z]/g, "");
  const kopf = zeilen[0].map(norm);
  const KEY = {
    datum: "datum", enddatum: "enddatum", uhrzeit: "zeit", zeit: "zeit",
    art: "art", element: "element", titel: "titel",
    beschreibung: "text", text: "text",
    preis: "preis", ort: "ort", leistungen: "leistungen",
    platze: "plaetze", plaetze: "plaetze", status: "plaetze",
    dauer: "dauer", leistung: "leistung", hinweis: "hinweis",
    buchung: "buchung", buchungslink: "buchung", link: "buchung"
  };
  return zeilen.slice(1)
    .filter(r => r.some(z => z.trim() !== ""))
    .map(r => {
      const o = {};
      kopf.forEach((h, i) => { const k = KEY[h]; if (k) o[k] = (r[i] || "").trim(); });
      return o;
    });
}

/* ---------- Laden ---------- */

async function ladeTermine() {
  if (SHEET_CSV_URL) {
    try {
      const r = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (r.ok) {
        const rows = parseCSV(await r.text());
        if (rows.length) return { termine: rows, quelle: "tabelle" };
      }
    } catch (e) { /* still weiter zur nächsten Quelle */ }
  }
  try {
    const r = await fetch("termine.json", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (d && d.termine) return { termine: d.termine, quelle: "datei" };
    }
  } catch (e) { /* still weiter zur nächsten Quelle */ }

  const el = document.getElementById("termine-fallback");
  if (el) {
    try {
      const d = JSON.parse(el.textContent);
      return { termine: d.termine || [], quelle: "reserve" };
    } catch (e) { /* aufgeben */ }
  }
  return { termine: [], quelle: "keine" };
}

/* ---------- Aufbereiten ---------- */

function aufbereiten(rohe) {
  const grenze = heute();
  return rohe
    .map(t => {
      const von = parseDatum(t.datum);
      const bis = parseDatum(t.enddatum) || von;
      return { ...t, _von: von, _bis: bis };
    })
    .filter(t => t._von && t._bis >= grenze)
    .sort((a, b) => a._von - b._von);
}

/* ---------- Kalendereintrag (.ics) ----------
   Funktioniert mit Kalender auf iPhone und Mac, mit Outlook und Google. */

function icsZeit(d, zeit) {
  const [h, m] = (zeit || "09:00").split(":").map(Number);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(h || 0)}${p(m || 0)}00`;
}

function icsDatei({ titel, beschreibung, ort, von, bis, zeit, ganztaegig }) {
  const stempel = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const p = n => String(n).padStart(2, "0");
  const tag = d => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;

  let start, ende;
  if (ganztaegig) {
    const nachEnde = new Date(bis); nachEnde.setDate(nachEnde.getDate() + 1);
    start = `DTSTART;VALUE=DATE:${tag(von)}`;
    ende  = `DTEND;VALUE=DATE:${tag(nachEnde)}`;
  } else {
    const [h, m] = (zeit || "09:00").split(":").map(Number);
    const schluss = new Date(von);
    schluss.setHours((h || 0) + 4, m || 0);   // Workshops dauern rund vier Stunden
    start = `DTSTART:${icsZeit(von, zeit)}`;
    ende  = `DTEND:${icsZeit(schluss, `${p(schluss.getHours())}:${p(schluss.getMinutes())}`)}`;
  }

  const roh = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const zeilen = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sabine Grohe//TCM//DE",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@tcm-grohe.at`,
    `DTSTAMP:${stempel}`, start, ende,
    `SUMMARY:${roh(titel)}`,
    `DESCRIPTION:${roh(beschreibung)}`,
    `LOCATION:${roh(ort)}`,
    "END:VEVENT", "END:VCALENDAR"
  ];
  // Zeilenenden nach Norm: CRLF
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(zeilen.join("\r\n"));
}

/* ---------- Rendern ---------- */

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

function statusPill(wert) {
  const roh = String(wert == null ? "" : wert).trim();
  const w = roh.toLowerCase();

  // Eine Zahl in der Spalte "Plätze" heisst: so viele sind noch frei.
  // Ab drei oder weniger wird das Schildchen dringlicher eingefaerbt.
  const zahl = roh.match(/^(\d+)/);
  if (zahl) {
    const n = parseInt(zahl[1], 10);
    if (n <= 0) return '<span class="status status--voll">Ausgebucht</span>';
    const klasse = n <= 3 ? "status--wenige" : "status--frei";
    const text = n === 1 ? "1 freier Platz" : `${n} freie Plätze`;
    return `<span class="status ${klasse}">${text}</span>`;
  }

  if (w.startsWith("ausgeb") || w.startsWith("voll")) return '<span class="status status--voll">Ausgebucht</span>';
  if (w.startsWith("wenig")) return '<span class="status status--wenige">Wenige Plätze</span>';
  if (w.startsWith("frei")) return '<span class="status status--frei">Plätze frei</span>';
  return "";
}

function zeitraum(t) {
  const v = t._von, b = t._bis;
  const mehrtaegig = b.getTime() !== v.getTime();
  if (!mehrtaegig) {
    return `<div class="termin__day">${v.getDate()}.</div>
            <div class="termin__mon">${MONATE[v.getMonth()]}</div>
            <div class="termin__yr">${v.getFullYear()}</div>
            ${t.zeit ? `<div class="termin__time">ab ${esc(t.zeit)} Uhr</div>` : ""}`;
  }
  const gleicherMonat = v.getMonth() === b.getMonth();
  return `<div class="termin__day">${v.getDate()}.–${b.getDate()}.</div>
          <div class="termin__mon">${gleicherMonat ? MONATE[v.getMonth()] : MONATE[v.getMonth()] + " / " + MONATE[b.getMonth()]}</div>
          <div class="termin__yr">${v.getFullYear()}</div>
          <div class="termin__time">${Math.round((b - v) / 864e5) + 1} Tage</div>`;
}

function terminHTML(t) {
  const el = ELEMENTE[(t.element || "").toLowerCase()];
  const farbe = el ? `var(--el-${(t.element || "").toLowerCase()})` : "var(--el-neutral)";
  const art = t.art || "Termin";

  return `
  <article class="termin" style="--el:${farbe}" data-art="${esc(art)}">
    <div class="termin__when">${zeitraum(t)}</div>
    <div class="termin__what">
      <div class="termin__meta">
        <span class="termin__kind">${esc(art)}</span>
        ${el ? `<span class="termin__element">${el.name}-Element · ${el.jahreszeit}</span>` : ""}
      </div>
      <h3 class="termin__title">${esc(t.titel || "")}</h3>
      ${t.text ? `<p class="termin__text">${esc(t.text)}</p>` : ""}
      <div class="termin__facts">
        ${t.preis ? `<span><b>${esc(t.preis)}</b></span>` : ""}
        ${t.ort ? `<span>${esc(t.ort)}</span>` : ""}
        ${t.leistungen ? `<span>${esc(t.leistungen)}</span>` : ""}
      </div>
    </div>
    <div class="termin__cta">
      ${statusPill(t.plaetze)}
      ${t.buchung
        ? `<a class="btn btn--ghost" href="${esc(t.buchung)}" target="_blank" rel="noopener noreferrer">Platz buchen</a>`
        : `<button class="btn btn--ghost" type="button"
                   data-anmeldung="${esc(t.titel || art)}"
                   data-datum="${esc(t._von.toLocaleDateString("de-AT"))}"
                   data-art="${esc(art)}">Anmelden</button>`}
      <a class="termin__kalender" download="${esc((t.titel || art).replace(/[^\wäöüßÄÖÜ ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 45))}.ics"
         href="${icsDatei({
           titel: t.titel || art,
           beschreibung: (t.text || "") + (t.preis ? "\n\nPreis: " + t.preis : ""),
           ort: t.ort || "",
           von: t._von, bis: t._bis, zeit: t.zeit,
           ganztaegig: t._bis.getTime() !== t._von.getTime()
         })}">In den Kalender</a>
    </div>
  </article>`;
}

function render(liste, quelle) {
  const box = document.getElementById("termine-liste");
  const foot = document.getElementById("termine-stand");
  if (!box) return;

  if (!liste.length) {
    box.innerHTML = `<div class="termine__empty">
        <p>Zurzeit sind keine Termine ausgeschrieben.</p>
        <p style="margin-top:.6rem"><a href="mailto:sabine.grohe@live.at?subject=Info%20zu%20neuen%20Terminen">Schreib mir</a> – ich sage dir Bescheid, sobald die nächsten Workshops feststehen.</p>
      </div>`;
  } else {
    box.innerHTML = liste.map(terminHTML).join("");
  }

  // Die Herkunftszeile ("... automatisch aus der Termintabelle") ist
  // Innensicht und hilft Besucherinnen nicht - sie bleibt leer.
  if (foot) foot.textContent = "";

  box.addEventListener("click", ev => {
    const b = ev.target.closest("button[data-anmeldung]");
    if (!b) return;
    workshopAnmelden(b.dataset.anmeldung, b.dataset.datum, b.dataset.art);
  });

  // Filter nur anzeigen, wenn es wirklich mehrere Arten gibt
  const arten = [...new Set(liste.map(t => t.art || "Termin"))];
  const leiste = document.getElementById("termine-filter");
  if (leiste) {
    leiste.hidden = arten.length < 2;
    // Sind die Filter versteckt, ist die ganze Leiste leer - dann faellt
    // sie weg, sonst bliebe eine Trennlinie ohne Inhalt stehen.
    const rahmen = leiste.closest(".termine__toolbar");
    if (rahmen) rahmen.hidden = leiste.hidden;
    if (arten.length >= 2) {
      leiste.innerHTML =
        `<button class="filter" data-f="alle" aria-pressed="true">Alle</button>` +
        arten.map(a => `<button class="filter" data-f="${esc(a)}" aria-pressed="false">${esc(a)}</button>`).join("");
      leiste.addEventListener("click", ev => {
        const b = ev.target.closest(".filter");
        if (!b) return;
        leiste.querySelectorAll(".filter").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        const f = b.dataset.f;
        box.querySelectorAll(".termin").forEach(k => {
          k.style.display = (f === "alle" || k.dataset.art === f) ? "" : "none";
        });
      });
    }
  }
}

/* ---------- Freie Behandlungstermine ---------- */

async function ladeSlots() {
  if (SLOTS_CSV_URL) {
    try {
      const r = await fetch(SLOTS_CSV_URL, { cache: "no-store" });
      if (r.ok) {
        const rows = parseCSV(await r.text());
        if (rows.length) return rows;
      }
    } catch (e) { /* weiter zur naechsten Quelle */ }
  }
  try {
    const r = await fetch("freie-termine.json", { cache: "no-store" });
    if (r.ok) { const d = await r.json(); if (d && d.termine) return d.termine; }
  } catch (e) { /* weiter zur naechsten Quelle */ }

  const el = document.getElementById("slots-fallback");
  if (el) { try { return (JSON.parse(el.textContent) || {}).termine || []; } catch (e) {} }
  return [];
}

function slotHTML(s) {
  const d = s._von;
  const wann = `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`;
  const wunsch = `${d.toLocaleDateString("de-AT")} um ${s.zeit || ""} Uhr`;
  return `
  <article class="slot">
    <div class="slot__wann">
      <div class="slot__tag">${esc(wann)}</div>
      <div class="slot__zeit">${esc(s.zeit || "")} Uhr</div>
    </div>
    <div class="slot__was">
      ${esc(s.leistung || "Behandlungstermin")}
      <span class="slot__dauer">${esc(s.dauer || "")}${s.hinweis ? " · " + esc(s.hinweis) : ""}</span>
    </div>
    <button class="btn btn--ghost" type="button"
            data-wunsch="${esc(wunsch)}"
            data-leistung="${esc(s.leistung || "Behandlungstermin")}">
      Diesen Termin anfragen
    </button>
  </article>`;
}

function slotsRendern(liste) {
  const box = document.getElementById("slots-liste");
  const fuss = document.getElementById("slots-stand");
  if (!box) return;

  if (!liste.length) {
    box.innerHTML = `<div class="slots__leer">
        <p>Zurzeit sind keine Termine online freigegeben.</p>
        <p style="margin-top:.6rem">Bitte rufen Sie an unter
          <a href="tel:+436765566998">+43 676 5566998</a> – wir finden gemeinsam einen Termin.</p>
      </div>`;
    if (fuss) fuss.textContent = "";
    return;
  }

  box.innerHTML = liste.map(slotHTML).join("");
  if (fuss) {
    fuss.textContent = `${liste.length} freie${liste.length === 1 ? "r" : ""} Termin${liste.length === 1 ? "" : "e"} · Stand ${new Date().toLocaleDateString("de-AT")}`;
  }

  box.addEventListener("click", ev => {
    const b = ev.target.closest("button[data-wunsch]");
    if (!b) return;
    terminUebernehmen(b.dataset.wunsch, b.dataset.leistung);
  });
}

/* Formular fuer einen ausgewaehlten Termin vorbereiten.
   Wird von den freien Terminen und von den Workshops benutzt. */
function formularVorbereiten({ anliegen, wunsch, notiz }) {
  const feld = document.getElementById("f-termin");
  const art  = document.getElementById("f-anliegen");
  const form = document.querySelector(".form");
  const ziel = document.getElementById("anfrage");
  if (!feld || !form || !ziel) return;

  feld.value = wunsch;
  if (art && [...art.options].some(o => o.value === anliegen)) art.value = anliegen;

  let hinweis = form.querySelector(".form__uebernommen");
  if (!hinweis) {
    hinweis = document.createElement("p");
    hinweis.className = "form__uebernommen";
    form.prepend(hinweis);
  }
  hinweis.innerHTML = notiz;

  ziel.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => {
    const name = document.getElementById("f-name");
    if (name) name.focus({ preventScroll: true });
  }, 500);
}

function terminUebernehmen(wunsch, leistung) {
  formularVorbereiten({
    anliegen: "Behandlungstermin",
    wunsch,
    notiz: `Gewählter Termin: <strong>${esc(wunsch)}</strong> – ${esc(leistung)}.
            Bitte ergänzen Sie noch Ihren Namen und Ihre Telefonnummer.`
  });
}

function workshopAnmelden(titel, datum, art) {
  formularVorbereiten({
    anliegen: art === "Kur" ? "Kur" : "Kochworkshop",
    wunsch: `${titel} am ${datum}`,
    notiz: `Anmeldung zu: <strong>${esc(titel)}</strong>, ${esc(datum)}.
            Bitte ergänzen Sie Ihren Namen, Ihre Telefonnummer und – falls Sie
            nicht allein kommen – die Anzahl der Personen.`
  });
}

/* ---------- Online-Buchung (meetergo) ---------- */

function onlineBuchungAnzeigen() {
  const box = document.getElementById("online-buchung");
  if (!box) return;
  if (!CAL_TERMINE.length) { box.hidden = true; return; }

  box.hidden = false;
  box.innerHTML = CAL_TERMINE.map(t => `
    <article class="buchkarte">
      <h3 class="buchkarte__titel">${esc(t.titel)}</h3>
      <p class="buchkarte__text">${esc(t.text)}</p>
      <a class="btn" href="${esc(t.link)}" target="_blank" rel="noopener noreferrer">
        Termin wählen
      </a>
    </article>`).join("");

  // Solange online gebucht werden kann, waere eine zweite, von Hand
  // gepflegte Terminliste nur eine Quelle fuer Doppelbuchungen.
  const liste = document.getElementById("slots-liste");
  const fuss  = document.getElementById("slots-stand");
  if (liste) liste.hidden = true;
  if (fuss) fuss.hidden = true;
}

/* ---------- Kleinkram ---------- */

function reveal() {
  const ziele = document.querySelectorAll(".reveal");
  const alleZeigen = () => ziele.forEach(z => z.classList.add("is-in"));

  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    alleZeigen();
    return;
  }

  document.documentElement.classList.add("js");
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .06 });
  ziele.forEach(z => io.observe(z));

  // Sicherheitsnetz: Inhalt darf nie unsichtbar haengen bleiben,
  // etwa wenn der Beobachter im Hintergrund-Tab nicht ausloest.
  setTimeout(alleZeigen, 2500);
}

function jahrEintragen() {
  document.querySelectorAll("[data-jahr]").forEach(e => { e.textContent = new Date().getFullYear(); });
}

/* ---------- Start ---------- */

(async function () {
  jahrEintragen();
  reveal();

  if (document.getElementById("termine-liste")) {
    const { termine, quelle } = await ladeTermine();
    const liste = aufbereiten(termine);
    render(liste, quelle);
  }

  onlineBuchungAnzeigen();

  if (!CAL_TERMINE.length && document.getElementById("slots-liste")) {
    slotsRendern(aufbereiten(await ladeSlots()));
  }
})();
