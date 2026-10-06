/**
 * Faste prøveopgaver til fase 2, så bogføringsbilledet kan afprøves, før
 * opgavegeneratoren findes (fase 3). Der er ét sæt pr. momsstatus med få bilag.
 * Alle konti og indholdslinjer findes i kontoplan.json; det kontrolleres af testene.
 */
import { formaterBeloeb } from "./beloeb";
import type { Momsstatus } from "./momsstatus";
import { formaterDato, type Bilag, type Opgave, type Saldo, type Side } from "./opgave";
import type { Variant } from "./variant";

const kr = (kroner: number) => Math.round(kroner * 100);
const beloeb = (kroner: number) => `${formaterBeloeb(kr(kroner))} kr.`;

interface Lejedata {
  /** Momspligtig kvartalsleje ekskl. moms. */
  momspligtig: number;
  /** Momsfri kvartalsleje. */
  momsfri: number;
}

const LEJE: Record<Momsstatus, Lejedata> = {
  momsfri: { momspligtig: 0, momsfri: 180_000 },
  delvis: { momspligtig: 96_000, momsfri: 84_000 },
  momspligtig: { momspligtig: 180_000, momsfri: 0 },
};

/** Momsfradragsprocent ved delvis moms: 96.000 / 180.000 = 53,33 %, rundet op = 54 %. */
const MOMSFRADRAGSPROCENT = 54;

function momsformulering(momsstatus: Momsstatus): string {
  if (momsstatus === "momsfri") return "Der kan ikke afløftes moms, da ejendommen er momsfri.";
  if (momsstatus === "delvis") {
    return `Der kan afløftes delvis moms, da ejendommen er delvis momsregistreret (momsfradragsprocenten er ${MOMSFRADRAGSPROCENT} %).`;
  }
  return "Der kan afløftes fuld moms, da ejendommen er fuldt momsregistreret.";
}

function lejetekst(momsstatus: Momsstatus, dato: string): string {
  const leje = LEJE[momsstatus];
  const indledning = `Ejendomsselskabet Ejendommen A/S opkræver den ${dato} husleje for 4. kvartal (oktober–december) hos ejendommens lejere.`;
  if (momsstatus === "momsfri") {
    return `${indledning} Lejeindtægter (ikke momspligtig) udgør ${beloeb(leje.momsfri)} Beløbet er indbetalt på bankkonto.`;
  }
  if (momsstatus === "delvis") {
    return `${indledning} Lejeindtægter (momspligtig) udgør ${beloeb(leje.momspligtig * 1.25)} inklusive moms, og lejeindtægter (ikke momspligtig) udgør ${beloeb(leje.momsfri)} Beløbet er indbetalt på bankkonto.`;
  }
  return `${indledning} Lejeindtægter (momspligtig) udgør ${beloeb(leje.momspligtig * 1.25)} inklusive moms. Beløbet er opkrævet, men endnu ikke indbetalt af lejer.`;
}

function danBilag(momsstatus: Momsstatus, aar: number): Bilag[] {
  const datoer = [`${aar}-10-01`, `${aar}-10-07`, `${aar}-10-14`, `${aar}-11-02`, `${aar}-11-30`];
  const d = datoer.map(formaterDato);
  const lejeIndhold =
    momsstatus === "momsfri"
      ? [{ konto: 1001, indhold: "Lejeindtægter (ikke momspligtig)" }]
      : momsstatus === "momspligtig"
        ? [{ konto: 1000, indhold: "Lejeindtægter (momspligtig)" }]
        : [
            { konto: 1000, indhold: "Lejeindtægter (momspligtig)" },
            { konto: 1001, indhold: "Lejeindtægter (ikke momspligtig)" },
          ];

  return [
    { nummer: 1, dato: datoer[0], tekst: lejetekst(momsstatus, d[0]), indhold: lejeIndhold },
    {
      nummer: 2,
      dato: datoer[1],
      tekst: `Nordlys Forsikring A/S fremsender den ${d[1]} præmie for bygningsforsikring på ${beloeb(15_300)} Forsikringen dækker perioden november indeværende regnskabsår til og med april efterfølgende regnskabsår. Der kan ikke afløftes moms, da beløbet er faktureret uden moms. Bilaget er betalt via bankkonto.`,
      indhold: [
        { konto: 2000, indhold: "Bygningsforsikring" },
        { konto: 20003, indhold: "Periodiserede forsikringer" },
      ],
    },
    {
      nummer: 3,
      dato: datoer[2],
      tekst: `Rørmester Holm ApS fakturerer den ${d[2]} VVS-arbejde, vedligeholdelse, på ejendommens faldstammer med ${beloeb(20_000)} inklusive moms. ${momsformulering(momsstatus)} Beløbet er skyldigt.`,
      indhold: [{ konto: 4001, indhold: "VVS-arbejde, vedligeholdelse" }],
    },
    {
      nummer: 4,
      dato: datoer[3],
      tekst: `Byadministration ApS opkræver den ${d[3]} administratorhonorar for 4. kvartal med ${beloeb(15_000)} inklusive moms. ${momsformulering(momsstatus)} Bilaget er betalt via kassekredit.`,
      indhold: [{ konto: 6000, indhold: "Administratorhonorar" }],
    },
    {
      nummer: 5,
      dato: datoer[4],
      tekst: `Andelskassen Midt indsætter den ${d[4]} renteindtægter på bankkonti med ${beloeb(1_234.56)} Beløbet er indbetalt på bankkonto.`,
      indhold: [{ konto: 7001, indhold: "Renteindtægter på bankkonti" }],
    },
  ];
}

function danSaldi(momsstatus: Momsstatus): Saldo[] {
  const leje = LEJE[momsstatus];
  const poster: [number, Side, number][] = [
    // Resultatopgørelsen: ca. 9 måneders drift (januar–september).
    [2000, "debet", 61_350],
    [2001, "debet", 9_450],
    [3000, "debet", 22_500],
    [3001, "debet", 15_825],
    [3002, "debet", 4_860],
    [4000, "debet", 18_900],
    [4001, "debet", 31_250],
    [5000, "debet", 9_375],
    [6000, "debet", 45_000],
    [6001, "debet", 22_500],
    [6002, "debet", 6_250],
    [6003, "debet", 1_162.5],
    [6004, "debet", 7_500],
    [6005, "debet", 1_680],
    [6006, "debet", 3_750],
    [6007, "debet", 2_500],
    [6008, "debet", 5_000],
    [6009, "debet", 3_600],
    [7000, "debet", 186_420.35],
    [7001, "kredit", 2_410.15],
    [9000, "debet", 38_500],
    // Balancen.
    [20000, "debet", 10_250_000],
    [20001, "debet", 820_000],
    [20002, "debet", 42_000],
    [20003, "debet", 28_400],
    [20004, "debet", 384_215.6],
    [30000, "kredit", 1_000_000],
    [30002, "kredit", 6_050_000],
    [30003, "kredit", 115_400],
    [30004, "kredit", 46_300],
  ];
  // Lejen er den samme i alle kvartaler, så saldoen ved start er 3 × kvartalslejen.
  if (leje.momspligtig > 0) poster.push([1000, "kredit", 3 * leje.momspligtig]);
  if (leje.momsfri > 0) poster.push([1001, "kredit", 3 * leje.momsfri]);
  if (momsstatus !== "momsfri") {
    // Salgsmoms = moms af 3. kvartals momspligtige leje; købsmoms ca. 3 måneders omkostninger.
    poster.push([30005, "kredit", leje.momspligtig * 0.25]);
    poster.push([30006, "debet", momsstatus === "delvis" ? 6_480 : 12_000]);
  }

  const saldi: Saldo[] = poster.map(([konto, side, kroner]) => ({ konto, side, oere: kr(kroner) }));
  // Overført resultat fra tidligere år (30001) udligner, så debet og kredit stemmer.
  const forskel = saldi.reduce((sum, s) => sum + (s.side === "debet" ? s.oere : -s.oere), 0);
  if (forskel <= 0) throw new Error("Prøveopgaven: 30001 skal have en kreditsaldo.");
  saldi.push({ konto: 30001, side: "kredit", oere: forskel });
  return saldi.sort((a, b) => a.konto - b.konto);
}

export function danProeveopgave(variant: Variant, aar: number = new Date().getFullYear()): Opgave {
  return {
    variant,
    aar,
    momsfradragsprocent: variant.momsstatus === "delvis" ? MOMSFRADRAGSPROCENT : null,
    saldi: danSaldi(variant.momsstatus),
    bilag: danBilag(variant.momsstatus, aar),
    erProeveopgave: true,
  };
}
