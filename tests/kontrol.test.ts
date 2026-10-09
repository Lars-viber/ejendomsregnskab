// @vitest-environment node
import { HJAELPETEKST, kontrollerBilag } from "../src/domain/kontrol";
import { bogfoerFacit, nettoSaldi, type FacitLinje, type Postering, type Side } from "../src/domain/opgave";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";

/**
 * Kontrol af et bilag (Reference.docx 7.1): nettobeløbet pr. konto sammenlignes med facit.
 * Facit: trappevask 12.500 kr. inkl. moms, delvis moms (hele ejendommen, 60 %), betalt via bank:
 *   3000 debet 11.000 · 30006 debet 1.500 · 20004 kredit 12.500
 */
const facit: FacitLinje[] = [
  { konto: 3000, side: "debet", oere: 1_100_000 },
  { konto: 30006, side: "debet", oere: 150_000 },
  { konto: 20004, side: "kredit", oere: 1_250_000 },
];

let id = 0;
const p = (konto: number, side: Side, kroner: number): Postering => ({
  id: `p${++id}`,
  bilag: 1,
  konto,
  side,
  udtryk: String(kroner),
  oere: Math.round(kroner * 100),
});

const markeringer = (posteringer: Postering[]) => {
  const r = kontrollerBilag(facit, posteringer);
  return posteringer.map((x) => r.posteringer[x.id]);
};

describe("kontrol af et bilag (7.1)", () => {
  it("godkender den korrekte løsning og markerer alle linjer grønne", () => {
    const posteringer = [p(3000, "debet", 11_000), p(30006, "debet", 1_500), p(20004, "kredit", 12_500)];
    const r = kontrollerBilag(facit, posteringer);
    expect(r.korrekt).toBe(true);
    expect(r.hjaelpetekster).toEqual([]);
    expect(markeringer(posteringer)).toEqual(["korrekt", "korrekt", "korrekt"]);
  });

  it("godkender et beløb delt på flere linjer på samme konto", () => {
    const posteringer = [p(3000, "debet", 10_000), p(3000, "debet", 1_000), p(30006, "debet", 1_500), p(20004, "kredit", 12_500)];
    expect(kontrollerBilag(facit, posteringer).korrekt).toBe(true);
    expect(markeringer(posteringer).every((m) => m === "korrekt")).toBe(true);
  });

  it("godkender linjerne i en anden rækkefølge", () => {
    const posteringer = [p(20004, "kredit", 12_500), p(30006, "debet", 1_500), p(3000, "debet", 11_000)];
    expect(kontrollerBilag(facit, posteringer).korrekt).toBe(true);
  });

  it("godkender en mellemregning, hvor samme konto både debiteres og krediteres", () => {
    // Hele beløbet debiteres først 3000, og den fradragsberettigede moms flyttes derefter til 30006.
    const posteringer = [p(3000, "debet", 12_500), p(3000, "kredit", 1_500), p(30006, "debet", 1_500), p(20004, "kredit", 12_500)];
    const r = kontrollerBilag(facit, posteringer);
    expect(r.korrekt).toBe(true);
    expect(markeringer(posteringer)).toEqual(["korrekt", "korrekt", "korrekt", "korrekt"]);
  });

  it("markerer en forkert konto rød og godkender ikke", () => {
    const posteringer = [p(3001, "debet", 11_000), p(30006, "debet", 1_500), p(20004, "kredit", 12_500)];
    const r = kontrollerBilag(facit, posteringer);
    expect(r.korrekt).toBe(false);
    expect(markeringer(posteringer)).toEqual(["forkert", "korrekt", "korrekt"]);
    expect(r.hjaelpetekster).toContain(HJAELPETEKST.forkertKonto);
    expect(r.hjaelpetekster).toContain(HJAELPETEKST.manglendeKonto);
  });

  it("markerer et forkert beløb rødt og godkender ikke", () => {
    const posteringer = [p(3000, "debet", 10_000), p(30006, "debet", 2_500), p(20004, "kredit", 12_500)];
    const r = kontrollerBilag(facit, posteringer);
    expect(r.korrekt).toBe(false);
    expect(markeringer(posteringer)).toEqual(["forkert", "forkert", "korrekt"]);
    expect(r.hjaelpetekster).toEqual([HJAELPETEKST.forkertBeloeb]);
  });

  it("markerer et beløb i den forkerte side rødt", () => {
    const posteringer = [p(3000, "debet", 11_000), p(30006, "debet", 1_500), p(20004, "debet", 12_500)];
    const r = kontrollerBilag(facit, posteringer);
    expect(r.korrekt).toBe(false);
    expect(markeringer(posteringer)).toEqual(["korrekt", "korrekt", "forkert"]);
    expect(r.hjaelpetekster).toContain(HJAELPETEKST.ubalance);
  });

  it("melder ubalance, når debet og kredit ikke stemmer", () => {
    const posteringer = [p(3000, "debet", 11_000), p(30006, "debet", 1_500), p(20004, "kredit", 12_000)];
    const r = kontrollerBilag(facit, posteringer);
    expect(r.korrekt).toBe(false);
    expect(r.hjaelpetekster[0]).toBe(HJAELPETEKST.ubalance);
    expect(markeringer(posteringer)).toEqual(["korrekt", "korrekt", "forkert"]);
  });

  it("melder manglende konto uden at afsløre hvilken", () => {
    const posteringer = [p(3000, "debet", 12_500), p(20004, "kredit", 12_500)];
    const r = kontrollerBilag(facit, posteringer);
    expect(r.korrekt).toBe(false);
    expect(r.hjaelpetekster).toContain(HJAELPETEKST.manglendeKonto);
    expect(r.hjaelpetekster.join(" ")).not.toMatch(/\d/); // ingen kontonumre eller beløb
    expect(markeringer(posteringer)).toEqual(["forkert", "korrekt"]);
  });

  it("markerer en mellemregning på en konto uden for facit rød, selv om den giver 0", () => {
    const posteringer = [
      p(3000, "debet", 11_000),
      p(30006, "debet", 1_500),
      p(20004, "kredit", 12_500),
      p(30004, "debet", 500),
      p(30004, "kredit", 500),
    ];
    const r = kontrollerBilag(facit, posteringer);
    expect(r.korrekt).toBe(false);
    expect(markeringer(posteringer).slice(3)).toEqual(["forkert", "forkert"]);
    expect(r.hjaelpetekster).toEqual([HJAELPETEKST.forkertKonto]);
  });

  it("melder, når der ikke er bogført noget", () => {
    const r = kontrollerBilag(facit, []);
    expect(r.korrekt).toBe(false);
    expect(r.hjaelpetekster).toEqual([HJAELPETEKST.tomt]);
  });

  it("kontrollerer bilag 19 (afslutning af momskonti) uden beløb i teksten", () => {
    const opgave = danOpgave(danVariant("delvis", 104729), 2026);
    const bilag19 = opgave.bilag[18];
    expect(bilag19.type).toBe("momsafslutning");
    // Den studerende finder saldiene i T-kontiene efter bilag 1–18.
    const saldi = nettoSaldi(opgave.saldi);
    for (const b of opgave.bilag.slice(0, 18)) bogfoerFacit(saldi, b.facit);
    const salgsmoms = -(saldi.get(30005) ?? 0);
    const koebsmoms = saldi.get(30006) ?? 0;
    const posteringer = [
      { ...p(30005, "debet", 0), oere: salgsmoms, bilag: 19 },
      { ...p(30006, "kredit", 0), oere: koebsmoms, bilag: 19 },
      { ...p(30007, "kredit", 0), oere: salgsmoms - koebsmoms, bilag: 19 },
    ];
    expect(kontrollerBilag(bilag19.facit, posteringer).korrekt).toBe(true);
    const forkert = [{ ...posteringer[0] }, { ...posteringer[1], oere: koebsmoms + 100 }, { ...posteringer[2], oere: salgsmoms - koebsmoms - 100 }];
    expect(kontrollerBilag(bilag19.facit, forkert).korrekt).toBe(false);
  });

  it("godkender facit for alle bilag i en hel opgave", () => {
    for (const status of ["momsfri", "delvis", "momspligtig"] as const) {
      const opgave = danOpgave(danVariant(status, 31337), 2026);
      for (const bilag of opgave.bilag) {
        const posteringer = bilag.facit.map((l, i) => ({ id: `f${i}`, bilag: bilag.nummer, konto: l.konto, side: l.side, udtryk: "", oere: l.oere }));
        expect(kontrollerBilag(bilag.facit, posteringer).korrekt).toBe(true);
      }
    }
  });
});
