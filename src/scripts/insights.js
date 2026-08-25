/* =========================================================
   insights.js — "Analysis" tab UI (DOM). Reads the slicer's
   comment blocks via src/lib and renders grouped cards, a
   saved-print history/comparator and an exportable print card.
   Pure parsing lives in src/lib/insights.js.
   ========================================================= */
import * as C from "../lib/index.js";

const HISTORY_KEY = "costes3d_insights";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Called by app.js with shared helpers so language/currency stay in sync. */
export function initInsights(deps) {
  const { t, getEur, getLang, fmtTime, getCostContext, getBudgetText } = deps;

  let current = null;        // last parsed insights object
  let currentName = "";      // last file name
  let compareOpen = false;

  /* ---------- value formatters ---------- */
  const tempF = (v) => v + " °C";
  const speedF = (v) => v + " mm/s";
  const mmF = (v) => v + " mm";
  const gramsF = (v) => Math.round(v * 10) / 10 + " g";
  const lenF = (v) => Math.round((v / 1000) * 100) / 100 + " m";
  const volF = (v) => Math.round(v * 100) / 100 + " cm³";

  /* ---------- gcode reading (head + tail, like the calculator) ---------- */
  async function readSlices(file) {
    const CHUNK = 1024 * 1024;
    const head = await file.slice(0, CHUNK).text();
    const tail = file.size > CHUNK ? await file.slice(file.size - CHUNK).text() : "";
    return head + "\n" + tail;
  }

  function note(msg, cls) {
    const n = $("insExportNote");
    if (!n) return;
    n.hidden = false;
    n.className = "note " + (cls || "");
    n.textContent = msg;
    clearTimeout(note._t);
    note._t = setTimeout(() => { n.hidden = true; }, 3000);
  }

  /* ---------- analyze a file (also called from the calculator upload) ---------- */
  async function handleFile(file, { save = true } = {}) {
    if (!file) return;
    if (/\.bgcode$/i.test(file.name)) { note(t("ins_bgcode"), "err"); return; }
    try {
      const text = await readSlices(file);
      const o = C.parseInsights(text);
      if (!o.slicer) o.slicer = C.parseGcode(text).slicer || null;
      current = o;
      currentName = file.name;
      render();
      if (save) saveHistory(o, file.name);
    } catch (e) {
      note(t("gc_error"), "err");
      console.error(e);
    }
  }

  /* ---------- render the grouped cards ---------- */
  function card(titleKey, rows) {
    const items = rows.filter((r) => r[1] != null && r[1] !== "");
    if (!items.length) return "";
    return `<div class="ins-card"><h3>${esc(t(titleKey))}</h3><dl>` +
      items.map(([lk, v]) => `<div><dt>${esc(t(lk))}</dt><dd>${esc(String(v))}</dd></div>`).join("") +
      `</dl></div>`;
  }

  function render() {
    const body = $("insightsBody");
    const empty = $("insightsEmpty");
    renderHistory();
    if (!current) {
      if (body) body.innerHTML = "";
      if (empty) empty.hidden = false;
      toggleCardButtons(false);
      return;
    }
    if (empty) empty.hidden = true;
    toggleCardButtons(true);

    const o = current;
    const eur = getEur();
    const withFirst = (v, first, fmt) =>
      v == null ? null : fmt(v) + (first != null ? ` (${t("c_first")} ${fmt(first)})` : "");
    const yesno = (b) => (b == null ? null : b ? t("c_yes") : t("c_no"));

    const parts = [];
    parts.push(card("ins_sec_summary", [
      ["c_slicer", o.slicer ? o.slicer + (o.slicerVersion ? " " + o.slicerVersion : "") : null],
      ["c_printer", o.printerModel],
      ["c_flavor", o.gcodeFlavor],
      ["c_bed_size", o.bed ? `${o.bed.x} × ${o.bed.y} mm` : null],
      ["c_time", o.time ? fmtTime(o.time) : null],
      ["c_layers", o.layers],
      ["c_max_z", o.maxZ != null ? mmF(o.maxZ) : null],
    ]));
    parts.push(card("ins_sec_material", [
      ["c_fil_type", o.filamentType],
      ["c_fil_name", o.filamentName],
      ["c_vendor", o.filamentVendor],
      ["c_weight", o.grams ? gramsF(o.grams) : null],
      ["c_length", o.lengthMm ? lenF(o.lengthMm) : null],
      ["c_volume", o.volumeCm3 ? volF(o.volumeCm3) : null],
      ["c_density", o.density != null ? o.density + " g/cm³" : null],
      ["c_colors", o.colors > 1 ? o.colors : null],
    ]));
    parts.push(card("ins_sec_temps", [
      ["c_nozzle_t", withFirst(o.nozzleTemp, o.nozzleTempFirst, tempF)],
      ["c_bed_t", withFirst(o.bedTemp, o.bedTempFirst, tempF)],
      ["c_bed_type", o.bedType],
    ]));
    parts.push(card("ins_sec_quality", [
      ["c_layer_h", withFirst(o.layerHeight, o.firstLayerHeight, mmF)],
      ["c_walls", o.wallLoops],
      ["c_top", o.topShell],
      ["c_bottom", o.bottomShell],
      ["c_infill", o.infillDensity && o.infillPattern ? `${o.infillDensity} · ${o.infillPattern}`
        : o.infillDensity || o.infillPattern],
      ["c_wall_seq", o.wallSequence],
      ["c_seam", o.seamPosition],
    ]));
    parts.push(card("ins_sec_speeds", [
      ["c_sp_outer", o.speedOuterWall != null ? speedF(o.speedOuterWall) : null],
      ["c_sp_inner", o.speedInnerWall != null ? speedF(o.speedInnerWall) : null],
      ["c_sp_infill", o.speedInfill != null ? speedF(o.speedInfill) : null],
      ["c_sp_travel", o.speedTravel != null ? speedF(o.speedTravel) : null],
      ["c_sp_first", o.speedFirstLayer != null ? speedF(o.speedFirstLayer) : null],
    ]));
    parts.push(card("ins_sec_support", [
      ["c_sup_on", yesno(o.supportEnabled)],
      ["c_sup_type", o.supportEnabled ? o.supportType : null],
      ["c_sup_style", o.supportEnabled ? o.supportStyle : null],
      ["c_sup_angle", o.supportEnabled && o.supportThreshold != null ? o.supportThreshold + "°" : null],
    ]));
    parts.push(card("ins_sec_other", [
      ["c_brim", o.brimType && o.brimType !== "no_brim" && o.brimWidth
        ? `${o.brimType} · ${o.brimWidth} mm` : o.brimType],
      ["c_skirt", o.skirtLoops != null ? o.skirtLoops : null],
      ["c_retract", o.retractionLength != null ? o.retractionLength + " mm" : null],
      ["c_zhop", o.zHop != null ? o.zHop + " mm" : null],
    ]));

    // Contrast with the calculator's own material cost
    const cc = getCostContext ? getCostContext() : null;
    const contrast = [];
    if (o.slicerCost != null)
      contrast.push(["ins_contrast_slicer", eur.format(o.slicerCost) +
        (o.costPerKg != null ? " · " + t("ins_contrast_hint", { rate: eur.format(o.costPerKg) }) : "")]);
    if (cc && cc.material > 0)
      contrast.push(["ins_contrast_you", eur.format(cc.material) +
        (cc.priceKg ? " · " + eur.format(cc.priceKg) + "/kg" : "")]);
    if (contrast.length) parts.push(card("ins_sec_contrast", contrast));

    const html = parts.join("");
    const bodyEl = $("insightsBody");
    if (bodyEl) bodyEl.innerHTML = html || `<p class="note">${esc(t("ins_thin"))}</p>`;
  }

  function toggleCardButtons(on) {
    ["insCardCopyBtn", "insCardTxtBtn"].forEach((id) => { const b = $(id); if (b) b.disabled = !on; });
  }

  /* ---------- history (localStorage) + comparator ---------- */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  }
  function saveHistory(o, name) {
    const list = loadHistory();
    const snap = {
      id: Date.now(), name, ts: new Date().toISOString(),
      slicer: o.slicer, printer: o.printerModel, filamentType: o.filamentType,
      grams: o.grams || null, lengthMm: o.lengthMm || null, time: o.time || null,
      layers: o.layers || null, maxZ: o.maxZ != null ? o.maxZ : null,
      layerHeight: o.layerHeight != null ? o.layerHeight : null,
      infill: o.infillDensity || null, slicerCost: o.slicerCost != null ? o.slicerCost : null,
    };
    const last = list[0];
    if (last && last.name === name && last.grams === snap.grams && last.time === snap.time)
      list[0] = snap;                    // same print re-analyzed: replace, don't pile up
    else list.unshift(snap);
    savePersist(list.slice(0, 30));
    note(t("ins_saved"), "ok");
    renderHistory();
  }
  function savePersist(list) { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }

  function renderHistory() {
    const wrap = $("insHistoryList");
    if (!wrap) return;
    const list = loadHistory();
    const eur = getEur();
    if (!list.length) {
      wrap.innerHTML = `<p class="note">${esc(t("ins_no_history"))}</p>`;
      if ($("insHistoryActions")) $("insHistoryActions").hidden = true;
      if ($("insCompareWrap")) $("insCompareWrap").hidden = true;
      return;
    }
    if ($("insHistoryActions")) $("insHistoryActions").hidden = false;
    wrap.innerHTML = list.map((s) => {
      const chips = [
        s.time ? `<span class="chip">${esc(fmtTime(s.time))}</span>` : "",
        s.grams ? `<span class="chip">${esc(gramsF(s.grams))}</span>` : "",
        s.slicerCost != null ? `<span class="chip">${esc(eur.format(s.slicerCost))}</span>` : "",
      ].join("");
      const date = new Date(s.ts).toLocaleDateString(getLang() === "es" ? "es-ES" : "en-IE");
      return `<div class="hist-row" data-id="${s.id}">
        <div class="hist-main"><span class="hist-name">${esc(s.name)}</span>
        <span class="hist-date">${esc(date)}</span></div>
        <div class="hist-chips">${chips}</div>
        <button type="button" class="hist-del" data-id="${s.id}" title="✕">🗑️</button></div>`;
    }).join("");
    wrap.querySelectorAll(".hist-del").forEach((b) =>
      b.addEventListener("click", () => {
        savePersist(loadHistory().filter((x) => String(x.id) !== b.getAttribute("data-id")));
        renderHistory();
        if (compareOpen) renderCompare();
      }));
    if (compareOpen) renderCompare();
  }

  function renderCompare() {
    const box = $("insCompareWrap");
    if (!box) return;
    const list = loadHistory();
    if (!compareOpen || list.length < 2) { box.hidden = true; return; }
    box.hidden = false;
    const eur = getEur();
    const rows = [
      ["c_time", (s) => (s.time ? fmtTime(s.time) : "—")],
      ["c_weight", (s) => (s.grams ? gramsF(s.grams) : "—")],
      ["c_slicer_cost", (s) => (s.slicerCost != null ? eur.format(s.slicerCost) : "—")],
      ["c_layers", (s) => (s.layers != null ? s.layers : "—")],
      ["c_layer_h", (s) => (s.layerHeight != null ? mmF(s.layerHeight) : "—")],
      ["c_infill", (s) => s.infill || "—"],
      ["c_fil_type", (s) => s.filamentType || "—"],
    ];
    const head = `<tr><th></th>${list.map((s) =>
      `<th>${esc(s.name.replace(/\.[^.]+$/, ""))}</th>`).join("")}</tr>`;
    const bodyRows = rows.map(([lk, fn]) =>
      `<tr><th>${esc(t(lk))}</th>${list.map((s) => `<td>${esc(String(fn(s)))}</td>`).join("")}</tr>`).join("");
    box.innerHTML = `<div class="compare-scroll"><table class="compare"><thead>${head}</thead><tbody>${bodyRows}</tbody></table></div>`;
  }

  /* ---------- print card export (insights summary + cost quote) ---------- */
  function buildCard() {
    const o = current;
    if (!o) return "";
    const L = [];
    L.push(t("ins_card_title").toUpperCase());
    L.push(new Date().toLocaleString(getLang() === "es" ? "es-ES" : "en-IE"));
    if (currentName) L.push(currentName);
    L.push("");
    if (o.printerModel) L.push(t("c_printer") + ": " + o.printerModel);
    if (o.slicer) L.push(t("c_slicer") + ": " + o.slicer + (o.slicerVersion ? " " + o.slicerVersion : ""));
    const g = [];
    if (o.time) g.push(fmtTime(o.time));
    if (o.layers) g.push(o.layers + " " + t("c_layers").toLowerCase());
    if (o.maxZ != null) g.push("Z " + mmF(o.maxZ));
    if (g.length) L.push(g.join(" · "));
    const mat = [];
    if (o.filamentType) mat.push(o.filamentType);
    if (o.grams) mat.push(gramsF(o.grams));
    if (o.lengthMm) mat.push(lenF(o.lengthMm));
    if (mat.length) L.push(t("ins_sec_material") + ": " + mat.join(" · "));
    if (o.nozzleTemp != null || o.bedTemp != null)
      L.push(t("ins_sec_temps") + ": " + t("c_nozzle_t").toLowerCase() + " " + (o.nozzleTemp ?? "?") + "°C · " +
        t("c_bed_t").toLowerCase() + " " + (o.bedTemp ?? "?") + "°C");
    const q = [];
    if (o.layerHeight != null) q.push(mmF(o.layerHeight));
    if (o.wallLoops != null) q.push(o.wallLoops + " " + t("c_walls").toLowerCase());
    if (o.infillDensity) q.push(o.infillDensity + (o.infillPattern ? " " + o.infillPattern : ""));
    if (q.length) L.push(t("ins_sec_quality") + ": " + q.join(" · "));
    // Append the cost quote from the calculator when available
    const budget = getBudgetText ? getBudgetText() : "";
    if (budget) { L.push(""); L.push("— — —"); L.push(""); L.push(budget); }
    return L.join("\n");
  }

  function copyCard() {
    const text = buildCard();
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(() => note(t("exp_copied"), "ok")).catch(() => note(t("exp_copyfail"), "err"));
    else note(t("exp_noclip"), "err");
  }
  function downloadCard() {
    const filename = t("ins_card_filename");
    const blob = new Blob([buildCard()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    note(t("exp_downloading", { file: filename }), "ok");
  }

  /* ---------- wire up ---------- */
  const dz = $("insightsDropzone");
  if (dz) {
    $("insightsFile").addEventListener("change", (e) => handleFile(e.target.files[0]));
    ["dragover", "dragenter"].forEach((ev) =>
      dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) =>
      dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
  }
  if ($("insCardCopyBtn")) $("insCardCopyBtn").addEventListener("click", copyCard);
  if ($("insCardTxtBtn")) $("insCardTxtBtn").addEventListener("click", downloadCard);
  if ($("insClearBtn")) $("insClearBtn").addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY); renderHistory();
  });
  if ($("insCompareBtn")) $("insCompareBtn").addEventListener("click", () => {
    compareOpen = !compareOpen; renderCompare();
  });

  render();

  // handleFile is exposed so the calculator upload feeds the analysis too (history
  // de-dupes re-analyses of the same print); refresh re-renders in the current language.
  return {
    handleFile: (file) => handleFile(file),
    refresh: () => { render(); },
  };
}
