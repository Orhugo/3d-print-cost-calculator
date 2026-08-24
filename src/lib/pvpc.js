/* pvpc.js — PVPC parsing (ESIOS/REE archive 70). Returns prices in €/kWh. */
import { parseEsNumber } from "./parse.js";

// zone: "PCB" (Península-Canarias-Baleares) or "CYM".
export function parsePVPC(json, zone) {
  zone = zone || "PCB";
  const arr = (json && json.PVPC) || [];
  if (!arr.length) throw new Error("Empty PVPC response");
  const byHour = arr.map((h) => ({
    hour: h.Hora,
    eurKwh: parseEsNumber(h[zone]) / 1000, // the archive comes in €/MWh
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
