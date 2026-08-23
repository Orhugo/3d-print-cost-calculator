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

  // --- Presupuesto en texto plano ---
  const _eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  function buildBudgetText(o) {
    const r = o.results;
    const L = [];
    const pad = (label, value) => label.padEnd(22, " ").slice(0, 22) + " " + _eur.format(value).padStart(11);
    L.push("PRESUPUESTO DE IMPRESIÓN 3D");
    L.push("Fecha: " + (o.date || ""));
    L.push("");
    L.push("Impresión");
    L.push("  Peso filamento: " + (o.weightG || 0) + " g");
    L.push("  Tiempo: " + (o.timeText || "-"));
    if (o.material) L.push("  Material: " + o.material);
    if ((o.units || 1) > 1) L.push("  Piezas: " + o.units);
    L.push("");
    L.push("Desglose");
    L.push(pad("  Material", r.material));
    L.push(pad("  Energía", r.energy));
    if (r.machine > 0.0001) L.push(pad("  Amortización", r.machine));
    if (r.consumables > 0.0001) L.push(pad("  Consumibles", r.consumables));
    if (r.failure > 0.0001) L.push(pad("  Margen por fallos", r.failure));
    if (r.labor > 0.0001) L.push(pad("  Mano de obra", r.labor));
    L.push("  " + "-".repeat(32));
    L.push(pad("  Coste total", r.cost));
    if (r.margin > 0.0001) L.push(pad("  Margen (" + (o.marginPct || 0) + "%)", r.margin));
    if (r.iva > 0.0001) L.push(pad("  IVA (" + (o.ivaPct || 0) + "%)", r.iva));
    L.push("  " + "=".repeat(32));
    L.push(pad("  PRECIO DE VENTA", r.total));
    if ((o.units || 1) > 1) L.push(pad("  Por pieza", r.perUnit));
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
    MATERIALS, parseHms, sumList, parseEsNumber,
    parseGcode, resolveGrams, computeCosts, costShares, buildBudgetText, parsePVPC,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Costes3D;
  else global.Costes3D = Costes3D;
})(typeof globalThis !== "undefined" ? globalThis : this);
