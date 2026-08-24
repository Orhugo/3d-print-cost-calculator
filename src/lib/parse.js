/* parse.js — Helpers de parseo de bajo nivel (sin DOM). */

// "1d 2h 3m 4s" -> segundos
export function parseHms(str) {
  let s = 0;
  const d = str.match(/(\d+)\s*d/); if (d) s += +d[1] * 86400;
  const h = str.match(/(\d+)\s*h/); if (h) s += +h[1] * 3600;
  const m = str.match(/(\d+)\s*m(?![m])/); if (m) s += +m[1] * 60;
  const sec = str.match(/(\d+)\s*s/); if (sec) s += +sec[1];
  return s;
}

// Suma una lista tipo "3.2, 1.1" (ignora sufijos como "m")
export function sumList(str) {
  return str.split(/[,;]/).reduce((a, x) => a + (parseFloat(x) || 0), 0);
}

// Número español "1.234,56" -> 1234.56
export function parseEsNumber(str) {
  if (typeof str !== "string") return parseFloat(str) || 0;
  return parseFloat(str.trim().replace(/\./g, "").replace(",", ".")) || 0;
}
