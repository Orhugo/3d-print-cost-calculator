/* gcode.js — Parseo de gcode (comentarios de resumen del slicer) y resolución de gramos. */
import { parseHms, sumList } from "./parse.js";

export function parseGcode(text) {
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
export function resolveGrams(g, opts) {
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
