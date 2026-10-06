// @vitest-environment node
import { danVariant, fortolkVariantnummer, nytVariantnummer } from "../src/domain/variant";

describe("variantnummer", () => {
  it("koder momsstatus i første ciffer og løbenummeret i de seks næste", () => {
    expect(danVariant("momsfri", 1).nummer).toBe("1000001");
    expect(danVariant("delvis", 483915).nummer).toBe("2483915");
    expect(danVariant("momspligtig", 999999).nummer).toBe("3999999");
  });

  it("fortolker gyldige numre og ignorerer mellemrum og bindestreger", () => {
    for (const tekst of ["2483915", " 2 483915 ", "2-483915"]) {
      expect(fortolkVariantnummer(tekst)).toEqual({
        ok: true,
        variant: { nummer: "2483915", momsstatus: "delvis", loebenummer: 483915 },
      });
    }
    expect(fortolkVariantnummer("1000001")).toMatchObject({ ok: true, variant: { momsstatus: "momsfri" } });
    expect(fortolkVariantnummer("3123456")).toMatchObject({ ok: true, variant: { momsstatus: "momspligtig" } });
  });

  it("afviser ugyldige numre med en dansk fejlbesked", () => {
    const fejl = (tekst: string) => {
      const resultat = fortolkVariantnummer(tekst);
      return resultat.ok ? null : resultat.fejl;
    };
    expect(fejl("")).toBe("Indtast et variantnummer.");
    expect(fejl("12a4567")).toBe("Variantnummeret må kun indeholde cifre.");
    expect(fejl("248391")).toBe("Variantnummeret skal have 7 cifre.");
    expect(fejl("24839150")).toBe("Variantnummeret skal have 7 cifre.");
    expect(fejl("4483915")).toBe("Variantnummeret skal begynde med 1, 2 eller 3.");
    expect(fejl("0483915")).toBe("Variantnummeret skal begynde med 1, 2 eller 3.");
    expect(fejl("2000000")).toBe("Variantnummeret findes ikke.");
  });

  it("afviser løbenumre uden for 1–999999", () => {
    expect(() => danVariant("momsfri", 0)).toThrow();
    expect(() => danVariant("momsfri", 1_000_000)).toThrow();
  });

  it("danner nye numre med den valgte momsstatus, som kan fortolkes igen", () => {
    for (const status of ["momsfri", "delvis", "momspligtig"] as const) {
      for (let i = 0; i < 200; i++) {
        const variant = nytVariantnummer(status);
        expect(variant.momsstatus).toBe(status);
        expect(fortolkVariantnummer(variant.nummer)).toEqual({ ok: true, variant });
      }
    }
  });

  it("springer senest brugte numre over", () => {
    const fast = () => 0; // giver altid løbenummer 1
    expect(nytVariantnummer("delvis", [], fast).nummer).toBe("2000001");
    expect(nytVariantnummer("delvis", ["2000001", "2000002"], fast).nummer).toBe("2000003");
  });
});
