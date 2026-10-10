// @vitest-environment node
import { MOMSSTATUSSER } from "../src/domain/momsstatus";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";
import { FORBEDRINGER } from "../src/domain/forbedringer";
import { kontrollerOpgave } from "../src/regler/regelkontrol";

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

  // ---------- 8.4 (version 1.6): beløbet skal passe til projektet ----------
  it("har realistiske prisintervaller inden for 100.000–750.000 kr. inkl. moms", () => {
    for (const f of FORBEDRINGER) {
      expect(f.min).toBeGreaterThanOrEqual(100_000);
      expect(f.max).toBeLessThanOrEqual(750_000);
      expect(f.min).toBeLessThan(f.max);
    }
    const pris = (navn: string) => FORBEDRINGER.find((f) => f.navn === navn)!;
    for (const stor of ["Ny elevator", "Udnyttelse af tagetagen", "Efterisolering og ny tagbelægning", "Efterisolering af facader"]) {
      expect(pris(stor).min).toBeGreaterThanOrEqual(450_000);
    }
    for (const lille of ["Ladestandere", "Solceller", "Varmepumpe"]) {
      expect(pris(lille).max).toBeLessThanOrEqual(300_000);
      expect(pris(lille).lille).toBe(true);
    }
  });

  it.each(ANVENDELSER)("har et projekt til ethvert beløb fra 100.000 til 750.000 kr. for %s", (anvendelse) => {
    const projekter = FORBEDRINGER.filter((f) => f[anvendelse]);
    for (let kroner = 100_000; kroner <= 750_000; kroner += 1_000) {
      expect(projekter.some((f) => f.min <= kroner && kroner <= f.max), `${anvendelse} ${kroner}`).toBe(true);
    }
    // Under 100.000 kr. (når 9.4 har forrang) skal der findes et lille projekt.
    if (anvendelse !== "momsfri" && anvendelse !== "bolig") expect(projekter.some((f) => f.lille)).toBe(true);
  });

  it("opdager et projekt, hvis beløb ikke passer til projektet", () => {
    const opgave = structuredClone(danOpgave(danVariant("momsfri", 4242), 2026));
    const bilag = opgave.bilag.find((b) => b.type === "forbedring")!;
    const beskrivelse = bilag.tekst.replace(/^.*?den \d{1,2}\. \S+ \d{4} /, "").split(". Fakturaen")[0];
    const brutto = bilag.facit.find((l) => l.side === "kredit")!.oere / 100;
    // Byt projektet ud med et, hvis interval ikke indeholder beløbet.
    const forkert = FORBEDRINGER.find((f) => f.momsfri && (brutto < f.min || brutto > f.max))!;
    bilag.tekst = bilag.tekst.replace(beskrivelse, forkert.momsfri!);
    expect(kontrollerOpgave(opgave).join("\n")).toMatch(/Beløbet passer ikke til forbedringen/);
  });

  it("vælger store projekter ved store beløb og små ved små beløb i de dannede opgaver", () => {
    for (const status of MOMSSTATUSSER) {
      for (let n = 1; n <= 150; n++) {
        const bilag = danOpgave(danVariant(status, (n * 7919) % 999_999 + 1), 2026).bilag.find((b) => b.type === "forbedring")!;
        const brutto = bilag.facit.find((l) => l.side === "kredit")!.oere / 100;
        const projekt = FORBEDRINGER.find((f) => [f.momsfri, f.momspligtig, f.bolig, f.erhverv, f.hele].some((t) => t && bilag.tekst.includes(t)))!;
        if (brutto < 100_000) expect(projekt.lille).toBe(true);
        else expect(brutto >= projekt.min && brutto <= projekt.max, `${projekt.navn} ${brutto}`).toBe(true);
      }
    }
  });
});
