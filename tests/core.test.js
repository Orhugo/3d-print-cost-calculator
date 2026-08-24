import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/lib/index.js";

const close = (a, b, eps = 0.005) =>
  assert.ok(Math.abs(a - b) < eps, `expected ~${b}, got ${a}`);

/* ---------- parseHms ---------- */
test("parseHms: days, hours, minutes, seconds", () => {
  assert.equal(C.parseHms("1h 43m 12s"), 6192);
  assert.equal(C.parseHms("2h 5m"), 7500);
  assert.equal(C.parseHms("1d 2h"), 93600);
  assert.equal(C.parseHms("45s"), 45);
  assert.equal(C.parseHms("3h 21m 8s"), 12068);
});

/* ---------- sumList / parseEsNumber ---------- */
test("sumList sums multi-extruder and ignores suffixes", () => {
  assert.equal(C.sumList("5.20, 3.10"), 8.3);
  assert.equal(C.sumList("1.5m, 0.8m"), 2.3);
});
test("parseEsNumber: decimal comma and thousands", () => {
  close(C.parseEsNumber("202,92"), 202.92);
  close(C.parseEsNumber("1.234,56"), 1234.56);
});

/* ---------- parseGcode by slicer ---------- */
const G = {
  prusa: `; PrusaSlicer 2.7.1
; filament used [mm] = 3251.24
; filament used [cm3] = 7.82
; filament used [g] = 9.70
; filament_type = PETG
; first_layer_height = 0.25
; layer_height = 0.2
; total layers count = 128
; estimated printing time (normal mode) = 1h 43m 12s`,
  prusaMulti: `; PrusaSlicer
; filament used [g] = 5.20, 3.10
; estimated printing time (normal mode) = 2h 5m`,
  orca: `; OrcaSlicer 1.9
; filament used [g] : 24.66
; total estimated time: 3h 21m 8s
; total layer number: 250
; filament_type = PLA`,
  cura: `;Generated with Cura_SteamEngine 5.6
;TIME:6183
;Filament used: 4.09221m`,
  curaMulti: `;Cura
;TIME:1200
;Filament used: 1.5m, 0.8m`,
};

test("parseGcode PrusaSlicer", () => {
  const g = C.parseGcode(G.prusa);
  assert.equal(g.slicer, "PrusaSlicer");
  close(g.grams, 9.70);
  assert.equal(g.seconds, 6192);
  assert.equal(g.filamentType, "PETG");
  assert.equal(g.layerHeight, 0.2);      // doesn't pick up first_layer_height (0.25)
  assert.equal(g.layers, 128);
  assert.equal(g.colors, 1);
});
test("parseGcode PrusaSlicer multi-material sums weights and counts colors", () => {
  const g = C.parseGcode(G.prusaMulti);
  close(g.grams, 8.30);
  assert.equal(g.seconds, 7500);
  assert.equal(g.colors, 2);
});
test("parseGcode detects layer count (Orca)", () => {
  assert.equal(C.parseGcode(G.orca).layers, 250);
});
test("parseGcode OrcaSlicer uses 'total estimated time'", () => {
  const g = C.parseGcode(G.orca);
  assert.equal(g.slicer, "OrcaSlicer");
  close(g.grams, 24.66);
  assert.equal(g.seconds, 12068);
  assert.equal(g.filamentType, "PLA");
});
test("parseGcode Cura: time in seconds and length in meters", () => {
  const g = C.parseGcode(G.cura);
  assert.equal(g.slicer, "Cura");
  assert.equal(g.grams, 0);          // Cura doesn't give grams directly
  close(g.lengthMm, 4092.21, 0.5);
  assert.equal(g.seconds, 6183);
});
test("parseGcode Cura multi sums lengths", () => {
  const g = C.parseGcode(G.curaMulti);
  close(g.lengthMm, 2300, 0.5);
});

/* ---------- resolveGrams (length -> grams conversion) ---------- */
test("resolveGrams converts Cura length to grams", () => {
  const g = C.parseGcode(G.cura);
  const grams = C.resolveGrams(g, { diameter: 1.75, density: 1.24 });
  close(grams, 12.205, 0.02);        // ~12.2 g of PLA for 4.09 m
});
test("resolveGrams prefers grams when already present", () => {
  const g = C.parseGcode(G.prusa);
  assert.equal(C.resolveGrams(g, { density: 1.24 }), 9.70);
});

/* ---------- computeCosts ---------- */
test("computeCosts: full example", () => {
  const r = C.computeCosts({
    weight: 25, timeH: 3.5, units: 1,
    priceKg: 20, power: 120, priceKwh: 0.15,
    machinePrice: 400, machineLife: 5000,
    prepMin: 10, postMin: 15, laborRate: 12,
    consumables: 0, failureRate: 5, margin: 30, iva: 21,
  });
  close(r.material, 0.50);
  close(r.energy, 0.063);
  close(r.machine, 0.28);
  close(r.failure, 0.0421);
  close(r.labor, 5.00);
  close(r.cost, 5.885);
  close(r.margin, 1.7655);
  close(r.iva, 1.6072);
  close(r.total, 9.258);
});
test("computeCosts: no data = 0", () => {
  const r = C.computeCosts({});
  assert.equal(r.total, 0);
  assert.equal(r.perUnit, 0);
});
test("computeCosts: per-part cost divides by units", () => {
  const r = C.computeCosts({ weight: 100, timeH: 1, priceKg: 20, units: 4 });
  close(r.total, 2.0);               // 100g * 20/kg = 2€ (energy 0)
  close(r.perUnit, 0.5);
});
test("computeCosts: no lifespan means no amortization (no divide by 0)", () => {
  const r = C.computeCosts({ weight: 10, timeH: 5, priceKg: 20, machinePrice: 500, machineLife: 0 });
  assert.equal(r.machine, 0);
  assert.ok(isFinite(r.total));
});

/* ---------- costShares ---------- */
test("costShares: percentages add up to 100 and keep proportions", () => {
  const r = C.computeCosts({ weight: 100, timeH: 1, priceKg: 20, prepMin: 0, laborRate: 0 });
  const shares = C.costShares(r);
  const sum = shares.reduce((a, s) => a + s.pct, 0);
  close(sum, 100, 0.01);
  const material = shares.find((s) => s.key === "material");
  close(material.pct, 100, 0.01);        // only material
});
test("costShares: all zero doesn't divide by zero", () => {
  const shares = C.costShares(C.computeCosts({}));
  assert.ok(shares.every((s) => s.pct === 0));
});

/* ---------- buildBudgetText ---------- */
test("buildBudgetText includes title, total and sale price", () => {
  const r = C.computeCosts({ weight: 25, timeH: 3.5, priceKg: 20, power: 120,
    priceKwh: 0.15, margin: 30, iva: 21 });
  const txt = C.buildBudgetText({ date: "23/08/2026", weightG: 25, timeText: "3 h 30 min",
    material: "PLA", units: 1, marginPct: 30, ivaPct: 21, results: r });
  assert.match(txt, /PRESUPUESTO DE IMPRESIÓN 3D/);
  assert.match(txt, /PRECIO DE VENTA/);
  assert.match(txt, /Material: PLA/);
  assert.ok(txt.includes(new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(r.total)));
});
test("buildBudgetText in English uses the EN strings", () => {
  const r = C.computeCosts({ weight: 25, timeH: 3.5, priceKg: 20, margin: 30, iva: 21 });
  const txt = C.buildBudgetText({ lang: "en", date: "2026-08-24", weightG: 25,
    timeText: "3 h 30 min", material: "PLA", units: 1, marginPct: 30, ivaPct: 21, results: r });
  assert.match(txt, /3D PRINTING QUOTE/);
  assert.match(txt, /SALE PRICE/);
  assert.doesNotMatch(txt, /PRESUPUESTO/);
});

/* ---------- i18n ---------- */
test("I18N: ES and EN have exactly the same keys", () => {
  const es = Object.keys(C.I18N.es).sort();
  const en = Object.keys(C.I18N.en).sort();
  assert.deepEqual(es, en);
});
test("I18N: no value is empty", () => {
  for (const lang of ["es", "en"])
    for (const [k, v] of Object.entries(C.I18N[lang]))
      assert.ok(typeof v === "string" && v.length > 0, `${lang}.${k} empty`);
});

/* ---------- parsePVPC ---------- */
test("parsePVPC: average, min, max in €/kWh", () => {
  const fixture = { PVPC: [
    { Dia: "23/08/2026", Hora: "00-01", PCB: "200,00", CYM: "200,00" },
    { Dia: "23/08/2026", Hora: "01-02", PCB: "100,00", CYM: "100,00" },
    { Dia: "23/08/2026", Hora: "02-03", PCB: "300,00", CYM: "300,00" },
  ]};
  const p = C.parsePVPC(fixture, "PCB");
  close(p.avgEurKwh, 0.2);           // average 200 €/MWh
  close(p.min, 0.1);
  close(p.max, 0.3);
  assert.equal(p.date, "23/08/2026");
});
test("parsePVPC: empty response throws", () => {
  assert.throws(() => C.parsePVPC({ PVPC: [] }));
});
