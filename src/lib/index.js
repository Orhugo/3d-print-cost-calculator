/* index.js — Barrel de la lógica pura. Punto único de importación para la UI y los tests. */
export { MATERIALS } from "./materials.js";
export { I18N } from "./i18n.js";
export { parseHms, sumList, parseEsNumber } from "./parse.js";
export { parseGcode, resolveGrams } from "./gcode.js";
export { computeCosts, costShares } from "./pricing.js";
export { buildBudgetText } from "./budget.js";
export { parsePVPC } from "./pvpc.js";
