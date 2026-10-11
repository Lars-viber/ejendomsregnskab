/**
 * Ét stykke af det fulde gennemløb af alle gyldige variantnumre (3 × 999.999).
 * Bygges til lokalt/gennemloeb/del.mjs og startes af koer.mjs – ét stykke pr. proces.
 *
 * For hvert variantnummer i stykket:
 * - danner generatoren opgaven (i referenceåret 2026),
 * - kontrollerer den uafhængige regelkontrol opgaven (Reference.docx afsnit 8, 9 og 10),
 * - udleder "læseren" facit for hvert bilag alene ud fra bilagsteksten og saldiene, og det skal give generatorens facit,
 * - må bilagsteksten ikke oplyse momsbeløbet, og debet skal være lig kredit i hvert bilag.
 */
import { appendFileSync } from "node:fs";
import type { Momsstatus } from "../../src/domain/momsstatus";
import { bogfoerFacit, nettoSaldi } from "../../src/domain/opgave";
import { danVariant } from "../../src/domain/variant";
import { danOpgaveMedForsoeg } from "../../src/generator/generator";
import { beloebITekst, laesBilag } from "../../src/regler/laesBilag";
import { kontrollerOpgave } from "../../src/regler/regelkontrol";

const AAR = 2026;

function kontrollerVariant(status: Momsstatus, loeb: number): { forsoeg: number; fejl: string[] } {
  const { opgave, forsoeg } = danOpgaveMedForsoeg(danVariant(status, loeb), AAR);
  const fejl = [...kontrollerOpgave(opgave)];
  const saldi = nettoSaldi(opgave.saldi);
  const ikkeNul = (m: Map<number, number>) =>
    JSON.stringify([...m].filter(([, v]) => v !== 0).sort((a, b) => a[0] - b[0]));
  for (const bilag of opgave.bilag) {
    const debet = bilag.facit.filter((l) => l.side === "debet").reduce((s, l) => s + l.oere, 0);
    const kredit = bilag.facit.filter((l) => l.side === "kredit").reduce((s, l) => s + l.oere, 0);
    if (debet !== kredit) fejl.push(`Bilag ${bilag.nummer}: debet og kredit stemmer ikke.`);
    const facit = new Map<number, number>();
    bogfoerFacit(facit, bilag.facit);
    let laest: Map<number, number>;
    try {
      laest = laesBilag(bilag.tekst, saldi);
    } catch (e) {
      fejl.push(`Bilag ${bilag.nummer}: teksten kan ikke læses (${(e as Error).message}).`);
      laest = new Map();
    }
    if (ikkeNul(laest) !== ikkeNul(facit)) fejl.push(`Bilag ${bilag.nummer}: facit kan ikke udledes af bilagsteksten.`);
    if (bilag.type !== "momsafslutning") {
      const moms = bilag.facit.filter((l) => l.konto === 30005 || l.konto === 30006).map((l) => l.oere);
      if (beloebITekst(bilag.tekst).some((b) => moms.includes(b))) fejl.push(`Bilag ${bilag.nummer}: momsbeløbet står i teksten.`);
    }
    bogfoerFacit(saldi, bilag.facit);
  }
  return { forsoeg, fejl };
}

// node del.mjs <status> <fra> <til> <resultatfil> <nøgle>
const [status, fra, til, resultatfil, noegle] = process.argv.slice(2);
const start = Date.now();
const forsoeg: Record<number, number> = {};
const fejl: string[] = [];
for (let loeb = Number(fra); loeb <= Number(til); loeb++) {
  try {
    const r = kontrollerVariant(status as Momsstatus, loeb);
    forsoeg[r.forsoeg] = (forsoeg[r.forsoeg] ?? 0) + 1;
    for (const f of r.fejl) fejl.push(`${danVariant(status as Momsstatus, loeb).nummer}: ${f}`);
  } catch (e) {
    fejl.push(`${danVariant(status as Momsstatus, loeb).nummer}: ${(e as Error).message}`);
  }
}
appendFileSync(
  resultatfil,
  JSON.stringify({ noegle, status, fra: Number(fra), til: Number(til), antal: Number(til) - Number(fra) + 1, forsoeg, fejl, sekunder: Math.round((Date.now() - start) / 1000) }) + "\n",
);
