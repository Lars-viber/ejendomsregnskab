/**
 * Danner src/data/kontoplan.json ud fra Kontoplan.xlsx.
 * Køres lokalt med:  pnpm kontoplan
 */
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { danKontoplanData, laesKontoplanLinjer, serialiserKontoplan } from "./kontoplanXlsx.ts";

const xlsx = fileURLToPath(new URL("../Kontoplan.xlsx", import.meta.url));
const json = fileURLToPath(new URL("../src/data/kontoplan.json", import.meta.url));

if (!existsSync(xlsx)) {
  console.error("Kontoplan.xlsx findes ikke i projektmappen. kontoplan.json er ikke ændret.");
  process.exit(1);
}

const data = danKontoplanData(laesKontoplanLinjer(xlsx));
writeFileSync(json, serialiserKontoplan(data), "utf8");
const linjer = data.konti.reduce((sum, konto) => sum + konto.indhold.length, 0);
console.log(`kontoplan.json er dannet: ${data.konti.length} konti og ${linjer} indholdslinjer.`);
