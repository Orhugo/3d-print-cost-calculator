/* pvpc.js — Parseo del PVPC (archivo 70 de ESIOS/REE). Devuelve precios en €/kWh. */
import { parseEsNumber } from "./parse.js";

// zone: "PCB" (Península-Canarias-Baleares) o "CYM".
export function parsePVPC(json, zone) {
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
