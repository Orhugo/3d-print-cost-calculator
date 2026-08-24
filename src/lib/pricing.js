/* pricing.js — Cálculo de costes y reparto en porcentaje (sin DOM). */

// inputs: { weight, timeH, units, priceKg, power, priceKwh, machinePrice,
//           machineLife, prepMin, postMin, laborRate, consumables,
//           failureRate, margin, iva }
export function computeCosts(i) {
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

// Reparto de costes en % (sobre el coste total)
export function costShares(r) {
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
