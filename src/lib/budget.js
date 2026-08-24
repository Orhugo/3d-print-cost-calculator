/* budget.js — Presupuesto en texto plano (ES/EN según o.lang). */
import { I18N } from "./i18n.js";

export function buildBudgetText(o) {
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
