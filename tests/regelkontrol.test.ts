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
const momspligtig = danOpgave(danVariant("momspligtig", 4242), 2026);
const kopi = (o: Opgave): Opgave => structuredClone(o);
/** Første opgave (momsfri), der indeholder et bilag af typen. */
const medBilagstype = (type: string): Opgave => {
  for (let n = 1; ; n++) {
    const o = danOpgave(danVariant("momsfri", n), 2026);
    if (o.bilag.some((b) => b.type === type)) return kopi(o);
  }
};
const fejlI = (o: Opgave) => kontrollerOpgave(o).join("\n");

describe("regelkontrollen", () => {
  it("godkender gyldige opgaver", () => {
    expect(kontrollerOpgave(delvis)).toEqual([]);
    expect(kontrollerOpgave(momsfri)).toEqual([]);
  });

  it("opdager en bankkonto i overtræk (10.2)", () => {
    const o = kopi(delvis);
    // Bankkontoen sættes i overtræk (kreditsaldo på 100 kr.) ved start; 30001 justeres, så debet = kredit.
    const bank = o.saldi.find((s) => s.konto === 20004)!;
    const overfoert = o.saldi.find((s) => s.konto === 30001)!;
    overfoert.oere -= bank.oere + 100;
    bank.side = "kredit";
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

  it("godkender en gyldig momspligtig opgave", () => {
    expect(kontrollerOpgave(momspligtig)).toEqual([]);
  });

  it("(a) opdager beboelse i en bilagstekst ved momspligtig ejendom (9.1)", () => {
    for (const ord of ["en lejlighed", "boligportaler", "et badeværelse", "beboerne"]) {
      const o = kopi(momspligtig);
      const bilag = o.bilag.find((b) => b.type === "vedligeholdelse")!;
      bilag.tekst = bilag.tekst.replace(". Fakturaen lyder på", ` ved ${ord}. Fakturaen lyder på`);
      expect(fejlI(o)).toMatch(/nævner eller antyder beboelse/);
    }
  });

  it("(b) opdager en faktura ved delvis moms uden præcis én af de tre formuleringer (8.3)", () => {
    const o = kopi(delvis);
    const bilag = o.bilag.find((b) => b.type === "administrator")!;
    bilag.tekst = bilag.tekst.replace(/Fakturaen vedrører hele ejendommen\. Der kan afløftes delvis moms med momsfradragsprocenten \(\d+ %\)\./, "");
    expect(fejlI(o)).toMatch(/ikke præcis én af de tre formuleringer/);
  });

  it("(b) opdager en beskrivelse, der ikke nævner delen direkte (8.3)", () => {
    const o = kopi(delvis);
    const bilag = o.bilag.find((b) => b.tekst.includes("Fakturaen vedrører ejendommens momsregistrerede erhvervslejemål"))!;
    bilag.tekst = bilag.tekst.replace(/den (\d{1,2}\. \S+ \d{4}) .*?\. Fakturaen lyder på/, "den $1 diverse arbejde. Fakturaen lyder på");
    expect(fejlI(o)).toMatch(/nævner ikke direkte/);
  });

  it("(b) opdager en opgave med delvis moms uden et bilag af hver type (9.2)", () => {
    const o = kopi(delvis);
    for (const bilag of o.bilag) bilag.tekst = bilag.tekst.replace("Fakturaen vedrører ejendommens boliglejemål, som er momsfritaget. Der kan ikke afløftes moms.", "");
    expect(fejlI(o)).toMatch(/intet bilag, der vedrører boligdelen/);
  });

  it("(c) opdager et periodiseringsbilag uden 30 dage pr. måned og 360 dage pr. år (8.4)", () => {
    const o = kopi(momsfri);
    const bilag = o.bilag.find((b) => b.type === "forsikring")!;
    bilag.tekst = bilag.tekst.replace(" Der regnes med 30 dage pr. måned og 360 dage pr. år.", "");
    expect(fejlI(o)).toMatch(/oplyser ikke 30 dage pr\. måned og 360 dage pr\. år/);
  });

  it("(d) opdager ordene opskrivning og nedskrivning (8.4)", () => {
    const o = kopi(momsfri);
    const bilag = o.bilag.find((b) => b.type === "dagsvaerdi")!;
    bilag.tekst = bilag.tekst.replace(/(positiv|negativ) dagsværdiregulering/, "opskrivning");
    expect(fejlI(o)).toMatch(/bruger "opskrivning" eller "nedskrivning"/);
  });

  it("(e) opdager tidligere opkrævet leje uden oplysning om kontoen (8.3)", () => {
    const o = medBilagstype("lejerIndbetaler");
    const bilag = o.bilag.find((b) => b.type === "lejerIndbetaler")!;
    bilag.tekst = bilag.tekst.replace(" Beløbet er indbetalt på bankkonto.", "");
    expect(fejlI(o)).toMatch(/oplyser ikke, hvilken konto lejen indbetales på/);
  });

  it("opdager lejerne omtalt i ental (8.3, version 1.5)", () => {
    const o = medBilagstype("lejerIndbetaler");
    const bilag = o.bilag.find((b) => b.type === "lejerIndbetaler")!;
    bilag.tekst = bilag.tekst.replace("indbetaler lejerne", "indbetaler en lejer");
    expect(fejlI(o)).toMatch(/omtaler lejerne i ental/);
  });

  it("(e) opdager en tidligere skyldig regning uden oplysning om kontoen (8.3)", () => {
    const o = medBilagstype("tidligereSkyldig");
    const bilag = o.bilag.find((b) => b.type === "tidligereSkyldig")!;
    bilag.tekst = bilag.tekst.replace(/ Bilaget er betalt via (bankkonto|kassekredit)\./, "");
    expect(fejlI(o)).toMatch(/angiver ikke, hvordan den tidligere skyldige regning betales/);
  });

  it("(f) opdager ental, når et bilag nævner flere beløb (8.3)", () => {
    const o = kopi(delvis);
    const bilag = o.bilag.find((b) => b.type === "realkredit")!;
    bilag.tekst = bilag.tekst.replace("da beløbene er faktureret uden moms", "da beløbet er faktureret uden moms");
    expect(fejlI(o)).toMatch(/mangler "Der kan ikke afløftes moms, da beløbene er faktureret uden moms\."/);
  });

  it("(g) opdager et resultat før skat under 5 % af lejeindtægterne (10.2)", () => {
    const o = kopi(momsfri);
    const leje = o.saldi.find((s) => s.konto === 1001)!.oere * (4 / 3);
    o.saldi.find((s) => s.konto === 6005)!.oere += Math.round(leje * 0.6);
    expect(fejlI(o)).toMatch(/resultat før skat er under 5 %/);
  });
});
