// @vitest-environment node
import type { Opgave } from "../src/domain/opgave";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";
import { kontrollerOpgave } from "../src/regler/regelkontrol";

/**
 * Regelkontrollen skal selv kunne fange fejl. Ellers kunne en fejl i kontrollen skjule en fejl
 * i generatoren. Her ødelægges gyldige opgaver med vilje, og kontrollen skal opdage det.
 */
const delvis = danOpgave(danVariant("delvis", 4242), 2026);
const momsfri = danOpgave(danVariant("momsfri", 4242), 2026);
const kopi = (o: Opgave): Opgave => structuredClone(o);
const fejlI = (o: Opgave) => kontrollerOpgave(o).join("\n");

describe("regelkontrollen", () => {
  it("godkender gyldige opgaver", () => {
    expect(kontrollerOpgave(delvis)).toEqual([]);
    expect(kontrollerOpgave(momsfri)).toEqual([]);
  });

  it("opdager en bankkonto i overtræk (10.2)", () => {
    const o = kopi(delvis);
    const bank = o.saldi.find((s) => s.konto === 20004)!;
    const overfoert = o.saldi.find((s) => s.konto === 30001)!;
    overfoert.oere -= bank.oere - 100;
    bank.oere = 100;
    expect(fejlI(o)).toMatch(/Bankkontoen er ikke positiv/);
  });

  it("opdager et bilag, der ikke er dateret på en bankdag (8.1)", () => {
    const o = kopi(delvis);
    o.bilag[2].dato = "2026-10-10"; // lørdag
    expect(fejlI(o)).toMatch(/ikke er en bankdag/);
  });

  it("opdager en momsfradragsprocent, der ikke kan beregnes i retrospekt (9.2)", () => {
    const o = kopi(delvis);
    o.momsfradragsprocent = (o.momsfradragsprocent ?? 50) + 1;
    expect(fejlI(o)).toMatch(/9\.2/);
  });

  it("opdager et manglende fast bilag (8.2)", () => {
    const o = kopi(delvis);
    o.bilag.find((b) => b.type === "forsikring")!.type = "omkostning";
    expect(fejlI(o)).toMatch(/forsikring forekommer 0 gange/);
  });

  it("opdager, at momsafslutningen ikke er bilag 19 (8.2)", () => {
    const o = kopi(delvis);
    [o.bilag[18].type, o.bilag[17].type] = [o.bilag[17].type, o.bilag[18].type];
    expect(fejlI(o)).toMatch(/Bilag 19 er ikke afslutning af momskonti/);
  });

  it("opdager et momsbeløb i bilagsteksten (8.3)", () => {
    const o = kopi(delvis);
    const bilag = o.bilag.find((b) => b.facit.some((l) => l.konto === 30006))!;
    const moms = bilag.facit.find((l) => l.konto === 30006)!.oere;
    const kroner = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2 }).format(moms / 100);
    bilag.tekst += ` Heraf fradrag ${kroner} kr.`;
    expect(fejlI(o)).toMatch(/oplyser momsbeløbet/);
  });

  it("opdager et facit, der ikke kan udledes af bilagsteksten (8.3)", () => {
    const o = kopi(delvis);
    const bilag = o.bilag.find((b) => b.type === "administrator")!;
    bilag.facit[0].oere += 100;
    bilag.facit[bilag.facit.length - 1].oere += 100;
    expect(fejlI(o)).toMatch(/kan ikke udledes af bilagsteksten/);
  });

  it("opdager en forkert selskabsskat (10.1)", () => {
    const o = kopi(delvis);
    o.saldi.find((s) => s.konto === 9000)!.oere += 1;
    o.saldi.find((s) => s.konto === 30001)!.oere += 1;
    expect(fejlI(o)).toMatch(/Selskabsskat \(9000\) er ikke 22 %/);
  });

  it("opdager moms i en momsfri opgave (9.1)", () => {
    const o = kopi(momsfri);
    const bilag = o.bilag.find((b) => b.type === "administrator")!;
    bilag.facit[0].oere -= 100;
    bilag.facit.splice(1, 0, { konto: 30006, side: "debet", oere: 100 });
    expect(fejlI(o)).toMatch(/30006, som ikke bruges ved momsfri/);
  });

  it("opdager forkert ental/flertal i likviditetsformuleringen (8.3)", () => {
    const o = kopi(delvis);
    o.bilag[0].tekst = o.bilag[0].tekst.replace("Beløbene er indbetalt", "Beløbet er indbetalt");
    expect(fejlI(o)).toMatch(/mangler formuleringen "Beløbene er indbetalt på bankkonto\."/);
  });

  it("opdager en aktiekapital uden for 500.000–2.000.000 kr. (10.2)", () => {
    const o = kopi(momsfri);
    const aktiekapital = o.saldi.find((s) => s.konto === 30000)!;
    o.saldi.find((s) => s.konto === 30001)!.oere += aktiekapital.oere - 40_000_000;
    aktiekapital.oere = 40_000_000;
    expect(fejlI(o)).toMatch(/Aktiekapital er ikke 500\.000–2\.000\.000/);
  });

  it("opdager udgiftsføring af periodeafgrænsningsposter (10.1)", () => {
    const o = kopi(momsfri);
    const bilag = o.bilag.find((b) => b.type === "forsikring")!;
    bilag.facit.push({ konto: 20003, side: "kredit", oere: 100 }, { konto: 2000, side: "debet", oere: 100 });
    expect(fejlI(o)).toMatch(/udgiftsfører periodeafgrænsningsposter/);
  });

  it("opdager en husleje, der ikke er ens i alle kvartaler (10.3)", () => {
    const o = kopi(momsfri);
    const leje = o.saldi.find((s) => s.konto === 1001)!;
    leje.oere += 100_000;
    o.saldi.find((s) => s.konto === 30001)!.oere -= 100_000;
    expect(fejlI(o)).toMatch(/Lejen på 1001 er ikke den samme i alle fire kvartaler/);
  });
});
