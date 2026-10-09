// @vitest-environment node
import { MOMSSTATUSSER } from "../src/domain/momsstatus";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";
import { FORBEDRINGER } from "../src/generator/tekster";

/** Forbedringerne skal variere og følge 8.3, 9.1 og 9.2 (projektejerens rettelse 0b efter fase 3b). */
const BOLIGORD = /bolig|lejlighed/i;
const ERHVERVSORD = /erhverv|kontor|butik/i;
const HELEORD = /ejendomme|fælles/i;
const BEBOELSESORD = /bolig|lejlighed|beboe|badeværelse|vaskeri|altan/i;
const ANVENDELSER = ["momsfri", "momspligtig", "bolig", "erhverv", "hele"] as const;

describe("forbedringerne", () => {
  it.each(ANVENDELSER)("har mindst 5 forskellige forbedringer for %s", (anvendelse) => {
    const tekster = new Set(FORBEDRINGER.map((f) => f[anvendelse]).filter(Boolean));
    expect(tekster.size).toBeGreaterThanOrEqual(5);
  });

  it("nævner delen direkte og følger ejendomstypen", () => {
    for (const f of FORBEDRINGER) {
      if (f.momspligtig) expect(f.momspligtig).not.toMatch(BEBOELSESORD);
      if (f.momsfri) expect(f.momsfri).not.toMatch(/erhverv/i);
      if (f.bolig) {
        expect(f.bolig).toMatch(BOLIGORD);
        expect(f.bolig).not.toMatch(ERHVERVSORD);
      }
      if (f.erhverv) {
        expect(f.erhverv).toMatch(ERHVERVSORD);
        expect(f.erhverv).not.toMatch(BOLIGORD);
        expect(f.erhverv).not.toMatch(/badeværelse/i);
      }
      if (f.hele) {
        expect(f.hele).toMatch(HELEORD);
        expect(f.hele).not.toMatch(BOLIGORD);
        expect(f.hele).not.toMatch(ERHVERVSORD);
      }
    }
  });

  it("bruger aldrig vinduer som hele ejendommen og altaner kun ved boliger (9.2)", () => {
    for (const f of FORBEDRINGER) {
      expect(f.hele ?? "").not.toMatch(/vindue/i);
      for (const tekst of [f.momspligtig, f.erhverv, f.hele]) expect(tekst ?? "").not.toMatch(/altan/i);
    }
  });

  it.each(MOMSSTATUSSER)("giver mindst 5 forskellige forbedringer i 200 opgaver: %s", (status) => {
    const tekster = new Set<string>();
    for (let n = 1; n <= 200; n++) {
      const forbedring = danOpgave(danVariant(status, n * 4999), 2026).bilag.find((b) => b.type === "forbedring")!;
      tekster.add(forbedring.tekst.replace(/^.*?den \d{1,2}\. \S+ \d{4} /, "").split(". Fakturaen")[0]);
    }
    expect(tekster.size).toBeGreaterThanOrEqual(5);
  });
});
