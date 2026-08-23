/* =========================================================
   core.js — Lógica pura (sin DOM), testeable en Node y navegador.
   Se expone como `Costes3D` en el navegador y como module.exports en Node.
   ========================================================= */
(function (global) {
  "use strict";

  // --- Materiales: densidad (g/cm³) y precio orientativo (€/kg) ---
  const MATERIALS = {
    PLA:   { density: 1.24, price: 20 },
    PETG:  { density: 1.27, price: 22 },
    ABS:   { density: 1.04, price: 20 },
    ASA:   { density: 1.07, price: 28 },
    TPU:   { density: 1.21, price: 30 },
    Nylon: { density: 1.14, price: 35 },
    PC:    { density: 1.20, price: 35 },
    HIPS:  { density: 1.04, price: 25 },
    Otro:  { density: 1.24, price: 20 },
  };

  // --- Traducciones (ES/EN). Única fuente de verdad, usada por la UI y el presupuesto. ---
  const I18N = {
    es: {
      app_title: "Calculadora de costes de impresión 3D",
      h1: "Costes de impresión 3D",
      subtitle: "Calcula el coste real de tus impresiones. Todo en tu navegador.",
      theme_toggle: "Cambiar tema", lang_toggle: "Cambiar idioma",
      sec_print: "Datos de la impresión",
      dz_strong: "Sube tu gcode", dz_rest: " o arrástralo aquí",
      lbl_weight: "Peso del filamento", lbl_time: "Tiempo de impresión", lbl_units: "Piezas por impresión",
      sec_material: "Material", lbl_filtype: "Tipo de filamento", lbl_filprice: "Precio del filamento",
      sec_energy: "Energía", lbl_power: "Consumo medio", lbl_light: "Precio de la luz",
      btn_pvpc: "⚡ Usar precio de hoy (PVPC · España)",
      note_printer: "El perfil de impresora guarda potencia, precio y vida útil (amortización).",
      sec_advanced: "Opciones avanzadas",
      leg_amort: "🖨️ Amortización de la máquina", leg_labor: "👷 Mano de obra",
      leg_extras: "➕ Extras", leg_sale: "💰 Venta", leg_gcode: "⚙️ Parámetros del gcode",
      lbl_machineprice: "Precio de la impresora", lbl_machinelife: "Vida útil estimada",
      lbl_prep: "Preparación", lbl_post: "Postprocesado", lbl_laborrate: "Coste por hora",
      lbl_consumables: "Consumibles / desgaste", lbl_failure: "Tasa de fallos",
      lbl_margin: "Margen de beneficio", lbl_iva: "IVA",
      lbl_diameter: "Diámetro del filamento", lbl_density: "Densidad del material",
      note_gcodeparams: "Solo se usan si el gcode no incluye el peso directamente (p. ej. Cura).",
      sec_breakdown: "Desglose de costes",
      bk_material: "Material", bk_energy: "Energía", bk_machine: "Amortización",
      bk_consumables: "Consumibles", bk_failure: "Margen por fallos", bk_labor: "Mano de obra",
      donut_cost: "coste",
      tot_cost: "Coste total", tot_margin: "Margen de beneficio", tot_iva: "IVA",
      tot_price: "Precio de venta (PVP)", tot_perunit: "Por pieza",
      btn_copy: "📋 Copiar", btn_txt: "⬇️ .txt", btn_pdf: "🖨️ PDF", btn_reset: "Reiniciar valores",
      foot: "Hecho para tu servidor · {year} · Los datos no salen de tu navegador",
      gc_reading: "Leyendo {name}…", gc_noweight: "Peso no detectado", gc_notime: "Tiempo no detectado",
      gc_layers: "{n} capas", gc_layerheight: "capa {n} mm", gc_colors: "{n} colores/materiales",
      gc_error: "No se pudo leer el archivo",
      pvpc_loading: "Consultando…",
      pvpc_ok: "PVPC medio de hoy (REE): {avg}/kWh · mín {min} / máx {max} · {date}",
      pvpc_err: "No se pudo obtener el precio (¿sin conexión?). Introdúcelo a mano.",
      preset_material_ph: "— Perfiles de material —", preset_printer_ph: "— Perfiles de impresora —",
      preset_name_ph: "Nombre del perfil…", preset_save: "Guardar",
      preset_save_title: "Guardar valores actuales como perfil", preset_del_title: "Borrar perfil seleccionado",
      exp_copied: "Presupuesto copiado al portapapeles ✓", exp_copyfail: "No se pudo copiar",
      exp_noclip: "El portapapeles no está disponible aquí", exp_downloading: "Descargando {file} ✓",
      txt_filename: "presupuesto-3d.txt",
      b_title: "PRESUPUESTO DE IMPRESIÓN 3D", b_date: "Fecha", b_print: "Impresión",
      b_weight: "Peso filamento", b_time: "Tiempo", b_material: "Material", b_units: "Piezas",
      b_breakdown: "Desglose", b_bk_failure: "Margen por fallos",
      b_cost: "Coste total", b_margin: "Margen", b_iva: "IVA", b_price: "PRECIO DE VENTA", b_perunit: "Por pieza",
    },
    en: {
      app_title: "3D Printing Cost Calculator",
      h1: "3D Printing Costs",
      subtitle: "Work out the real cost of your prints. All in your browser.",
      theme_toggle: "Toggle theme", lang_toggle: "Change language",
      sec_print: "Print details",
      dz_strong: "Upload your G-code", dz_rest: " or drag it here",
      lbl_weight: "Filament weight", lbl_time: "Print time", lbl_units: "Parts per print",
      sec_material: "Material", lbl_filtype: "Filament type", lbl_filprice: "Filament price",
      sec_energy: "Energy", lbl_power: "Average power", lbl_light: "Electricity price",
      btn_pvpc: "⚡ Use today's price (PVPC · Spain)",
      note_printer: "The printer profile saves power, price and lifespan (amortization).",
      sec_advanced: "Advanced options",
      leg_amort: "🖨️ Machine amortization", leg_labor: "👷 Labor",
      leg_extras: "➕ Extras", leg_sale: "💰 Sale", leg_gcode: "⚙️ G-code parameters",
      lbl_machineprice: "Printer price", lbl_machinelife: "Estimated lifespan",
      lbl_prep: "Preparation", lbl_post: "Post-processing", lbl_laborrate: "Hourly cost",
      lbl_consumables: "Consumables / wear", lbl_failure: "Failure rate",
      lbl_margin: "Profit margin", lbl_iva: "VAT",
      lbl_diameter: "Filament diameter", lbl_density: "Material density",
      note_gcodeparams: "Only used if the G-code doesn't include the weight directly (e.g. Cura).",
      sec_breakdown: "Cost breakdown",
      bk_material: "Material", bk_energy: "Energy", bk_machine: "Amortization",
      bk_consumables: "Consumables", bk_failure: "Failure allowance", bk_labor: "Labor",
      donut_cost: "cost",
      tot_cost: "Total cost", tot_margin: "Profit margin", tot_iva: "VAT",
      tot_price: "Sale price", tot_perunit: "Per part",
      btn_copy: "📋 Copy", btn_txt: "⬇️ .txt", btn_pdf: "🖨️ PDF", btn_reset: "Reset values",
      foot: "Made for your server · {year} · Your data never leaves your browser",
      gc_reading: "Reading {name}…", gc_noweight: "Weight not detected", gc_notime: "Time not detected",
      gc_layers: "{n} layers", gc_layerheight: "{n} mm layer", gc_colors: "{n} colors/materials",
      gc_error: "Could not read the file",
      pvpc_loading: "Checking…",
      pvpc_ok: "Today's average PVPC (REE): {avg}/kWh · min {min} / max {max} · {date}",
      pvpc_err: "Couldn't fetch the price (offline?). Enter it manually.",
      preset_material_ph: "— Material profiles —", preset_printer_ph: "— Printer profiles —",
      preset_name_ph: "Profile name…", preset_save: "Save",
      preset_save_title: "Save current values as a profile", preset_del_title: "Delete selected profile",
      exp_copied: "Quote copied to clipboard ✓", exp_copyfail: "Couldn't copy",
      exp_noclip: "Clipboard not available here", exp_downloading: "Downloading {file} ✓",
      txt_filename: "print-cost-3d.txt",
      b_title: "3D PRINTING QUOTE", b_date: "Date", b_print: "Print",
      b_weight: "Filament weight", b_time: "Time", b_material: "Material", b_units: "Parts",
      b_breakdown: "Breakdown", b_bk_failure: "Failure allowance",
      b_cost: "Total cost", b_margin: "Margin", b_iva: "VAT", b_price: "SALE PRICE", b_perunit: "Per part",
    },
  };

  // "1d 2h 3m 4s" -> segundos
  function parseHms(str) {
    let s = 0;
    const d = str.match(/(\d+)\s*d/); if (d) s += +d[1] * 86400;
    const h = str.match(/(\d+)\s*h/); if (h) s += +h[1] * 3600;
    const m = str.match(/(\d+)\s*m(?![m])/); if (m) s += +m[1] * 60;
    const sec = str.match(/(\d+)\s*s/); if (sec) s += +sec[1];
    return s;
  }

  // Suma una lista tipo "3.2, 1.1" (ignora sufijos como "m")
  function sumList(str) {
    return str.split(/[,;]/).reduce((a, x) => a + (parseFloat(x) || 0), 0);
  }

  // Número español "1.234,56" -> 1234.56
  function parseEsNumber(str) {
    if (typeof str !== "string") return parseFloat(str) || 0;
    return parseFloat(str.trim().replace(/\./g, "").replace(",", ".")) || 0;
  }

  // --- Parseo de gcode (comentarios de resumen del slicer) ---
  function parseGcode(text) {
    const out = { grams: 0, seconds: 0, volumeCm3: 0, lengthMm: 0,
                  filamentType: "", slicer: "", layerHeight: 0, layers: 0, colors: 0 };

    if (/PrusaSlicer/i.test(text)) out.slicer = "PrusaSlicer";
    else if (/SuperSlicer/i.test(text)) out.slicer = "SuperSlicer";
    else if (/OrcaSlicer/i.test(text)) out.slicer = "OrcaSlicer";
    else if (/BambuStudio/i.test(text)) out.slicer = "Bambu Studio";
    else if (/Cura/i.test(text)) out.slicer = "Cura";

    let m;
    // Peso (g)
    if ((m = text.match(/filament\s+used\s*\[g\]\s*[:=]\s*([\d.,\s]+)/i)))
      out.grams = sumList(m[1]);
    else if ((m = text.match(/total\s+filament\s+weight\s*\[g\]\s*[:=]\s*([\d.,\s]+)/i)))
      out.grams = sumList(m[1]);

    // Volumen (cm³)
    if ((m = text.match(/filament\s+used\s*\[cm3\]\s*[:=]\s*([\d.,\s]+)/i)))
      out.volumeCm3 = sumList(m[1]);

    // Longitud (mm) — PrusaSlicer da mm; Cura da metros
    if ((m = text.match(/filament\s+used\s*\[mm\]\s*[:=]\s*([\d.,\s]+)/i)))
      out.lengthMm = sumList(m[1]);
    else if ((m = text.match(/;Filament\s+used:\s*([^\n\r;]+)/i)))
      out.lengthMm = sumList(m[1]) * 1000;

    // Tiempo
    if ((m = text.match(/total\s+estimated\s+time[:=]?\s*([0-9dhms\s]+)/i)))
      out.seconds = parseHms(m[1]);
    else if ((m = text.match(/estimated\s+printing\s+time[^=:]*[:=]\s*([0-9dhms\s]+)/i)))
      out.seconds = parseHms(m[1]);
    else if ((m = text.match(/;TIME:\s*(\d+)/i)))
      out.seconds = +m[1];

    // Tipo de filamento
    if ((m = text.match(/;\s*filament_type\s*[:=]\s*([A-Za-z0-9+ ]+)/i)))
      out.filamentType = m[1].split(/[,;]/)[0].trim();

    // Nº de colores / materiales (segmentos de filamento usados)
    let seg;
    if ((seg = text.match(/filament\s+used\s*\[(?:g|mm|cm3)\]\s*[:=]\s*([\d.,\s]+)/i)) ||
        (seg = text.match(/;Filament\s+used:\s*([^\n\r;]+)/i))) {
      out.colors = seg[1].split(/[,;]/)
        .map((s) => parseFloat(s)).filter((v) => isFinite(v) && v > 0).length || 1;
    }

    // Altura de capa (evita first_layer_height exigiendo espacio/; delante)
    if ((m = text.match(/;Layer height:\s*([\d.]+)/i)) ||
        (m = text.match(/[\s;]layer_height\s*[:=]\s*([\d.]+)/i)))
      out.layerHeight = parseFloat(m[1]);

    // Nº de capas
    if ((m = text.match(/total\s+layer\s+number\s*[:=]\s*(\d+)/i)) ||   // Orca/Bambu
        (m = text.match(/;LAYER_COUNT:\s*(\d+)/i)) ||                    // Cura
        (m = text.match(/total\s+layers?\s+count\s*[:=]\s*(\d+)/i)))     // PrusaSlicer
      out.layers = parseInt(m[1], 10);

    return out;
  }

  // Resuelve gramos a partir de lo parseado (convierte volumen/longitud si hace falta)
  function resolveGrams(g, opts) {
    opts = opts || {};
    let grams = g.grams;
    const density = opts.density || 1.24;
    if (!grams && g.volumeCm3) grams = g.volumeCm3 * density;
    if (!grams && g.lengthMm) {
      const r = (opts.diameter || 1.75) / 2;
      grams = (Math.PI * r * r * g.lengthMm) / 1000 * density;
    }
    return grams || 0;
  }

  // --- Cálculo de costes ---
  // inputs: { weight, timeH, units, priceKg, power, priceKwh, machinePrice,
  //           machineLife, prepMin, postMin, laborRate, consumables,
  //           failureRate, margin, iva }
  function computeCosts(i) {
    const n = (x) => (isFinite(+x) ? +x : 0);
    const weight = n(i.weight), timeH = n(i.timeH);
    const units = Math.max(1, n(i.units) || 1);

    const material = (weight / 1000) * n(i.priceKg);
    const energy = (n(i.power) / 1000) * timeH * n(i.priceKwh);
    const machineLife = n(i.machineLife);
    const machine = machineLife > 0 ? (n(i.machinePrice) / machineLife) * timeH : 0;
    const consumables = n(i.consumables);

    const direct = material + energy + machine + consumables;
    const failure = direct * (n(i.failureRate) / 100);
    const labor = ((n(i.prepMin) + n(i.postMin)) / 60) * n(i.laborRate);

    const cost = direct + failure + labor;
    const margin = cost * (n(i.margin) / 100);
    const base = cost + margin;
    const iva = base * (n(i.iva) / 100);
    const total = base + iva;

    return { material, energy, machine, consumables, failure, labor,
             direct, cost, margin, iva, base, total, perUnit: total / units };
  }

  // --- Reparto de costes en % (sobre el coste total) ---
  function costShares(r) {
    const parts = [
      { key: "material", label: "Material", value: r.material },
      { key: "energy", label: "Energía", value: r.energy },
      { key: "machine", label: "Amortización", value: r.machine },
      { key: "consumables", label: "Consumibles", value: r.consumables },
      { key: "failure", label: "Fallos", value: r.failure },
      { key: "labor", label: "Mano de obra", value: r.labor },
    ];
    const total = parts.reduce((a, p) => a + p.value, 0);
    return parts.map((p) => Object.assign(p, { pct: total > 0 ? (p.value / total) * 100 : 0 }));
  }

  // --- Presupuesto en texto plano (ES/EN según o.lang) ---
  function buildBudgetText(o) {
    const lang = o.lang === "en" ? "en" : "es";
    const d = I18N[lang];
    const money = new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-IE",
      { style: "currency", currency: "EUR" });
    const r = o.results;
    const L = [];
    const pad = (label, value) => label.padEnd(22, " ").slice(0, 22) + " " + money.format(value).padStart(11);
    L.push(d.b_title);
    L.push(d.b_date + ": " + (o.date || ""));
    L.push("");
    L.push(d.b_print);
    L.push("  " + d.b_weight + ": " + (o.weightG || 0) + " g");
    L.push("  " + d.b_time + ": " + (o.timeText || "-"));
    if (o.material) L.push("  " + d.b_material + ": " + o.material);
    if ((o.units || 1) > 1) L.push("  " + d.b_units + ": " + o.units);
    L.push("");
    L.push(d.b_breakdown);
    L.push(pad("  " + d.bk_material, r.material));
    L.push(pad("  " + d.bk_energy, r.energy));
    if (r.machine > 0.0001) L.push(pad("  " + d.bk_machine, r.machine));
    if (r.consumables > 0.0001) L.push(pad("  " + d.bk_consumables, r.consumables));
    if (r.failure > 0.0001) L.push(pad("  " + d.b_bk_failure, r.failure));
    if (r.labor > 0.0001) L.push(pad("  " + d.bk_labor, r.labor));
    L.push("  " + "-".repeat(32));
    L.push(pad("  " + d.b_cost, r.cost));
    if (r.margin > 0.0001) L.push(pad("  " + d.b_margin + " (" + (o.marginPct || 0) + "%)", r.margin));
    if (r.iva > 0.0001) L.push(pad("  " + d.b_iva + " (" + (o.ivaPct || 0) + "%)", r.iva));
    L.push("  " + "=".repeat(32));
    L.push(pad("  " + d.b_price, r.total));
    if ((o.units || 1) > 1) L.push(pad("  " + d.b_perunit, r.perUnit));
    return L.join("\n");
  }

  // --- Parseo del PVPC (archivo 70 de ESIOS/REE) ---
  // Devuelve precios en €/kWh. zone: "PCB" (Península-Canarias-Baleares) o "CYM".
  function parsePVPC(json, zone) {
    zone = zone || "PCB";
    const arr = (json && json.PVPC) || [];
    if (!arr.length) throw new Error("Respuesta PVPC vacía");
    const byHour = arr.map((h) => ({
      hour: h.Hora,
      eurKwh: parseEsNumber(h[zone]) / 1000, // el archivo viene en €/MWh
    }));
    const avg = byHour.reduce((a, b) => a + b.eurKwh, 0) / byHour.length;
    return {
      date: arr[0].Dia || "",
      zone,
      avgEurKwh: avg,
      min: Math.min.apply(null, byHour.map((x) => x.eurKwh)),
      max: Math.max.apply(null, byHour.map((x) => x.eurKwh)),
      byHour,
    };
  }

  const Costes3D = {
    MATERIALS, I18N, parseHms, sumList, parseEsNumber,
    parseGcode, resolveGrams, computeCosts, costShares, buildBudgetText, parsePVPC,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Costes3D;
  else global.Costes3D = Costes3D;
})(typeof globalThis !== "undefined" ? globalThis : this);
