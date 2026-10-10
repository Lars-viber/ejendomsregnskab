// @vitest-environment node
import { formaterBeloeb } from "../src/domain/beloeb";
import { kontrollerSaldi, saldiEfterSidsteBilag, SALDO_HJAELPETEKST, type SaldoSvar } from "../src/domain/saldi";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";

const opgave = danOpgave(danVariant("delvis", 104729), 2026);
const forventet = saldiEfterSidsteBilag(opgave);

/** Den korrekte saldiopgørelse, skrevet som beløb. */
function korrekte(): Record<string, SaldoSvar> {
  const svar: Record<string, SaldoSvar> = {};
  for (const s of forventet) svar[s.konto] = { udtryk: formaterBeloeb(s.oere), side: s.side };
  return svar;
}

const enMedSaldo = forventet.find((s) => s.side === "debet")!;
const enUdenSaldo = forventet.find((s) => s.side === "ingen")!;

describe("saldiopgørelsen (7.3)", () => {
  it("har en saldo for hver synlig konto, og konti med saldo 0 har \"Ingen saldo\"", () => {
    expect(forventet.length).toBe(37); // delvis moms: alle konti er synlige
    expect(forventet.find((s) => s.konto === 30007)?.side).toBe("ingen"); // momsen er afregnet
    expect(forventet.find((s) => s.konto === 30005)?.side).toBe("ingen"); // momskontiene er afsluttet
  });

  it("godkender den korrekte saldiopgørelse og markerer alle konti grønne", () => {
    const r = kontrollerSaldi(opgave, korrekte());
    expect(r.korrekt).toBe(true);
    expect(Object.values(r.konti).every((m) => m === "korrekt")).toBe(true);
  });

  it("godkender regneudtryk og beløb med eller uden tusindtalspunktum", () => {
    const svar = korrekte();
    const oere = enMedSaldo.oere;
    svar[enMedSaldo.konto] = { udtryk: `=${(oere / 100).toString().replace(".", ",")}*2/2`, side: "debet" };
    expect(kontrollerSaldi(opgave, svar).korrekt).toBe(true);
  });

  it("melder manglende saldi uden at afsløre facit", () => {
    const svar = korrekte();
    delete svar[enMedSaldo.konto];
    const r = kontrollerSaldi(opgave, svar);
    expect(r.korrekt).toBe(false);
    expect(r.konti[enMedSaldo.konto]).toBe("forkert");
    expect(r.hjaelpetekster).toEqual([SALDO_HJAELPETEKST.mangler]);
    expect(r.hjaelpetekster.join(" ")).not.toMatch(/\d/);
  });

  it("melder forkert beløb og forkert side hver for sig", () => {
    const svar = korrekte();
    svar[enMedSaldo.konto] = { udtryk: formaterBeloeb(enMedSaldo.oere + 100), side: "debet" };
    expect(kontrollerSaldi(opgave, svar).hjaelpetekster).toEqual([SALDO_HJAELPETEKST.forkertBeloeb]);
    svar[enMedSaldo.konto] = { udtryk: formaterBeloeb(enMedSaldo.oere), side: "kredit" };
    expect(kontrollerSaldi(opgave, svar).hjaelpetekster).toEqual([SALDO_HJAELPETEKST.forkertSide]);
  });

  it("kræver beløbet 0 og \"Ingen saldo\" for en konto med saldo 0", () => {
    const svar = korrekte();
    svar[enUdenSaldo.konto] = { udtryk: "0", side: "debet" };
    expect(kontrollerSaldi(opgave, svar).hjaelpetekster).toEqual([SALDO_HJAELPETEKST.ingenSaldo]);
    svar[enUdenSaldo.konto] = { udtryk: "0", side: "ingen" };
    expect(kontrollerSaldi(opgave, svar).korrekt).toBe(true);
    svar[enMedSaldo.konto] = { udtryk: formaterBeloeb(enMedSaldo.oere), side: "ingen" };
    expect(kontrollerSaldi(opgave, svar).hjaelpetekster).toEqual([SALDO_HJAELPETEKST.ingenSaldo]);
  });

  it("melder et ulæseligt beløb", () => {
    const svar = korrekte();
    svar[enMedSaldo.konto] = { udtryk: "tolv", side: "debet" };
    expect(kontrollerSaldi(opgave, svar).hjaelpetekster).toEqual([SALDO_HJAELPETEKST.ulaeseligt]);
  });

  it("skjuler konti efter momsstatus også i saldiopgørelsen (6.3)", () => {
    const momsfri = saldiEfterSidsteBilag(danOpgave(danVariant("momsfri", 1), 2026)).map((s) => s.konto);
    expect(momsfri).not.toContain(1000);
    expect(momsfri).not.toContain(30007);
    expect(momsfri).toContain(8000);
  });
});
