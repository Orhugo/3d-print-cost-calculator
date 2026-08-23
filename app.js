"use strict";

/* =========================================================
   app.js — Capa de interfaz (DOM). La lógica vive en core.js.
   ========================================================= */

const C = window.Costes3D;
const MATERIALS = C.MATERIALS;

const STORAGE_KEY = "costes3d_v1";
const $ = (id) => document.getElementById(id);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let LANG = "es";
const makeEur = (lang) => new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-IE",
  { style: "currency", currency: "EUR" });
let eur = makeEur(LANG);

// Traducción con sustitución de {variables}
function t(key, vars) {
  let s = C.I18N[LANG] && C.I18N[LANG][key];
  if (s == null) s = key;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

const COLORS = {
  material: "#4f7cff", energy: "#f59e0b", machine: "#8b5cf6",
  consumables: "#06b6d4", failure: "#ef4444", labor: "#10b981",
};

const FIELDS = [
  "weight", "hours", "minutes", "units",
  "material", "priceKg",
  "power", "priceKwh",
  "machinePrice", "machineLife",
  "prepMin", "postMin", "laborRate",
  "consumables", "failureRate",
  "margin", "iva",
  "diameter", "density",
];

const DEFAULTS = {
  units: 1, power: 120, priceKwh: 0.15,
  machineLife: 5000, diameter: 1.75, density: 1.24,
  material: "PLA", priceKg: 20,
};

const num = (id) => {
  const v = parseFloat($(id).value);
  return isFinite(v) ? v : 0;
};

/* ---------- Selector de materiales ---------- */
function initMaterials() {
  const sel = $("material");
  for (const name of Object.keys(MATERIALS)) {
    const o = document.createElement("option");
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    const m = MATERIALS[sel.value];
    if (m) { $("density").value = m.density; $("priceKg").value = m.price; }
    recalc(); save();
  });
}

/* ---------- Idioma (ES/EN) ---------- */
function applyI18n(lang) {
  LANG = lang === "en" ? "en" : "es";
  eur = makeEur(LANG);
  const dict = C.I18N[LANG];
  const year = new Date().getFullYear();

  document.documentElement.lang = LANG;
  document.title = dict.app_title;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const v = dict[el.getAttribute("data-i18n")];
    if (v != null) el.textContent = String(v).split("{year}").join(year);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const v = dict[el.getAttribute("data-i18n-title")];
    if (v != null) { el.title = v; el.setAttribute("aria-label", v); }
  });
  $("langToggle").textContent = LANG === "es" ? "EN" : "ES";

  // Textos de los perfiles (se construyen por JS)
  document.querySelectorAll(".preset-bar").forEach((bar) => {
    const phKey = bar.getAttribute("data-preset") === "material" ? "preset_material_ph" : "preset_printer_ph";
    const opt0 = bar.querySelector('select option[value=""]');
    if (opt0) opt0.textContent = dict[phKey];
    const save = bar.querySelector(".preset-save"); if (save) save.title = dict.preset_save_title;
    const del = bar.querySelector(".preset-del"); if (del) del.title = dict.preset_del_title;
    const nameRow = bar.nextElementSibling;
    if (nameRow && nameRow.classList.contains("preset-name-row")) {
      nameRow.querySelector("input").placeholder = dict.preset_name_ph;
      nameRow.querySelector(".primary").textContent = dict.preset_save;
    }
  });

  recalc();
}

function initLang() {
  const stored = localStorage.getItem("costes3d_lang");
  const lang = stored ||
    (navigator.language && navigator.language.toLowerCase().startsWith("en") ? "en" : "es");
  applyI18n(lang);
  $("langToggle").addEventListener("click", () => {
    const next = LANG === "es" ? "en" : "es";
    localStorage.setItem("costes3d_lang", next);
    applyI18n(next);
  });
}

/* ---------- Gcode ---------- */
async function readGcodeSlices(file) {
  const CHUNK = 1024 * 1024;
  const head = await file.slice(0, CHUNK).text();
  const tail = file.size > CHUNK ? await file.slice(file.size - CHUNK).text() : "";
  return head + "\n" + tail;
}

function fmtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

async function handleFile(file) {
  if (!file) return;
  const info = $("gcodeInfo");
  info.hidden = false;
  info.innerHTML = `<span class="chip">${t("gc_reading", { name: file.name })}</span>`;

  try {
    const text = await readGcodeSlices(file);
    const g = C.parseGcode(text);
    const grams = C.resolveGrams(g, { diameter: num("diameter"), density: num("density") });

    const chips = [];
    if (g.slicer) chips.push(`<span class="chip">${g.slicer}</span>`);

    if (grams) {
      $("weight").value = Math.round(grams * 100) / 100;
      chips.push(`<span class="chip">${Math.round(grams * 10) / 10} g</span>`);
    } else {
      chips.push(`<span class="chip warn">${t("gc_noweight")}</span>`);
    }

    if (g.seconds) {
      $("hours").value = Math.floor(g.seconds / 3600);
      $("minutes").value = Math.round((g.seconds % 3600) / 60);
      chips.push(`<span class="chip">${fmtTime(g.seconds)}</span>`);
    } else {
      chips.push(`<span class="chip warn">${t("gc_notime")}</span>`);
    }

    if (g.layers) chips.push(`<span class="chip">${t("gc_layers", { n: g.layers })}</span>`);
    if (g.layerHeight) chips.push(`<span class="chip">${t("gc_layerheight", { n: g.layerHeight })}</span>`);
    if (g.colors > 1) chips.push(`<span class="chip warn">${t("gc_colors", { n: g.colors })}</span>`);

    if (g.filamentType) {
      chips.push(`<span class="chip">${g.filamentType}</span>`);
      const match = Object.keys(MATERIALS).find(
        (k) => k.toLowerCase() === g.filamentType.toLowerCase());
      if (match) $("material").value = match;
    }

    info.innerHTML = chips.join("");
    recalc(); save();
  } catch (err) {
    info.innerHTML = `<span class="chip warn">${t("gc_error")}</span>`;
    console.error(err);
  }
}

/* ---------- Precio de la luz (PVPC de hoy, REE) ---------- */
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function fetchPVPC() {
  const btn = $("pvpcBtn"), note = $("pvpcNote");
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = t("pvpc_loading");
  note.hidden = true;
  try {
    const url = `https://api.esios.ree.es/archives/70/download_json?locale=es&date=${todayStr()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const pvpc = C.parsePVPC(await r.json(), "PCB");
    $("priceKwh").value = Math.round(pvpc.avgEurKwh * 100000) / 100000;
    recalc(); save();
    note.hidden = false;
    note.className = "note ok";
    note.textContent = t("pvpc_ok", {
      avg: eur.format(pvpc.avgEurKwh), min: eur.format(pvpc.min),
      max: eur.format(pvpc.max), date: pvpc.date,
    });
  } catch (e) {
    note.hidden = false;
    note.className = "note err";
    note.textContent = t("pvpc_err");
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

/* ---------- Cálculo y pintado ---------- */
function computeNow() {
  const timeH = num("hours") + num("minutes") / 60;
  return C.computeCosts({
    weight: num("weight"), timeH, units: num("units"),
    priceKg: num("priceKg"), power: num("power"), priceKwh: num("priceKwh"),
    machinePrice: num("machinePrice"), machineLife: num("machineLife"),
    prepMin: num("prepMin"), postMin: num("postMin"), laborRate: num("laborRate"),
    consumables: num("consumables"), failureRate: num("failureRate"),
    margin: num("margin"), iva: num("iva"),
  });
}

function recalc() {
  const r = computeNow();

  setLine("outMaterial", "material", r.material);
  setLine("outEnergy", "energy", r.energy);
  setLine("outMachine", "machine", r.machine);
  setLine("outConsumables", "consumables", r.consumables);
  setLine("outFailure", "failure", r.failure);
  setLine("outLabor", "labor", r.labor);

  $("outCost").textContent = eur.format(r.cost);
  setTotal("outMargin", "margin", r.margin);
  setTotal("outIva", "iva", r.iva);
  $("outTotal").textContent = eur.format(r.total);

  const units = Math.max(1, num("units"));
  const perUnitRow = $("perUnitRow");
  if (units > 1) { perUnitRow.hidden = false; $("outPerUnit").textContent = eur.format(r.perUnit); }
  else perUnitRow.hidden = true;

  renderShares(r);
}

function setLine(outId, key, value) {
  const li = document.querySelector(`.breakdown li[data-key="${key}"]`);
  const show = value > 0.0001 || key === "material" || key === "energy";
  if (li) li.hidden = !show;
  $(outId).textContent = eur.format(value);
}

function setTotal(outId, key, value) {
  const row = document.querySelector(`.total-line[data-key="${key}"]`);
  if (row) row.hidden = value <= 0.0001;
  $(outId).textContent = eur.format(value);
}

function renderShares(r) {
  const shares = C.costShares(r);
  for (const s of shares) {
    const el = $("pct" + cap(s.key));
    if (el) el.textContent = s.value > 0.0001 ? Math.round(s.pct) + "%" : "";
  }
  $("donutTotal").textContent = eur.format(r.cost);

  const donut = $("donut");
  const total = shares.reduce((a, s) => a + s.value, 0);
  if (total <= 0) { donut.style.background = "var(--surface-2)"; return; }
  let acc = 0;
  const stops = [];
  for (const s of shares) {
    if (s.value <= 0) continue;
    const start = acc; acc += s.pct;
    stops.push(`${COLORS[s.key]} ${start.toFixed(2)}% ${acc.toFixed(2)}%`);
  }
  donut.style.background = `conic-gradient(${stops.join(", ")})`;
}

/* ---------- Perfiles guardables (impresoras / materiales) ---------- */
const PRESETS = {
  material: { key: "costes3d_mats", fields: ["material", "priceKg", "density", "diameter"] },
  printer:  { key: "costes3d_printers", fields: ["power", "machinePrice", "machineLife"] },
};

function loadPresets(cfg) {
  try { return JSON.parse(localStorage.getItem(cfg.key)) || []; } catch { return []; }
}
function savePresets(cfg, list) { localStorage.setItem(cfg.key, JSON.stringify(list)); }

function initPreset(kind) {
  const cfg = PRESETS[kind];
  const phKey = kind === "material" ? "preset_material_ph" : "preset_printer_ph";
  const bar = document.querySelector(`.preset-bar[data-preset="${kind}"]`);
  if (!bar) return;

  bar.innerHTML =
    `<select class="preset-select"><option value="">${t(phKey)}</option></select>` +
    `<button type="button" class="preset-save" title="${t("preset_save_title")}">💾</button>` +
    `<button type="button" class="preset-del" title="${t("preset_del_title")}" disabled>🗑️</button>`;
  const nameRow = document.createElement("div");
  nameRow.className = "preset-name-row";
  nameRow.hidden = true;
  nameRow.innerHTML =
    `<input type="text" placeholder="${t("preset_name_ph")}" maxlength="30">` +
    `<button type="button" class="primary">${t("preset_save")}</button>` +
    `<button type="button" class="cancel">✕</button>`;
  bar.after(nameRow);

  const sel = bar.querySelector(".preset-select");
  const delBtn = bar.querySelector(".preset-del");
  const nameInput = nameRow.querySelector("input");

  function refresh(selectedName) {
    const list = loadPresets(cfg);
    sel.innerHTML = `<option value="">${t(phKey)}</option>` +
      list.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
    const idx = list.findIndex((p) => p.name === selectedName);
    sel.value = idx >= 0 ? String(idx) : "";
    delBtn.disabled = sel.value === "";
  }

  sel.addEventListener("change", () => {
    delBtn.disabled = sel.value === "";
    if (sel.value === "") return;
    const p = loadPresets(cfg)[+sel.value];
    if (!p) return;
    for (const f of cfg.fields) if (p.values[f] !== undefined) $(f).value = p.values[f];
    recalc(); save();
  });

  bar.querySelector(".preset-save").addEventListener("click", () => {
    nameRow.hidden = false;
    nameInput.value = "";
    nameInput.focus();
  });
  nameRow.querySelector(".cancel").addEventListener("click", () => { nameRow.hidden = true; });
  nameRow.querySelector(".primary").addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const list = loadPresets(cfg);
    const values = {};
    for (const f of cfg.fields) values[f] = $(f).value;
    const existing = list.findIndex((p) => p.name === name);
    if (existing >= 0) list[existing].values = values; else list.push({ name, values });
    savePresets(cfg, list);
    nameRow.hidden = true;
    refresh(name);
  });
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameRow.querySelector(".primary").click(); });

  delBtn.addEventListener("click", () => {
    if (sel.value === "") return;
    const list = loadPresets(cfg);
    list.splice(+sel.value, 1);
    savePresets(cfg, list);
    refresh("");
  });

  refresh("");
}

/* ---------- Exportar presupuesto ---------- */
function buildBudget() {
  const r = computeNow();
  const h = num("hours"), m = num("minutes");
  const timeText = ((h ? h + " h " : "") + (m ? m + " min" : "")).trim() || "0 min";
  return C.buildBudgetText({
    lang: LANG,
    date: new Date().toLocaleDateString(LANG === "es" ? "es-ES" : "en-IE"),
    weightG: num("weight"), timeText, material: $("material").value,
    units: num("units"), marginPct: num("margin"), ivaPct: num("iva"), results: r,
  });
}

function exportNote(msg, cls) {
  const n = $("exportNote");
  n.hidden = false; n.className = "note " + (cls || "");
  n.textContent = msg;
  clearTimeout(exportNote._t);
  exportNote._t = setTimeout(() => { n.hidden = true; }, 3000);
}

function copyBudget() {
  const text = buildBudget();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => exportNote(t("exp_copied"), "ok"))
      .catch(() => exportNote(t("exp_copyfail"), "err"));
  } else {
    exportNote(t("exp_noclip"), "err");
  }
}

function downloadBudget() {
  const filename = t("txt_filename");
  const blob = new Blob([buildBudget()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  exportNote(t("exp_downloading", { file: filename }), "ok");
}

/* ---------- Persistencia ---------- */
function save() {
  const data = {};
  for (const id of FIELDS) data[id] = $(id).value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function load() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
  for (const id of FIELDS) {
    if (data[id] !== undefined && data[id] !== "") $(id).value = data[id];
    else if (DEFAULTS[id] !== undefined) $(id).value = DEFAULTS[id];
  }
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  for (const id of FIELDS) $(id).value = DEFAULTS[id] !== undefined ? DEFAULTS[id] : "";
  $("gcodeInfo").hidden = true;
  $("pvpcNote").hidden = true;
  recalc();
}

/* ---------- Tema ---------- */
function initTheme() {
  const stored = localStorage.getItem("costes3d_theme");
  const dark = stored ? stored === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(dark);
  $("themeToggle").addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") !== "dark";
    applyTheme(isDark);
    localStorage.setItem("costes3d_theme", isDark ? "dark" : "light");
  });
}
function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  $("themeToggle").textContent = dark ? "☀️" : "🌙";
}

/* ---------- Arranque ---------- */
function init() {
  initMaterials();
  initTheme();
  load();
  initPreset("material");
  initPreset("printer");
  initLang();

  for (const id of FIELDS) $(id).addEventListener("input", () => { recalc(); save(); });

  const dz = $("dropzone");
  $("file").addEventListener("change", (e) => handleFile(e.target.files[0]));
  ["dragover", "dragenter"].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", (e) => {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  $("pvpcBtn").addEventListener("click", fetchPVPC);
  $("copyBtn").addEventListener("click", copyBudget);
  $("txtBtn").addEventListener("click", downloadBudget);
  $("printBtn").addEventListener("click", () => window.print());
  $("resetBtn").addEventListener("click", resetAll);

  recalc();
}

document.addEventListener("DOMContentLoaded", init);
