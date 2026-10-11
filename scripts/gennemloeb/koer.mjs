/**
 * Fuldt gennemløb af alle gyldige variantnumre (3 × 999.999) – kørsel: pnpm gennemloeb
 *
 * Numrene deles i stykker á 10.000, som køres på alle processorkerner samtidig.
 * Hvert færdigt stykke skrives straks i lokalt/gennemloeb/resultater.jsonl, så en afbrudt
 * kørsel kan genoptages: færdige stykker springes over. Status skrives i lokalt/gennemloeb/status.txt.
 * Med "--forfra" slettes tidligere resultater.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";

const MAPPE = fileURLToPath(new URL("../../lokalt/gennemloeb/", import.meta.url));
const PROGRAM = MAPPE + "program/del.mjs";
const RESULTATER = MAPPE + "resultater.jsonl";
const STATUS = MAPPE + "status.txt";
const STYKKE = 10_000;
const SIDSTE = 999_999;
const STATUSSER = ["momsfri", "delvis", "momspligtig"];

mkdirSync(MAPPE, { recursive: true });
if (process.argv.includes("--forfra")) rmSync(RESULTATER, { force: true });

const stykker = [];
for (const status of STATUSSER) {
  for (let fra = 1; fra <= SIDSTE; fra += STYKKE) {
    const til = Math.min(fra + STYKKE - 1, SIDSTE);
    stykker.push({ noegle: `${status}:${fra}`, status, fra, til });
  }
}

function laesResultater() {
  if (!existsSync(RESULTATER)) return [];
  return readFileSync(RESULTATER, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((linje) => {
      try {
        return [JSON.parse(linje)];
      } catch {
        return []; // en linje, der er ved at blive skrevet af et andet stykke
      }
    });
}

const faerdige = new Set(laesResultater().map((r) => r.noegle));
const mangler = stykker.filter((s) => !faerdige.has(s.noegle));
const kerner = availableParallelism();
const start = Date.now();

function skrivStatus() {
  const r = laesResultater();
  const antal = r.reduce((s, x) => s + x.antal, 0);
  const fejl = r.flatMap((x) => x.fejl);
  const forsoeg = {};
  for (const x of r) for (const [k, v] of Object.entries(x.forsoeg)) forsoeg[k] = (forsoeg[k] ?? 0) + v;
  const tekst =
    `Gennemløb: ${antal.toLocaleString("da-DK")} af ${(3 * SIDSTE).toLocaleString("da-DK")} variantnumre ` +
    `(${((antal / (3 * SIDSTE)) * 100).toFixed(1)} %), stykker ${r.length}/${stykker.length}, fejl ${fejl.length}, ` +
    `minutter i denne kørsel ${((Date.now() - start) / 60000).toFixed(1)}\n` +
    `Forsøg brugt (forsøgsnummer: antal): ${JSON.stringify(forsoeg)}\n` +
    (fejl.length ? `Første fejl:\n${fejl.slice(0, 20).join("\n")}\n` : "");
  writeFileSync(STATUS, tekst);
  return tekst;
}

console.log(`${mangler.length} af ${stykker.length} stykker mangler; bruger ${kerner} processorkerner.`);
let naeste = 0;
async function arbejder() {
  while (naeste < mangler.length) {
    const s = mangler[naeste++];
    await new Promise((faerdig, fejl) => {
      const p = spawn(process.execPath, [PROGRAM, s.status, String(s.fra), String(s.til), RESULTATER, s.noegle], { stdio: "inherit" });
      p.on("exit", (kode) => (kode === 0 ? faerdig() : fejl(new Error(`Stykket ${s.noegle} stoppede med kode ${kode}`))));
    });
    process.stdout.write(skrivStatus().split("\n")[0] + "\n");
  }
}
await Promise.all(Array.from({ length: kerner }, arbejder));
console.log("\n" + skrivStatus());
