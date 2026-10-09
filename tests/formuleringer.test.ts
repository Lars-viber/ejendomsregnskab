// @vitest-environment node
import { likviditetsformulering, momsformulering, type Likviditet } from "../src/domain/formuleringer";

describe("likviditetsformuleringer (8.3)", () => {
  it("står ordret som i Reference.docx, når bilaget nævner ét beløb", () => {
    const forventet: Record<Likviditet, string> = {
      kassekredit: "Bilaget er betalt via kassekredit.",
      bankkonto: "Bilaget er betalt via bankkonto.",
      indbetaltBank: "Beløbet er indbetalt på bankkonto.",
      skyldig: "Beløbet er skyldigt.",
      tidligereSkyldigBetales: "En tidligere skyldig regning betales.",
      opkraevetIkkeIndbetalt: "Beløbet er opkrævet, men endnu ikke indbetalt af lejerne.",
      lejerIndbetalerTidligere: "Lejerne indbetaler tidligere opkrævet leje.",
      ingenLikviditet: "Bilaget har ingen likviditetseffekt.",
    };
    for (const [likviditet, tekst] of Object.entries(forventet)) {
      expect(likviditetsformulering(likviditet as Likviditet, 1)).toBe(tekst);
    }
  });

  it("står i flertal, når bilaget nævner flere beløb", () => {
    expect(likviditetsformulering("indbetaltBank", 2)).toBe("Beløbene er indbetalt på bankkonto.");
    expect(likviditetsformulering("skyldig", 3)).toBe("Beløbene er skyldige.");
    expect(likviditetsformulering("opkraevetIkkeIndbetalt", 2)).toBe(
      "Beløbene er opkrævet, men endnu ikke indbetalt af lejerne.",
    );
  });

  it("ændrer ikke formuleringer uden 'Beløbet' i flertal", () => {
    expect(likviditetsformulering("bankkonto", 3)).toBe("Bilaget er betalt via bankkonto.");
    expect(likviditetsformulering("kassekredit", 3)).toBe("Bilaget er betalt via kassekredit.");
    expect(likviditetsformulering("ingenLikviditet", 2)).toBe("Bilaget har ingen likviditetseffekt.");
  });
});

describe("momsformuleringer (8.3)", () => {
  it("står ordret som i Reference.docx", () => {
    expect(momsformulering("momsfri")).toBe("Der kan ikke afløftes moms, da ejendommen er momsfri.");
    expect(momsformulering("delvisBolig")).toBe(
      "Fakturaen vedrører ejendommens boliglejemål, som er momsfritaget. Der kan ikke afløftes moms.",
    );
    expect(momsformulering("delvisErhverv")).toBe(
      "Fakturaen vedrører ejendommens momsregistrerede erhvervslejemål. Der kan afløftes fuld moms.",
    );
    expect(momsformulering("delvisHele", { momsfradragsprocent: 54 })).toBe(
      "Fakturaen vedrører hele ejendommen. Der kan afløftes delvis moms med momsfradragsprocenten (54 %).",
    );
    expect(momsformulering("fuld")).toBe("Der kan afløftes fuld moms, da ejendommen er fuldt momsregistreret.");
    expect(momsformulering("faktureretUdenMoms")).toBe(
      "Der kan ikke afløftes moms, da beløbet er faktureret uden moms.",
    );
  });

  it("står i flertal ved flere beløb faktureret uden moms", () => {
    expect(momsformulering("faktureretUdenMoms", { antalBeloeb: 2 })).toBe(
      "Der kan ikke afløftes moms, da beløbene er faktureret uden moms.",
    );
  });

  it("kræver momsfradragsprocenten, når fakturaen vedrører hele ejendommen", () => {
    expect(() => momsformulering("delvisHele")).toThrow();
  });
});
