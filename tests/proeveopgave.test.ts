// @vitest-environment node
import { KONTOPLAN } from "../src/domain/kontoplan";
import { MOMSSTATUSSER } from "../src/domain/momsstatus";
import { skjulteKonti, synligeKonti } from "../src/domain/opgave";
import { danProeveopgave } from "../src/domain/proeveopgave";
import { danVariant } from "../src/domain/variant";

describe("synlige konti (6.3)", () => {
  it("skjuler den ubrugte lejekonto og momskontiene ved momsfri", () => {
    expect(skjulteKonti("momsfri")).toEqual([1000, 30005, 30006, 30007]);
    expect(skjulteKonti("delvis")).toEqual([]);
    expect(skjulteKonti("momspligtig")).toEqual([1001]);
  });

  it("viser altid konto 8000 og viser konti i stigende kontonummer", () => {
    for (const status of MOMSSTATUSSER) {
      const { resultat, balance } = synligeKonti(status);
      expect(resultat.some((k) => k.nummer === 8000)).toBe(true);
      for (const liste of [resultat, balance]) {
        const numre = liste.map((k) => k.nummer);
        expect(numre).toEqual([...numre].sort((a, b) => a - b));
      }
      expect(resultat.every((k) => k.nummer < 20000)).toBe(true);
      expect(balance.every((k) => k.nummer >= 20000)).toBe(true);
      expect(resultat.length + balance.length + skjulteKonti(status).length).toBe(KONTOPLAN.length);
    }
  });
});

describe.each(MOMSSTATUSSER)("prøveopgave: %s", (status) => {
  const opgave = danProeveopgave(danVariant(status, 1), 2026);
  const kontoplan = new Map(KONTOPLAN.map((k) => [k.nummer, k]));
  const skjult = new Set(skjulteKonti(status));

  it("bruger kun konti og indholdslinjer fra kontoplanen", () => {
    for (const saldo of opgave.saldi) expect(kontoplan.has(saldo.konto)).toBe(true);
    for (const bilag of opgave.bilag) {
      expect(bilag.indhold.length).toBeGreaterThan(0);
      for (const { konto, indhold } of bilag.indhold) {
        expect(kontoplan.get(konto)?.indhold.map((l) => l.tekst)).toContain(indhold);
        expect(skjult.has(konto)).toBe(false);
      }
    }
  });

  it("har saldi, hvor debet og kredit stemmer", () => {
    const debet = opgave.saldi.filter((s) => s.side === "debet").reduce((sum, s) => sum + s.oere, 0);
    const kredit = opgave.saldi.filter((s) => s.side === "kredit").reduce((sum, s) => sum + s.oere, 0);
    expect(debet).toBe(kredit);
    expect(opgave.saldi.every((s) => Number.isInteger(s.oere) && s.oere > 0)).toBe(true);
  });

  it("har ingen saldo på skjulte konti, 8000 eller 30007", () => {
    for (const saldo of opgave.saldi) {
      expect(skjult.has(saldo.konto)).toBe(false);
      expect([8000, 30007]).not.toContain(saldo.konto);
    }
    expect(opgave.saldi.find((s) => s.konto === 30001)?.side).toBe("kredit");
  });

  it("har nogle få bilag i kronologisk rækkefølge i 4. kvartal", () => {
    expect(opgave.bilag.length).toBeGreaterThan(0);
    expect(opgave.bilag.map((b) => b.nummer)).toEqual(opgave.bilag.map((_, i) => i + 1));
    const datoer = opgave.bilag.map((b) => b.dato);
    expect(datoer).toEqual([...datoer].sort());
    for (const dato of datoer) expect(dato >= "2026-10-01" && dato <= "2026-12-31").toBe(true);
  });

  it("skriver bilagstekster som én tekst med dato og uden dobbelt punktum", () => {
    for (const bilag of opgave.bilag) {
      expect(bilag.tekst).not.toMatch(/\n/);
      expect(bilag.tekst).not.toMatch(/\.\./);
      expect(bilag.tekst).toMatch(/2026/);
    }
  });

  it("angiver momsfradragsprocent kun ved delvis moms", () => {
    expect(opgave.momsfradragsprocent !== null).toBe(status === "delvis");
  });
});
