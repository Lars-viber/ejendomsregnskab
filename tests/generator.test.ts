// @vitest-environment node
import { erBankdag } from "../src/domain/bankdage";
import { formaterBeloeb } from "../src/domain/beloeb";
import { MOMSSTATUSSER } from "../src/domain/momsstatus";
import { bogfoerFacit, nettoSaldi, type Opgave } from "../src/domain/opgave";
import { danVariant } from "../src/domain/variant";
import { danOpgave, danOpgaveMedForsoeg } from "../src/generator/generator";
import { danTilfaeldig } from "../src/generator/tilfaeldig";
import { beloebITekst, laesBilag } from "../src/regler/laesBilag";
import { kontrollerOpgave } from "../src/regler/regelkontrol";

/** Antal tilfældige opgaver pr. momsstatus (CLAUDE.md: et stort antal; PLAN.md: 2.000). */
const ANTAL = 2_000;

/** Tilfældige, men faste løbenumre, så en fejl altid kan genskabes. */
function loebenumre(froe: string, antal: number): number[] {
  const r = danTilfaeldig(froe);
  return [1, 999_999, ...Array.from({ length: antal - 2 }, () => r.heltal(1, 999_999))];
}

describe.each(MOMSSTATUSSER)("opgavegeneratoren: %s", (status) => {
  const numre = loebenumre(`test-${status}`, ANTAL);

  it(`danner ${ANTAL} tilfældige opgaver, som alle overholder Reference.docx afsnit 8, 9 og 10`, () => {
    const brud: string[] = [];
    for (const loeb of numre) {
      const opgave = danOpgave(danVariant(status, loeb), 2026);
      for (const fejl of kontrollerOpgave(opgave)) brud.push(`${opgave.variant.nummer}: ${fejl}`);
    }
    expect(brud.slice(0, 10)).toEqual([]);
  }, 300_000);

  it("kan udlede facit for hvert bilag alene ud fra bilagsteksten og T-kontienes saldi", () => {
    for (const loeb of numre.slice(0, 300)) {
      const opgave = danOpgave(danVariant(status, loeb), 2026);
      const saldi = nettoSaldi(opgave.saldi);
      for (const bilag of opgave.bilag) {
        const laest = laesBilag(bilag.tekst, saldi);
        const facit = new Map<number, number>();
        bogfoerFacit(facit, bilag.facit);
        const ikkeNul = (m: Map<number, number>) => [...m].filter(([, v]) => v !== 0).sort((a, b) => a[0] - b[0]);
        expect(ikkeNul(laest), `${opgave.variant.nummer} bilag ${bilag.nummer}`).toEqual(ikkeNul(facit));
        bogfoerFacit(saldi, bilag.facit);
      }
    }
  }, 120_000);

  it("oplyser aldrig momsbeløbet i bilagsteksten", () => {
    for (const loeb of numre.slice(0, 300)) {
      const opgave = danOpgave(danVariant(status, loeb), 2026);
      for (const bilag of opgave.bilag) {
        const moms = bilag.facit.filter((l) => l.konto === 30005 || l.konto === 30006).map((l) => l.oere);
        if (bilag.type === "momsafslutning") continue;
        for (const beloeb of beloebITekst(bilag.tekst)) expect(moms).not.toContain(beloeb);
        expect(bilag.tekst).not.toMatch(/heraf moms|momsbeløb/i);
      }
    }
  }, 120_000);

  it("gemmer facit for alle 20 bilag, og debet og kredit stemmer i hvert bilag", () => {
    const opgave = danOpgave(danVariant(status, numre[5]), 2026);
    expect(opgave.bilag).toHaveLength(20);
    for (const bilag of opgave.bilag) {
      expect(bilag.facit.length).toBeGreaterThanOrEqual(2);
      const debet = bilag.facit.filter((l) => l.side === "debet").reduce((s, l) => s + l.oere, 0);
      const kredit = bilag.facit.filter((l) => l.side === "kredit").reduce((s, l) => s + l.oere, 0);
      expect(debet).toBe(kredit);
    }
  });
});

describe("samme variantnummer giver samme opgave", () => {
  const variant = danVariant("delvis", 483915);

  it("giver præcis samme opgave, når den dannes igen", () => {
    expect(danOpgave(variant, 2026)).toEqual(danOpgave(variant, 2026));
  });

  it("giver samme bilag og beløb et senere år; kun årstal og datoer ændres (8.1)", () => {
    const fjernDatoer = (o: Opgave) =>
      o.bilag.map((b) => ({ ...b, dato: "", tekst: b.tekst.replace(/\d{1,2}\. \w+ \d{4}|\b20\d\d\b/g, "DATO") }));
    const i2026 = danOpgave(variant, 2026);
    for (const aar of [2027, 2028, 2031, 2035, 2040]) {
      const senere = danOpgave(variant, aar);
      expect(senere.aar).toBe(aar);
      expect(senere.saldi).toEqual(i2026.saldi);
      expect(fjernDatoer(senere)).toEqual(fjernDatoer(i2026));
      for (const bilag of senere.bilag) {
        expect(erBankdag(bilag.dato)).toBe(true);
        expect(bilag.dato.startsWith(String(aar))).toBe(true);
      }
      expect(kontrollerOpgave(senere)).toEqual([]);
    }
  });

  it("bruger det samme forsøg uanset årstal", () => {
    for (const loeb of loebenumre("aar", 200)) {
      const v = danVariant("momspligtig", loeb);
      expect(danOpgaveMedForsoeg(v, 2029).forsoeg).toBe(danOpgaveMedForsoeg(v, 2026).forsoeg);
    }
  });

  it("giver forskellige opgaver for forskellige variantnumre", () => {
    const a = danOpgave(danVariant("momsfri", 1), 2026);
    const b = danOpgave(danVariant("momsfri", 2), 2026);
    expect(a.bilag.map((x) => x.tekst)).not.toEqual(b.bilag.map((x) => x.tekst));
  });
});

describe("hastighed", () => {
  it("danner en opgave på under 1 sekund", () => {
    let langsomst = 0;
    for (const loeb of loebenumre("hastighed", 100)) {
      const start = performance.now();
      danOpgave(danVariant("delvis", loeb), 2026);
      langsomst = Math.max(langsomst, performance.now() - start);
    }
    expect(langsomst).toBeLessThan(1_000);
  });
});

describe("variation mellem opgaverne (8.2)", () => {
  it("bruger mange forskellige indholdslinjer og begge likviditetsformer for huslejen", () => {
    const indhold = new Set<string>();
    const lejeLikviditet = new Set<string>();
    for (const loeb of loebenumre("variation", 200)) {
      const opgave = danOpgave(danVariant("momspligtig", loeb), 2026);
      for (const b of opgave.bilag) {
        for (const i of b.indhold) indhold.add(i.indhold);
        if (b.type === "leje") lejeLikviditet.add(b.likviditet);
      }
    }
    expect(indhold.size).toBeGreaterThan(50);
    expect(lejeLikviditet).toEqual(new Set(["indbetaltBank", "opkraevetIkkeIndbetalt"]));
  });

  it("formaterer alle beløb i teksterne med to decimaler", () => {
    const opgave = danOpgave(danVariant("momsfri", 77), 2026);
    for (const b of opgave.bilag) {
      for (const beloeb of beloebITekst(b.tekst)) expect(b.tekst).toContain(`${formaterBeloeb(beloeb)} kr.`);
    }
  });
});
