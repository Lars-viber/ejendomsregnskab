// @vitest-environment node
import { laesBilag } from "../src/regler/laesBilag";

/**
 * Håndskrevne bilagstekster med facit regnet i hånden efter Reference.docx.
 * Viser, at "læseren" bogfører korrekt uafhængigt af opgavegeneratoren.
 */
const kr = (x: number) => Math.round(x * 100);
const bogfoering = (tekst: string, saldi = new Map<number, number>()) =>
  Object.fromEntries([...laesBilag(tekst, saldi)].filter(([, v]) => v !== 0).map(([k, v]) => [k, v / 100]));

describe("læsning af bilagstekster", () => {
  const trappevask = (moms: string, likviditet: string) =>
    `Rengøringsfirma ApS fakturerer den 1. oktober 2026 trappevask i opgangene. Fakturaen lyder på 12.500,00 kr. inklusive moms. ${moms} ${likviditet}`;

  it("momsfri: hele beløbet inkl. moms er en omkostning (9.1)", () => {
    expect(bogfoering(trappevask("Der kan ikke afløftes moms, da ejendommen er momsfri.", "Bilaget er betalt via bankkonto."))).toEqual({
      3000: 12_500,
      20004: -12_500,
    });
  });

  it("delvis moms: kun fradragsprocenten af momsen er købsmoms (9.2)", () => {
    const tekst = trappevask(
      "Der kan afløftes delvis moms, da ejendommen er delvis momsregistreret (momsfradragsprocenten er 60 %).",
      "Beløbet er skyldigt.",
    );
    // moms 2.500, heraf 60 % = 1.500 til købsmoms; resten 1.000 indgår i omkostningen.
    expect(bogfoering(tekst)).toEqual({ 3000: 11_000, 30006: 1_500, 30004: -12_500 });
  });

  it("momspligtig: fuld købsmoms (9.1)", () => {
    const tekst = trappevask("Der kan afløftes fuld moms, da ejendommen er fuldt momsregistreret.", "Bilaget er betalt via kassekredit.");
    expect(bogfoering(tekst)).toEqual({ 3000: 10_000, 30006: 2_500, 30003: -12_500 });
  });

  it("husleje ved delvis moms med flertal (8.2 og 8.3)", () => {
    const tekst =
      "Ejendomsselskabet Ejendommen A/S opkræver den 1. oktober 2026 husleje for 4. kvartal (oktober–december) hos ejendommens lejere. Lejeindtægter (momspligtig) udgør 125.000,00 kr. inklusive moms, og lejeindtægter (ikke momspligtig) udgør 80.000,00 kr. Beløbene er opkrævet, men endnu ikke indbetalt af lejer.";
    expect(bogfoering(tekst)).toEqual({ 20002: 205_000, 1000: -100_000, 30005: -25_000, 1001: -80_000 });
  });

  it("bygningsforsikring periodiseres i hele måneder (8.4)", () => {
    const tekst =
      "Forsikring A/S fremsender den 5. november 2026 præmie for bygningsforsikring på 24.000,00 kr. Forsikringen dækker perioden november indeværende regnskabsår til og med oktober efterfølgende regnskabsår. Der kan ikke afløftes moms, da beløbet er faktureret uden moms. Bilaget er betalt via bankkonto.";
    // 12 måneder à 2.000 kr.; november og december vedrører indeværende år.
    expect(bogfoering(tekst)).toEqual({ 2000: 4_000, 20003: 20_000, 20004: -24_000 });
  });

  it("ydelse på realkreditlån deles på 7000 og 30002 (8.4)", () => {
    const tekst =
      "Realkredit A/S opkræver den 1. december 2026 kvartalets ydelse på ejendommens realkreditlån med i alt 130.000,00 kr. Ydelsen består af renteomkostninger på realkreditlån 60.000,00 kr., bidrag til realkreditinstitut 15.000,00 kr. og afdrag på realkreditlån 55.000,00 kr. Der kan ikke afløftes moms, da beløbene er faktureret uden moms. Bilaget er betalt via bankkonto.";
    expect(bogfoering(tekst)).toEqual({ 7000: 75_000, 30002: 55_000, 20004: -130_000 });
  });

  it("afslutning af momskonti bruger saldiene i T-kontiene (9.4)", () => {
    const saldi = new Map([
      [30005, kr(-70_000)],
      [30006, kr(30_000)],
    ]);
    const tekst =
      "Den 30. december 2026 afsluttes momskontiene for momsperioden juli–december 2026. Hele saldoen på salgsmoms og hele saldoen på købsmoms overføres til momsafregning. Bilaget har ingen likviditetseffekt.";
    expect(bogfoering(tekst, saldi)).toEqual({ 30005: 70_000, 30006: -30_000, 30007: -40_000 });
  });

  it("dagsværdiregulering, amortisering og renteindtægter (8.4)", () => {
    expect(
      bogfoering("Valuar ApS har den 30. december 2026 opgjort dagsværdien af investeringsejendommen. Dagsværdireguleringen for året er en nedskrivning på 150.000,00 kr. Bilaget har ingen likviditetseffekt."),
    ).toEqual({ 8000: 150_000, 20001: -150_000 });
    expect(
      bogfoering("Selskabets revisor har den 30. december 2026 opgjort årets amortisering af låneomkostninger på realkreditlån til 8.000,00 kr. Bilaget har ingen likviditetseffekt."),
    ).toEqual({ 7000: 8_000, 30002: -8_000 });
    expect(bogfoering("Bank A/S tilskriver den 1. december 2026 renteindtægter på bankkonti med 1.234,56 kr. Beløbet er indbetalt på bankkonto.")).toEqual({
      20004: 1_234.56,
      7001: -1_234.56,
    });
  });

  it("betaling af tidligere skyldig regning og lejers indbetaling (8.3)", () => {
    expect(
      bogfoering("Den 2. december 2026 betales regningen på 5.000,00 kr. fra VVS ApS, som er bogført som skyldig i bilag 4. En tidligere skyldig regning betales. Bilaget er betalt via kassekredit."),
    ).toEqual({ 30004: 5_000, 30003: -5_000 });
    expect(
      bogfoering("Den 2. november 2026 indbetaler lejerne 205.000,00 kr. af huslejen, der blev opkrævet i bilag 1. Lejer indbetaler tidligere opkrævet leje."),
    ).toEqual({ 20004: 205_000, 20002: -205_000 });
  });

  it("afviser en tekst uden likviditetsformulering", () => {
    expect(() => laesBilag("Firma ApS fakturerer den 1. oktober 2026 trappevask. Fakturaen lyder på 1.000,00 kr.", new Map())).toThrow();
  });
});
