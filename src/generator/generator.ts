/**
 * Opgavegeneratoren (PLAN.md afsnit b). Danner en opgave ud fra et variantnummer:
 * byg → kontrollér med den uafhængige regelkontrol → prøv igen med næste forsøgsnummer.
 * Alt er reproducerbart: samme variantnummer giver altid samme bilag og beløb.
 * Kun årstallet (og dermed datoerne) følger det år, opgaven dannes i (Reference.docx 8.1).
 */
import { bankdageIMaaned, sidsteBankdagIDecember } from "../domain/bankdage";
import { formaterBeloeb } from "../domain/beloeb";
import { likviditetsformulering, momsformulering, type Likviditet } from "../domain/formuleringer";
import { KONTOPLAN } from "../domain/kontoplan";
import {
  MAANEDER,
  formaterDato,
  type Bilag,
  type Bilagstype,
  type FacitLinje,
  type Indholdshenvisning,
  type Opgave,
  type Saldo,
  type Side,
} from "../domain/opgave";
import type { Variant } from "../domain/variant";
import { kontrollerOpgave } from "../regler/regelkontrol";
import { danTilfaeldig, type Tilfaeldig } from "./tilfaeldig";
import {
  BANKER,
  FORBEDRINGER,
  FORSIKRINGSSELSKABER,
  INDHOLDSTEKSTER,
  REALKREDITINSTITUTTER,
  VALUARER,
} from "./tekster";

export const GENERATOR_VERSION = 1;
/** Forsøgene vælges altid ud fra dette år, så valget ikke afhænger af årstallet. */
const REFERENCEAAR = 2026;
const MAKS_FORSOEG = 60;
/** Fra dette forsøg bruges smallere, "midt i intervallet"-rammer. */
const KONSERVATIV_FRA = 30;

const KR = 100;
const BANKBUFFER = 20_000 * KR;
const BANK = BANKER[0];

// ---------------------------------------------------------------------------
// Hjælpefunktioner
// ---------------------------------------------------------------------------

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const afrund = (x: number, trin: number) => Math.round(x / trin) * trin;
const nedrund = (x: number, trin: number) => Math.floor(x / trin) * trin;
const oprund = (x: number, trin: number) => Math.ceil(x / trin) * trin;
const kr = (beloeb: number) => `${formaterBeloeb(beloeb)} kr.`;

/** Første bogstav med lille, undtagen forkortelser som "VVS" og "IT". */
function smaaForbogstav(tekst: string): string {
  return /^[A-ZÆØÅ]{2}/.test(tekst) ? tekst : tekst.charAt(0).toLowerCase() + tekst.slice(1);
}

type Placering =
  | { slags: "foersteOktober" }
  | { slags: "sidsteDecember"; prioritet: number }
  | { slags: "maaned"; maaned: number; andel: number };

function sorteringsnoegle(p: Placering): [number, number] {
  if (p.slags === "foersteOktober") return [10, -1];
  if (p.slags === "sidsteDecember") return [13, p.prioritet];
  return [p.maaned, p.andel];
}

function datoFor(p: Placering, aar: number): string {
  if (p.slags === "foersteOktober") return bankdageIMaaned(aar, 10)[0];
  if (p.slags === "sidsteDecember") return sidsteBankdagIDecember(aar);
  const dage = bankdageIMaaned(aar, p.maaned);
  return dage[Math.min(Math.floor(p.andel * dage.length), dage.length - 1)];
}

/** Et bilag, før datoen kendes. Teksten dannes, når årstallet er givet. */
interface BilagModel {
  type: Bilagstype;
  placering: Placering;
  indhold: Indholdshenvisning[];
  likviditet: Likviditet;
  facit: FacitLinje[];
  tekst: (dato: string, aar: number) => string;
}

interface Model {
  momsfradragsprocent: number | null;
  saldi: Saldo[];
  bilag: BilagModel[];
}

/** Planlagt bilag (før likviditet og facit er fastlagt). */
interface Plan {
  type: Bilagstype;
  placering: Placering;
  indhold: Indholdshenvisning[];
  afsender: string;
  /** Hovedbeløbet i øre (brutto for momsbelagte bilag). */
  beloeb: number;
  /** Konto for omkostningen eller indtægten. */
  konto?: number;
  inklMoms?: boolean;
  /** Tekst efter indholdsteksten i en almindelig omkostning. */
  beskrivelse?: string;
  forsikring?: { start: number; maaneder: number; maanedspraemie: number };
  realkredit?: { rente: number; bidrag: number; afdrag: number };
  projekt?: string;
}

// ---------------------------------------------------------------------------
// Opbygning af én opgave (ét forsøg)
// ---------------------------------------------------------------------------

function byg(variant: Variant, forsoeg: number): Model | null {
  const r: Tilfaeldig = danTilfaeldig(`${GENERATOR_VERSION}|${variant.nummer}|${forsoeg}`);
  const kons = forsoeg >= KONSERVATIV_FRA;
  const iv = (a: number, b: number, ka = a, kb = b) => (kons ? r.interval(ka, kb) : r.interval(a, b));
  const status = variant.momsstatus;
  const moms = status !== "momsfri";

  // Trin 1: momsfradragsprocent (9.2).
  const p = status === "delvis" ? r.heltal(40, 65) : null;
  const fradragsandel = status === "momsfri" ? 0 : status === "delvis" ? p! / 100 : 1;
  // Momsen (brutto/5) og ved delvis moms også p % af momsen skal give hele kroner (9.3).
  const bruttoTrin = 5 * (status === "delvis" ? 100 / gcd(p!, 100) : 1) * KR;
  const fradrag = (brutto: number) => (status === "momsfri" ? 0 : ((brutto / 5) * (p ?? 100)) / 100);
  const momsbelagt = (bogfoert: number, min = 2_000 * KR, max = 150_000 * KR) => {
    const brutto = afrund(bogfoert / (1 - 0.2 * fradragsandel), bruttoTrin);
    return Math.min(Math.max(brutto, oprund(min, bruttoTrin)), nedrund(max, bruttoTrin));
  };
  const medOere = (beloeb: number) => Math.round(beloeb); // beløb uden moms må have øre (9.3)

  // Trin 2: opgavens størrelse (10.2 og 10.3).
  const ejendom = r.heltal(kons ? 9_500 : 8_000, kons ? 13_000 : 15_000) * 1_000 * KR;
  const regStart = afrund(ejendom * iv(-0.12, 0.12, -0.06, 0.06), 1_000 * KR);
  const laan = afrund((ejendom + regStart) * iv(0.51, 0.59, 0.53, 0.57), 1_000 * KR);
  const kvartal = afrund((ejendom * iv(0.058, 0.075, 0.062, 0.07)) / 4, 100 * KR);
  let momspligtigKvartal = 0;
  let momsfriKvartal = 0;
  if (status === "momsfri") momsfriKvartal = kvartal;
  else if (status === "momspligtig") momspligtigKvartal = kvartal;
  else {
    // (p − 1) % < momspligtig andel ≤ p %, så den oprundede procent bliver præcis p (9.2).
    momspligtigKvartal = nedrund((kvartal * p!) / 100, 100 * KR);
    momsfriKvartal = kvartal - momspligtigKvartal;
  }
  const kvartalBrutto = (momspligtigKvartal * 5) / 4 + momsfriKvartal;
  const lejeAar = 4 * kvartal;

  const niveau: Record<number, number> = {
    2000: lejeAar * iv(0.07, 0.12, 0.08, 0.1),
    2001: lejeAar * iv(0.006, 0.015, 0.008, 0.012),
    3000: lejeAar * iv(0.02, 0.04, 0.025, 0.035),
    3001: lejeAar * iv(0.015, 0.03, 0.018, 0.025),
    3002: lejeAar * iv(0.003, 0.006),
    6000: lejeAar * iv(0.04, 0.06, 0.045, 0.055),
    6001: lejeAar * iv(0.012, 0.025, 0.015, 0.02),
    6002: lejeAar * iv(0.002, 0.01, 0.004, 0.008),
    6003: lejeAar * iv(0.0005, 0.0015),
    6004: lejeAar * iv(0.003, 0.01, 0.005, 0.008),
    6005: lejeAar * iv(0.001, 0.003),
    6006: lejeAar * iv(0.002, 0.008, 0.003, 0.006),
    6007: lejeAar * iv(0.001, 0.005, 0.002, 0.004),
    6008: lejeAar * iv(0.003, 0.012, 0.005, 0.01),
    6009: lejeAar * iv(0.003, 0.01, 0.005, 0.008),
  };
  const maalVedligehold = lejeAar * iv(0.103, 0.117, 0.108, 0.112);
  const maal7000 = lejeAar * iv(0.31, 0.39, 0.33, 0.37);
  const GRUPPE = [4000, 4001, 5000];

  // Trin 3: bilagslisten (8.2).
  const plan: Plan[] = [];
  const lejeOpkraeves = r.chance(0.4);
  plan.push({
    type: "leje",
    placering: { slags: "foersteOktober" },
    indhold: [
      ...(momspligtigKvartal > 0 ? [{ konto: 1000, indhold: "Lejeindtægter (momspligtig)" }] : []),
      ...(momsfriKvartal > 0 ? [{ konto: 1001, indhold: "Lejeindtægter (ikke momspligtig)" }] : []),
    ],
    afsender: "Ejendomsselskabet Ejendommen A/S",
    beloeb: kvartalBrutto,
  });

  const forsikringStart = r.heltal(10, 12);
  const forsikringMaaneder = r.vaelg([6, 12]);
  const maanedspraemie = medOere((ejendom * iv(0.0012, 0.0024, 0.0015, 0.002)) / 12);
  plan.push({
    type: "forsikring",
    placering: { slags: "maaned", maaned: r.heltal(10, forsikringStart), andel: iv(0.05, 0.95) },
    indhold: [
      { konto: 2000, indhold: "Bygningsforsikring" },
      { konto: 20003, indhold: "Periodiserede forsikringer" },
    ],
    afsender: r.vaelg(FORSIKRINGSSELSKABER),
    beloeb: maanedspraemie * forsikringMaaneder,
    forsikring: { start: forsikringStart, maaneder: forsikringMaaneder, maanedspraemie },
  });

  const renteBidrag = medOere(maal7000 * iv(0.19, 0.24, 0.2, 0.23));
  const bidrag = medOere(renteBidrag * iv(0.15, 0.3));
  const afdrag = afrund(laan * iv(0.0055, 0.0095, 0.006, 0.009), KR);
  plan.push({
    type: "realkredit",
    placering: { slags: "maaned", maaned: r.heltal(10, 12), andel: iv(0.05, 0.95) },
    indhold: [
      { konto: 7000, indhold: "Renteomkostninger på realkreditlån" },
      { konto: 7000, indhold: "Bidrag til realkreditinstitut" },
      { konto: 30002, indhold: "Realkreditlån, afdrag på realkreditlån" },
    ],
    afsender: r.vaelg(REALKREDITINSTITUTTER),
    beloeb: renteBidrag + afdrag,
    realkredit: { rente: renteBidrag - bidrag, bidrag, afdrag },
  });

  plan.push({
    type: "administrator",
    placering: { slags: "maaned", maaned: 10, andel: iv(0.05, 0.6) },
    indhold: [{ konto: 6000, indhold: "Administratorhonorar" }],
    afsender: r.vaelg(INDHOLDSTEKSTER["Administratorhonorar"].afsendere),
    beloeb: momsbelagt(niveau[6000] / 4),
    konto: 6000,
    inklMoms: true,
    beskrivelse: INDHOLDSTEKSTER["Administratorhonorar"].beskrivelse,
  });

  const konto4001 = KONTOPLAN.find((k) => k.nummer === 4001)!;
  const vedligeholdLinje = r.vaelg(konto4001.indhold).tekst;
  const vedligeholdTekst = INDHOLDSTEKSTER[vedligeholdLinje];
  plan.push({
    type: "vedligeholdelse",
    placering: { slags: "maaned", maaned: r.vaelg(vedligeholdTekst.maaneder ?? [10, 11, 12]), andel: iv(0.05, 0.95) },
    indhold: [{ konto: 4001, indhold: vedligeholdLinje }],
    afsender: r.vaelg(vedligeholdTekst.afsendere),
    beloeb: momsbelagt(maalVedligehold * iv(0.08, 0.16, 0.1, 0.14)),
    konto: 4001,
    inklMoms: true,
    beskrivelse: vedligeholdTekst.beskrivelse,
  });

  const forbedring = r.vaelg(FORBEDRINGER);
  const forbedringPlan: Plan = {
    type: "forbedring",
    placering: { slags: "maaned", maaned: r.heltal(10, 12), andel: iv(0.05, 0.95) },
    indhold: [{ konto: 20000, indhold: "Forbedringer, tømrer, murer, vvs, arkitekt, ingeniør, el" }],
    afsender: forbedring.afsender,
    beloeb: 0, // fastlægges, når momsen kendes (9.4)
    konto: 20000,
    inklMoms: true,
    projekt: forbedring.projekt,
  };
  plan.push(forbedringPlan);

  const dagsvaerdiPlan: Plan = {
    type: "dagsvaerdi",
    placering: { slags: "sidsteDecember", prioritet: 1 },
    indhold: [
      { konto: 8000, indhold: "Dagsværdiregulering af investeringsejendom" },
      { konto: 20001, indhold: "Positive og negative dagsværdireguleringer" },
    ],
    afsender: r.vaelg(VALUARER),
    beloeb: 0, // fastlægges til sidst (resultat og skat)
  };
  plan.push(dagsvaerdiPlan);

  const amortisering = medOere(iv(1_500, 19_000, 4_000, 15_000) * KR);
  plan.push({
    type: "amortisering",
    placering: { slags: "sidsteDecember", prioritet: 2 },
    indhold: [{ konto: 7000, indhold: "Amortisering af låneomkostninger på realkreditlån" }],
    afsender: "Selskabets revisor",
    beloeb: amortisering,
  });

  if (moms) {
    plan.push({
      type: "momsafslutning",
      placering: { slags: "sidsteDecember", prioritet: 3 },
      indhold: [{ konto: 30005, indhold: "Salgsmoms" }, { konto: 30006, indhold: "Købsmoms" }, { konto: 30007, indhold: "Momsafregning" }],
      afsender: "",
      beloeb: 0,
    });
    plan.push({
      type: "momsbetaling",
      placering: { slags: "sidsteDecember", prioritet: 4 },
      indhold: [{ konto: 30007, indhold: "Momsafregning" }],
      afsender: "Skattestyrelsen",
      beloeb: 0,
    });
  }

  // De øvrige bilag (rotation mellem varianterne).
  const pladser = 20 - plan.length;
  const oevrige: Plan[] = [];
  if (lejeOpkraeves || r.chance(0.5)) {
    oevrige.push({
      type: "lejerIndbetaler",
      placering: { slags: "maaned", maaned: lejeOpkraeves ? r.heltal(10, 11) : r.heltal(10, 12), andel: iv(0.1, 0.95) },
      indhold: [{ konto: 20002, indhold: "Tilgodehavende lejeindtægter, opkrævede ikke betalt leje" }],
      afsender: "",
      beloeb: 0,
    });
  }
  if (r.chance(0.7)) {
    oevrige.push({
      type: "tidligereSkyldig",
      placering: { slags: "maaned", maaned: r.heltal(11, 12), andel: iv(0.05, 0.95) },
      indhold: [{ konto: 30004, indhold: "Alle køb på kredit" }],
      afsender: "",
      beloeb: 0,
    });
  }
  if (r.chance(0.6)) {
    oevrige.push({
      type: "renteindtaegter",
      placering: { slags: "maaned", maaned: r.heltal(10, 12), andel: iv(0.05, 0.95) },
      indhold: [{ konto: 7001, indhold: "Renteindtægter på bankkonti" }],
      afsender: BANK,
      beloeb: medOere(iv(150, 4_800) * KR),
      konto: 7001,
    });
  }
  if (r.chance(0.6)) {
    oevrige.push({
      type: "kassekreditrenter",
      placering: { slags: "maaned", maaned: r.heltal(10, 12), andel: iv(0.05, 0.95) },
      indhold: [{ konto: 7000, indhold: "Renteomkostninger på kassekredit" }],
      afsender: BANK,
      beloeb: 0, // afhænger af trækket på kassekreditten
      konto: 7000,
    });
  }
  if (r.chance(0.5)) {
    oevrige.push({
      type: "omkostning",
      placering: { slags: "maaned", maaned: r.heltal(10, 12), andel: iv(0.05, 0.95) },
      indhold: [{ konto: 6003, indhold: "Overførselsgebyr, hævegebyr, netbankgebyr" }],
      afsender: BANK,
      beloeb: medOere(iv(150, 900) * KR),
      konto: 6003,
      inklMoms: false,
      beskrivelse: INDHOLDSTEKSTER["Overførselsgebyr, hævegebyr, netbankgebyr"].beskrivelse,
    });
  }

  // Indholdslinjer fra kontoplanen til de resterende pladser.
  const UDELUKKET = new Set(["Administratorhonorar", "Bygningsforsikring", "Overførselsgebyr, hævegebyr, netbankgebyr", vedligeholdLinje]);
  const pulje = KONTOPLAN.filter((k) => k.kategori === "Omkostning" && ![7000, 8000, 9000].includes(k.nummer)).flatMap((k) =>
    k.indhold
      .filter((l) => !UDELUKKET.has(l.tekst) && !(status === "momsfri" && l.tekst === "Dækningsafgift"))
      .map((l) => ({ konto: k.nummer, tekst: l.tekst, inklMoms: l.inklusiveMoms === true })),
  );
  const valgte: typeof pulje = [];
  const vaelgFra = (filter: (l: (typeof pulje)[number]) => boolean) => {
    const muligheder = pulje.filter((l) => filter(l) && !valgte.includes(l));
    // Helst en konto, der ikke allerede har et bilag, så opgaven dækker flere konti.
    const nyeKonti = muligheder.filter((l) => !valgte.some((v) => v.konto === l.konto));
    const liste = nyeKonti.length > 0 ? nyeKonti : muligheder;
    if (liste.length > 0) valgte.push(r.vaelg(liste));
  };
  if (r.chance(0.85)) vaelgFra((l) => l.konto === 5000);
  if (r.chance(0.7)) vaelgFra((l) => l.konto === 4000);
  if (r.chance(0.75)) vaelgFra((l) => !l.inklMoms);
  if (r.chance(0.3)) vaelgFra((l) => !l.inklMoms);
  while (oevrige.length + valgte.length < pladser) {
    const gruppeAntal = valgte.filter((l) => GRUPPE.includes(l.konto)).length;
    const udenMomsAntal = valgte.filter((l) => !l.inklMoms).length;
    const foer = valgte.length;
    vaelgFra((l) => l.inklMoms && (gruppeAntal < 3 || !GRUPPE.includes(l.konto)) && (udenMomsAntal < 3 || l.inklMoms));
    if (valgte.length === foer) return null;
  }
  valgte.splice(pladser - oevrige.length);
  for (const linje of valgte) {
    const tekster = INDHOLDSTEKSTER[linje.tekst];
    if (!tekster) throw new Error(`Mangler bilagstekst for indholdslinjen "${linje.tekst}".`);
    let beloeb: number;
    if (linje.inklMoms) {
      const bogfoert = GRUPPE.includes(linje.konto)
        ? maalVedligehold * iv(0.025, 0.07, 0.03, 0.05)
        : (niveau[linje.konto] / 4) * iv(0.7, 1.3, 0.85, 1.15);
      // Små kvartalsbeløb hæves til en tilfældig, plausibel faktura over minimumsrammen på 2.000 kr.
      const mindst = iv(2_000, 4_500) * KR * (1 - 0.2 * fradragsandel);
      beloeb = momsbelagt(Math.max(bogfoert, mindst));
    } else {
      const udenMoms: Record<string, () => number> = {
        "Grundskyld / ejendomsskatter": () => niveau[2000] * iv(0.3, 0.4),
        "Dækningsafgift": () => niveau[2000] * iv(0.08, 0.15),
        "Renovationsafgifter": () => niveau[2000] * iv(0.04, 0.08),
        "Rottebekæmpelsesafgift": () => iv(300, 1_500) * KR,
        "Skorstensfejning, kommunal": () => iv(600, 2_500) * KR,
        "Grundejerforeningsbidrag": () => niveau[2001] * iv(0.35, 0.5),
        "Fællesforeningsbidrag": () => niveau[2001] * iv(0.15, 0.25),
      };
      const beregn = udenMoms[linje.tekst];
      if (!beregn) throw new Error(`Mangler beløbsramme for "${linje.tekst}".`);
      beloeb = medOere(beregn());
    }
    oevrige.push({
      type: "omkostning",
      placering: { slags: "maaned", maaned: r.vaelg(tekster.maaneder ?? [10, 11, 12]), andel: iv(0.05, 0.95) },
      indhold: [{ konto: linje.konto, indhold: linje.tekst }],
      afsender: r.vaelg(tekster.afsendere),
      beloeb,
      konto: linje.konto,
      inklMoms: linje.inklMoms,
      beskrivelse: tekster.beskrivelse,
    });
  }
  plan.push(...oevrige);
  if (plan.length !== 20) return null;

  // Kronologisk rækkefølge; bilag 19 og 20 er momsbilagene (8.2).
  plan.sort((a, b) => {
    const [a1, a2] = sorteringsnoegle(a.placering);
    const [b1, b2] = sorteringsnoegle(b.placering);
    return a1 - b1 || a2 - b2;
  });

  // Trin 4–6: saldi ved start på resultatkontiene (bagfra fra målene i 10.2) og beløb.
  const kassekreditStart = medOere(iv(60_000, 480_000, 100_000, 400_000) * KR);
  for (const pl of plan) if (pl.type === "kassekreditrenter") pl.beloeb = medOere(kassekreditStart * iv(0.012, 0.022));

  const bogfoertBeloeb = (pl: Plan) => (pl.inklMoms ? pl.beloeb - fradrag(pl.beloeb) : pl.beloeb);
  const q4Paa = (konto: number) =>
    plan.filter((pl) => pl.konto === konto && pl.type !== "renteindtaegter").reduce((s, pl) => s + bogfoertBeloeb(pl), 0);
  const q4Gruppe = GRUPPE.reduce((s, k) => s + q4Paa(k), 0);
  const startGruppe = maalVedligehold - q4Gruppe;
  if (startGruppe < 0.45 * maalVedligehold) return null;
  const andel4001 = iv(0.4, 0.55);
  const andel4000 = iv(0.15, 0.25);
  const q4Af7000 = renteBidrag + amortisering + plan.filter((pl) => pl.type === "kassekreditrenter").reduce((s, pl) => s + pl.beloeb, 0);
  const start7000 = maal7000 - q4Af7000;
  if (start7000 < 0.5 * maal7000) return null;

  const startResultat = new Map<number, number>();
  for (const [konto, aarligt] of Object.entries(niveau)) startResultat.set(Number(konto), aarligt * 0.75 * iv(0.92, 1.08));
  startResultat.set(2000, (niveau[2000] + 12 * maanedspraemie) * 0.75 * iv(0.95, 1.05));
  startResultat.set(4001, startGruppe * andel4001);
  startResultat.set(4000, startGruppe * andel4000);
  startResultat.set(5000, startGruppe * (1 - andel4001 - andel4000));
  startResultat.set(7000, start7000);
  for (const [konto, beloeb] of startResultat) startResultat.set(konto, medOere(beloeb));
  const start7001 = medOere(iv(800, 6_000) * KR);

  // Købsmoms ved start = momsen af ca. 3 måneders momsbelagte omkostninger (10.3).
  let koebsmomsStart = 0;
  if (moms) {
    let fradrag9 = 0;
    for (const k of KONTOPLAN) {
      if (k.kategori !== "Omkostning" || !k.indhold.every((l) => l.inklusiveMoms === true)) continue;
      const saldo = startResultat.get(k.nummer) ?? 0;
      fradrag9 += (saldo / (1 + 0.25 * (1 - fradragsandel))) * 0.25 * fradragsandel;
    }
    koebsmomsStart = afrund((fradrag9 / 3) * iv(0.9, 1.1, 0.95, 1.05), KR);
  }
  const salgsmomsStart = momspligtigKvartal / 4; // moms af 3. kvartals leje

  // Forbedringen: så stor som rammen tillader, men salgsmomsen skal altid være højest (9.4).
  if (moms) {
    let koebsmoms = koebsmomsStart;
    let salgsmoms = salgsmomsStart;
    let plads = Infinity;
    let efterForbedring = false;
    for (const pl of plan) {
      if (pl.type === "momsafslutning") break;
      if (pl.type === "leje") salgsmoms += momspligtigKvartal / 4;
      if (pl.type === "forbedring") efterForbedring = true;
      else if (pl.inklMoms) koebsmoms += fradrag(pl.beloeb);
      if (salgsmoms - koebsmoms <= 0) return null;
      if (efterForbedring) plads = Math.min(plads, salgsmoms - koebsmoms);
    }
    // Største brutto, hvis fradragsberettigede moms er mindre end pladsen.
    const maksBrutto = nedrund(((plads - KR) * 5 * 100) / (p ?? 100), bruttoTrin);
    if (fradrag(oprund(100_000 * KR, bruttoTrin)) < plads) {
      const top = Math.min(750_000 * KR, maksBrutto);
      forbedringPlan.beloeb = nedrund(iv(100_000 * KR, top), 1_000 * KR);
      if (forbedringPlan.beloeb < 100_000 * KR || fradrag(forbedringPlan.beloeb) >= plads) forbedringPlan.beloeb = oprund(100_000 * KR, bruttoTrin);
    } else {
      forbedringPlan.beloeb = maksBrutto;
      if (forbedringPlan.beloeb < 20_000 * KR) return null;
    }
  } else {
    forbedringPlan.beloeb = nedrund(iv(100_000, 750_000, 150_000, 600_000) * KR, 1_000 * KR);
  }

  // Trin 5: saldi ved start på balancekontiene og likviditet bilag for bilag.
  const bankStart = medOere(iv(150_000, 750_000, 400_000, 700_000) * KR);
  const tilgodehavendeStart = medOere((kvartalBrutto / 3) * iv(0.25, 0.95));
  const kreditorStart = medOere(iv(30_000, 240_000, 50_000, 200_000) * KR);
  const periodeStart = medOere(iv(15_000, 140_000) * KR);

  let bank = bankStart;
  let kreditorer = kreditorStart;
  let foerStartSkyldig = kreditorStart;
  let foerStartTilgodehavende = tilgodehavendeStart;
  let lejeUbetalt = 0;
  const ubetalteRegninger: { nummer: number; afsender: string; beloeb: number }[] = [];
  let salgsmoms = salgsmomsStart;
  let koebsmoms = koebsmomsStart;
  const modeller: BilagModel[] = [];

  const vaelgBetaling = (beloeb: number, muligt: Likviditet[]): Likviditet | null => {
    const vaegt: Partial<Record<Likviditet, number>> = { bankkonto: 0.5, kassekredit: 0.25, skyldig: 0.25 };
    const muligheder = muligt.filter((l) => {
      if (l === "bankkonto") return bank - beloeb >= BANKBUFFER;
      if (l === "skyldig") return kreditorer + beloeb <= 450_000 * KR;
      return true;
    });
    if (muligheder.length === 0) return null;
    const samlet = muligheder.reduce((s, l) => s + (vaegt[l] ?? 0), 0);
    let x = r.tal() * samlet;
    for (const l of muligheder) {
      x -= vaegt[l] ?? 0;
      if (x < 0) return l;
    }
    return muligheder[muligheder.length - 1];
  };
  const kreditKonto = (l: Likviditet) => (l === "bankkonto" ? 20004 : l === "kassekredit" ? 30003 : 30004);
  const betal = (l: Likviditet, beloeb: number) => {
    if (l === "bankkonto") bank -= beloeb;
    if (l === "skyldig") kreditorer += beloeb;
  };
  const linje = (konto: number, side: Side, oere: number): FacitLinje => ({ konto, side, oere });

  for (let i = 0; i < plan.length; i++) {
    const pl = plan[i];
    const nummer = i + 1;
    const afsender = pl.afsender;
    let likviditet: Likviditet;
    const facit: FacitLinje[] = [];
    let tekst: BilagModel["tekst"];

    switch (pl.type) {
      case "leje": {
        likviditet = lejeOpkraeves ? "opkraevetIkkeIndbetalt" : "indbetaltBank";
        const konto = lejeOpkraeves ? 20002 : 20004;
        facit.push(linje(konto, "debet", kvartalBrutto));
        if (momspligtigKvartal > 0) {
          facit.push(linje(1000, "kredit", momspligtigKvartal), linje(30005, "kredit", momspligtigKvartal / 4));
          salgsmoms += momspligtigKvartal / 4;
        }
        if (momsfriKvartal > 0) facit.push(linje(1001, "kredit", momsfriKvartal));
        if (lejeOpkraeves) lejeUbetalt = kvartalBrutto;
        else bank += kvartalBrutto;
        const antal = (momspligtigKvartal > 0 ? 1 : 0) + (momsfriKvartal > 0 ? 1 : 0);
        const l = likviditet;
        tekst = (dato) => {
          const dele: string[] = [];
          if (momspligtigKvartal > 0) dele.push(`Lejeindtægter (momspligtig) udgør ${kr((momspligtigKvartal * 5) / 4)} inklusive moms`);
          if (momsfriKvartal > 0) dele.push(`${dele.length ? "lejeindtægter" : "Lejeindtægter"} (ikke momspligtig) udgør ${kr(momsfriKvartal)}`);
          const lejesaetning = dele.join(", og ");
          const slut = lejesaetning.endsWith("kr.") ? "" : ".";
          return `${afsender} opkræver den ${dato} husleje for 4. kvartal (oktober–december) hos ejendommens lejere. ${lejesaetning}${slut} ${likviditetsformulering(l, antal)}`;
        };
        break;
      }
      case "forsikring": {
        const f = pl.forsikring!;
        const valgt = vaelgBetaling(pl.beloeb, ["bankkonto", "kassekredit", "skyldig"]);
        if (!valgt) return null;
        likviditet = valgt;
        betal(likviditet, pl.beloeb);
        if (likviditet === "skyldig") ubetalteRegninger.push({ nummer, afsender, beloeb: pl.beloeb });
        const iAar = 13 - f.start; // hele måneder i indeværende år (360-dages-konvention)
        facit.push(linje(2000, "debet", f.maanedspraemie * iAar), linje(20003, "debet", f.maanedspraemie * (f.maaneder - iAar)));
        facit.push(linje(kreditKonto(likviditet), "kredit", pl.beloeb));
        const slutMaaned = MAANEDER[(f.start - 1 + f.maaneder - 1) % 12];
        const l = likviditet;
        tekst = (dato) =>
          `${afsender} fremsender den ${dato} præmie for bygningsforsikring på ${kr(pl.beloeb)} Forsikringen dækker perioden ${MAANEDER[f.start - 1]} indeværende regnskabsår til og med ${slutMaaned} efterfølgende regnskabsår. ${momsformulering("faktureretUdenMoms")} ${likviditetsformulering(l, 1)}`;
        break;
      }
      case "realkredit": {
        const rk = pl.realkredit!;
        const valgt = vaelgBetaling(pl.beloeb, ["bankkonto", "kassekredit"]);
        if (!valgt) return null;
        likviditet = valgt;
        betal(likviditet, pl.beloeb);
        facit.push(linje(7000, "debet", rk.rente), linje(7000, "debet", rk.bidrag), linje(30002, "debet", rk.afdrag));
        facit.push(linje(kreditKonto(likviditet), "kredit", pl.beloeb));
        const l = likviditet;
        tekst = (dato) =>
          `${afsender} opkræver den ${dato} kvartalets ydelse på ejendommens realkreditlån med i alt ${kr(pl.beloeb)} Ydelsen består af renteomkostninger på realkreditlån ${kr(rk.rente)}, bidrag til realkreditinstitut ${kr(rk.bidrag)} og afdrag på realkreditlån ${kr(rk.afdrag)} ${momsformulering("faktureretUdenMoms", { antalBeloeb: 4 })} ${likviditetsformulering(l, 4)}`;
        break;
      }
      case "administrator":
      case "vedligeholdelse":
      case "forbedring":
      case "omkostning":
      case "kassekreditrenter": {
        const muligt: Likviditet[] =
          pl.type === "administrator"
            ? ["bankkonto", "kassekredit"]
            : pl.type === "kassekreditrenter"
              ? ["kassekredit"]
              : pl.konto === 6003
                ? ["bankkonto"]
                : ["bankkonto", "kassekredit", "skyldig"];
        const valgt = vaelgBetaling(pl.beloeb, muligt);
        if (!valgt) return null;
        likviditet = valgt;
        betal(likviditet, pl.beloeb);
        if (likviditet === "skyldig") ubetalteRegninger.push({ nummer, afsender, beloeb: pl.beloeb });
        const momsfradrag = pl.inklMoms ? fradrag(pl.beloeb) : 0;
        if (pl.inklMoms) koebsmoms += momsfradrag;
        facit.push(linje(pl.konto!, "debet", pl.beloeb - momsfradrag));
        if (momsfradrag > 0) facit.push(linje(30006, "debet", momsfradrag));
        facit.push(linje(kreditKonto(likviditet), "kredit", pl.beloeb));
        const momssaetning = pl.inklMoms
          ? status === "momsfri"
            ? momsformulering("momsfri")
            : status === "delvis"
              ? momsformulering("delvis", { momsfradragsprocent: p! })
              : momsformulering("fuld")
          : momsformulering("faktureretUdenMoms");
        const l = likviditet;
        const beloebstekst = `${kr(pl.beloeb)}${pl.inklMoms ? " inklusive moms." : ""}`;
        const verbum = pl.inklMoms || pl.type === "forbedring" ? "fakturerer" : "opkræver";
        const lyderPaa = `${verbum === "fakturerer" ? "Fakturaen" : "Opkrævningen"} lyder på ${beloebstekst}`;
        if (pl.type === "forbedring") {
          tekst = (dato) =>
            `${afsender} fakturerer den ${dato} ${pl.projekt}. ${lyderPaa} Arbejdet er en forbedring af investeringsejendommen. ${momssaetning} ${likviditetsformulering(l, 1)}`;
        } else if (pl.type === "kassekreditrenter") {
          tekst = (dato) =>
            `${afsender} beregner den ${dato} renteomkostninger på kassekredit for 4. kvartal med ${beloebstekst} ${momssaetning} ${likviditetsformulering(l, 1)}`;
        } else if (pl.konto === 6003) {
          tekst = (dato) =>
            `${afsender} trækker den ${dato} gebyrer ${pl.beskrivelse} (overførselsgebyr, hævegebyr, netbankgebyr) med ${beloebstekst} ${momssaetning} ${likviditetsformulering(l, 1)}`;
        } else {
          const indhold = smaaForbogstav(pl.indhold[0].indhold);
          const komma = indhold.includes(",") ? "," : "";
          tekst = (dato) =>
            `${afsender} ${verbum} den ${dato} ${indhold}${komma} ${pl.beskrivelse}. ${lyderPaa} ${momssaetning} ${likviditetsformulering(l, 1)}`;
        }
        break;
      }
      case "renteindtaegter": {
        likviditet = "indbetaltBank";
        bank += pl.beloeb;
        facit.push(linje(20004, "debet", pl.beloeb), linje(7001, "kredit", pl.beloeb));
        tekst = (dato) =>
          `${afsender} tilskriver den ${dato} renteindtægter på bankkonti med ${kr(pl.beloeb)} ${likviditetsformulering("indbetaltBank", 1)}`;
        break;
      }
      case "tidligereSkyldig": {
        likviditet = "tidligereSkyldigBetales";
        const regning = ubetalteRegninger.shift();
        let beloeb: number;
        let henvisning: (aar: number) => string;
        if (regning) {
          beloeb = regning.beloeb;
          henvisning = () => `betales regningen på ${kr(beloeb)} fra ${regning.afsender}, som er bogført som skyldig i bilag ${regning.nummer}.`;
        } else {
          beloeb = medOere(foerStartSkyldig * iv(0.25, 0.7));
          if (beloeb < 2_000 * KR) return null;
          foerStartSkyldig -= beloeb;
          const fra = r.vaelg(Object.values(INDHOLDSTEKSTER).filter((t) => !t.afsendere.includes("Kommunen")));
          const regningsafsender = r.vaelg(fra.afsendere);
          henvisning = (aar) => `betales en regning på ${kr(beloeb)} fra ${regningsafsender}, som var bogført som skyldig før 1. oktober ${aar}.`;
        }
        const betaling = vaelgBetaling(beloeb, ["bankkonto", "kassekredit"]);
        if (!betaling) return null;
        betal(betaling, beloeb);
        kreditorer -= beloeb;
        facit.push(linje(30004, "debet", beloeb), linje(kreditKonto(betaling), "kredit", beloeb));
        tekst = (dato, aar) =>
          `Den ${dato} ${henvisning(aar)} ${likviditetsformulering("tidligereSkyldigBetales", 1)} ${likviditetsformulering(betaling, 1)}`;
        break;
      }
      case "lejerIndbetaler": {
        likviditet = "lejerIndbetalerTidligere";
        let beloeb: number;
        let beskrivelse: (aar: number) => string;
        if (lejeUbetalt > 0) {
          beloeb = lejeUbetalt;
          lejeUbetalt = 0;
          beskrivelse = () => `indbetaler lejerne ${kr(beloeb)} af huslejen, der blev opkrævet i bilag 1.`;
        } else {
          beloeb = medOere(foerStartTilgodehavende * iv(0.5, 1));
          foerStartTilgodehavende -= beloeb;
          beskrivelse = (aar) => `indbetaler en lejer ${kr(beloeb)} i husleje, der blev opkrævet før 1. oktober ${aar}.`;
        }
        if (beloeb <= 0) return null;
        bank += beloeb;
        facit.push(linje(20004, "debet", beloeb), linje(20002, "kredit", beloeb));
        tekst = (dato, aar) => `Den ${dato} ${beskrivelse(aar)} ${likviditetsformulering("lejerIndbetalerTidligere", 1)}`;
        break;
      }
      case "amortisering": {
        likviditet = "ingenLikviditet";
        facit.push(linje(7000, "debet", pl.beloeb), linje(30002, "kredit", pl.beloeb));
        tekst = (dato) =>
          `${afsender} har den ${dato} opgjort årets amortisering af låneomkostninger på realkreditlån til ${kr(pl.beloeb)} ${likviditetsformulering("ingenLikviditet", 1)}`;
        break;
      }
      case "dagsvaerdi": {
        likviditet = "ingenLikviditet";
        tekst = () => ""; // udfyldes nedenfor, når reguleringen er fastlagt
        break;
      }
      case "momsafslutning": {
        likviditet = "ingenLikviditet";
        facit.push(linje(30005, "debet", salgsmoms), linje(30006, "kredit", koebsmoms), linje(30007, "kredit", salgsmoms - koebsmoms));
        tekst = (dato, aar) =>
          `Den ${dato} afsluttes momskontiene for momsperioden juli–december ${aar}. Hele saldoen på salgsmoms og hele saldoen på købsmoms overføres til momsafregning. ${likviditetsformulering("ingenLikviditet", 1)}`;
        break;
      }
      case "momsbetaling": {
        const tilsvar = salgsmoms - koebsmoms;
        const valgt = vaelgBetaling(tilsvar, ["bankkonto", "kassekredit"]);
        if (!valgt) return null;
        likviditet = valgt;
        betal(likviditet, tilsvar);
        facit.push(linje(30007, "debet", tilsvar), linje(kreditKonto(likviditet), "kredit", tilsvar));
        const l = likviditet;
        tekst = (dato, aar) =>
          `Den ${dato} betales momsen for momsperioden juli–december ${aar} til ${afsender} med ${kr(tilsvar)} ${likviditetsformulering(l, 1)}`;
        break;
      }
    }
    modeller.push({ type: pl.type, placering: pl.placering, indhold: pl.indhold, likviditet: likviditet!, facit, tekst: tekst! });
  }

  // Trin 7: dagsværdiregulering, resultat og selskabsskat (8.4, 10.1, 10.2).
  const startNetto = new Map<number, number>();
  for (const [konto, beloeb] of startResultat) startNetto.set(konto, beloeb);
  startNetto.set(7001, -start7001);
  if (momspligtigKvartal > 0) startNetto.set(1000, -3 * momspligtigKvartal);
  if (momsfriKvartal > 0) startNetto.set(1001, -3 * momsfriKvartal);
  const resultatkonti = KONTOPLAN.filter((k) => k.kategori !== "Aktiver" && k.kategori !== "Passiver" && k.nummer !== 9000).map((k) => k.nummer);
  const resultat = (netto: Map<number, number>) => -resultatkonti.reduce((s, k) => s + (netto.get(k) ?? 0), 0);
  const forloeb: number[] = [resultat(startNetto)];
  const netto = new Map(startNetto);
  for (const m of modeller) {
    for (const l of m.facit) netto.set(l.konto, (netto.get(l.konto) ?? 0) + (l.side === "debet" ? l.oere : -l.oere));
    forloeb.push(resultat(netto));
  }
  const dagsvaerdiIndeks = plan.indexOf(dagsvaerdiPlan); // bilag nr. = indeks + 1
  const ejendomFoer = ejendom + plan.slice(0, dagsvaerdiIndeks).reduce((s, pl) => s + (pl.type === "forbedring" ? pl.beloeb - fradrag(pl.beloeb) : 0), 0);
  const minReg = oprund(0.005 * ejendomFoer, 100 * KR);
  const maksReg = nedrund(0.03 * ejendomFoer, 100 * KR);
  const proev = (reg: number) => {
    // reg > 0: opskrivning (indtægt), reg < 0: nedskrivning (omkostning)
    const foerJustering = forloeb[forloeb.length - 1] + reg;
    const justering = ((foerJustering % KR) + KR) % KR; // gør resultatet til hele kroner
    const aarsresultat = foerJustering - justering;
    const skat = (aarsresultat * 22) / 100;
    if (Math.abs(regStart + reg) > 0.2 * ejendomFoer) return null;
    const ok = forloeb.every((x, i) => {
      const r2 = x - justering + (i > dagsvaerdiIndeks ? reg : 0);
      return r2 > 0 && r2 - skat > 0;
    });
    // Plausibilitet: et beskedent overskud (mindst 5 % af lejen), så selskabsskatten ikke bliver forsvindende lille.
    return ok && aarsresultat >= 0.05 * lejeAar ? { justering, skat } : null;
  };
  const retninger = r.chance(0.5) ? [1, -1] : [-1, 1];
  const foersteBud = nedrund(iv(minReg, maksReg), 100 * KR);
  let regulering = 0;
  let udfald: { justering: number; skat: number } | null = null;
  for (const retning of retninger) {
    for (const bud of [foersteBud, nedrund((foersteBud + minReg) / 2, 100 * KR), minReg]) {
      udfald = proev(retning * bud);
      if (udfald) {
        regulering = retning * bud;
        break;
      }
    }
    if (udfald) break;
  }
  if (!udfald) return null;
  const regBeloeb = Math.abs(regulering);
  const dagsvaerdiModel = modeller[dagsvaerdiIndeks];
  dagsvaerdiModel.facit =
    regulering > 0
      ? [linje(20001, "debet", regBeloeb), linje(8000, "kredit", regBeloeb)]
      : [linje(8000, "debet", regBeloeb), linje(20001, "kredit", regBeloeb)];
  const valuar = dagsvaerdiPlan.afsender;
  const ord = regulering > 0 ? "opskrivning" : "nedskrivning";
  dagsvaerdiModel.tekst = (dato) =>
    `${valuar} har den ${dato} opgjort dagsværdien af investeringsejendommen. Dagsværdireguleringen for året er en ${ord} på ${kr(regBeloeb)} ${likviditetsformulering("ingenLikviditet", 1)}`;
  startResultat.set(6005, (startResultat.get(6005) ?? 0) + udfald.justering);

  // Trin 8: saldi ved start; aktiekapital og overført resultat fastlægges til sidst (10.3).
  const saldi: Saldo[] = [];
  const tilfoej = (konto: number, nettoBeloeb: number) => {
    if (nettoBeloeb !== 0) saldi.push({ konto, side: nettoBeloeb > 0 ? "debet" : "kredit", oere: Math.abs(nettoBeloeb) });
  };
  for (const [konto, beloeb] of startResultat) tilfoej(konto, beloeb);
  tilfoej(7001, -start7001);
  tilfoej(9000, udfald.skat);
  if (momspligtigKvartal > 0) tilfoej(1000, -3 * momspligtigKvartal);
  if (momsfriKvartal > 0) tilfoej(1001, -3 * momsfriKvartal);
  tilfoej(20000, ejendom);
  tilfoej(20001, regStart);
  tilfoej(20002, tilgodehavendeStart);
  tilfoej(20003, periodeStart);
  tilfoej(20004, bankStart);
  tilfoej(30002, -laan);
  tilfoej(30003, -kassekreditStart);
  tilfoej(30004, -kreditorStart);
  if (moms) {
    tilfoej(30005, -salgsmomsStart);
    tilfoej(30006, koebsmomsStart);
  }
  const forskel = saldi.reduce((s, x) => s + (x.side === "debet" ? x.oere : -x.oere), 0);
  const maksAktiekapital = Math.min(2_000_000 * KR, nedrund(forskel - 200_000 * KR, 100_000 * KR));
  if (maksAktiekapital < 500_000 * KR) return null;
  const aktiekapital = r.heltal(5, maksAktiekapital / (100_000 * KR)) * 100_000 * KR;
  tilfoej(30000, -aktiekapital);
  tilfoej(30001, -(forskel - aktiekapital));
  saldi.sort((a, b) => a.konto - b.konto);

  return { momsfradragsprocent: p, saldi, bilag: modeller };
}

// ---------------------------------------------------------------------------
// Fra model til opgave
// ---------------------------------------------------------------------------

function tilOpgave(variant: Variant, model: Model, aar: number): Opgave {
  const bilag: Bilag[] = model.bilag.map((m, i) => {
    const dato = datoFor(m.placering, aar);
    return {
      nummer: i + 1,
      dato,
      tekst: m.tekst(formaterDato(dato), aar),
      type: m.type,
      likviditet: m.likviditet,
      indhold: m.indhold,
      facit: m.facit,
    };
  });
  return {
    variant,
    aar,
    generatorversion: GENERATOR_VERSION,
    momsfradragsprocent: model.momsfradragsprocent,
    saldi: model.saldi,
    bilag,
  };
}

/** Ét enkelt forsøg som færdig opgave (til tests og fejlfinding); null, hvis forsøget opgav undervejs. */
export function danForsoeg(variant: Variant, forsoeg: number, aar: number): Opgave | null {
  const model = byg(variant, forsoeg);
  return model ? tilOpgave(variant, model, aar) : null;
}

export interface Dannelse {
  opgave: Opgave;
  /** Hvilket forsøg der blev brugt (0 = første). */
  forsoeg: number;
}

/**
 * Danner opgaven for et variantnummer. Forsøgene prøves i fast rækkefølge, og det første,
 * der består regelkontrollen i referenceåret, bruges. Derfor giver samme variantnummer altid
 * samme opgave; kun årstal og datoer følger det år, opgaven dannes i.
 */
export function danOpgaveMedForsoeg(variant: Variant, aar: number): Dannelse {
  for (let forsoeg = 0; forsoeg < MAKS_FORSOEG; forsoeg++) {
    const model = byg(variant, forsoeg);
    if (!model) continue;
    const reference = tilOpgave(variant, model, REFERENCEAAR);
    if (kontrollerOpgave(reference).length > 0) continue;
    if (aar === REFERENCEAAR) return { opgave: reference, forsoeg };
    const opgave = tilOpgave(variant, model, aar);
    const fejl = kontrollerOpgave(opgave);
    if (fejl.length > 0) throw new Error(`Variant ${variant.nummer} er ugyldig i ${aar}: ${fejl[0]}`);
    return { opgave, forsoeg };
  }
  throw new Error(`Variant ${variant.nummer} kunne ikke dannes.`);
}

export function danOpgave(variant: Variant, aar: number = new Date().getFullYear()): Opgave {
  return danOpgaveMedForsoeg(variant, aar).opgave;
}
