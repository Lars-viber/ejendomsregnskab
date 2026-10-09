/**
 * Uafhængig regelkontrol af en opgave, skrevet direkte ud fra Reference.docx afsnit 8, 9 og 10
 * (version 1.4), den godkendte klassifikationsliste og projektejerens godkendte rettelser. Kontrollen kender intet til, hvordan
 * opgavegeneratoren arbejder; den ser kun på den færdige opgave.
 *
 * Returnerer en liste med brud på reglerne. En tom liste betyder, at opgaven er gyldig.
 */
import { bankdageIMaaned, erBankdag, sidsteBankdagIDecember } from "../domain/bankdage";
import { formaterBeloeb } from "../domain/beloeb";
import { KLASSIFIKATION, TOILET_OG_OMKLAEDNING, type Del } from "../domain/klassifikation";
import { KONTOPLAN } from "../domain/kontoplan";
import {
  ANTAL_BILAG,
  bogfoerFacit,
  formaterDato,
  nettoSaldi,
  skjulteKonti,
  synligeKonti,
  type Bilag,
  type Bilagstype,
  type Opgave,
} from "../domain/opgave";
import { beloebITekst, laesBilag } from "./laesBilag";

const KR = 100; // øre pr. krone

// Formuleringer ordret fra Reference.docx 8.3 (ental) og projektejerens flertalsregel.
const LIKVIDITET: Record<string, { ental: string; flertal?: string }> = {
  kassekredit: { ental: "Bilaget er betalt via kassekredit." },
  bankkonto: { ental: "Bilaget er betalt via bankkonto." },
  indbetaltBank: { ental: "Beløbet er indbetalt på bankkonto.", flertal: "Beløbene er indbetalt på bankkonto." },
  skyldig: { ental: "Beløbet er skyldigt.", flertal: "Beløbene er skyldige." },
  tidligereSkyldigBetales: { ental: "En tidligere skyldig regning betales." },
  opkraevetIkkeIndbetalt: {
    ental: "Beløbet er opkrævet, men endnu ikke indbetalt af lejer.",
    flertal: "Beløbene er opkrævet, men endnu ikke indbetalt af lejer.",
  },
  lejerIndbetalerTidligere: { ental: "Lejer indbetaler tidligere opkrævet leje." },
  ingenLikviditet: { ental: "Bilaget har ingen likviditetseffekt." },
};
const ALLE_LIKVIDITETSTEKSTER = Object.values(LIKVIDITET).flatMap((l) => [l.ental, ...(l.flertal ? [l.flertal] : [])]);

const MOMS_FRI = "Der kan ikke afløftes moms, da ejendommen er momsfri.";
const MOMS_FULD = "Der kan afløftes fuld moms, da ejendommen er fuldt momsregistreret.";
// Delvis moms (8.3): fakturaen vedrører boligdelen, erhvervsdelen eller hele ejendommen.
const MOMS_BOLIG = "Fakturaen vedrører ejendommens boliglejemål, som er momsfritaget. Der kan ikke afløftes moms.";
const MOMS_ERHVERV = "Fakturaen vedrører ejendommens momsregistrerede erhvervslejemål. Der kan afløftes fuld moms.";
const MOMS_HELE = /Fakturaen vedrører hele ejendommen\. Der kan afløftes delvis moms med momsfradragsprocenten \((\d+) %\)\./g;

// Ord, der nævner delen direkte i beskrivelsen af ydelsen (8.3 og 9.2).
const BOLIGORD = /bolig|lejlighed/i;
const ERHVERVSORD = /erhverv|kontor|butik/i;
const HELEORD = /ejendomme|fælles/i;
// Ord, der nævner eller antyder beboelse; må aldrig stå ved momspligtig ejendom (9.1).
const BEBOELSESORD = /bolig|lejlighed|beboe|badeværelse|vaskeri|altan/i;

const DELENS_NAVN: Record<Del, string> = { bolig: "boligdelen", erhverv: "erhvervsdelen", hele: "hele ejendommen" };

/** Hvilken del en faktura ved delvis moms vedrører, læst ud fra formuleringen i teksten. */
function delIFormulering(tekst: string): Del[] {
  const dele: Del[] = [];
  if (tekst.includes(MOMS_BOLIG)) dele.push("bolig");
  if (tekst.includes(MOMS_ERHVERV)) dele.push("erhverv");
  if ([...tekst.matchAll(MOMS_HELE)].length > 0) dele.push("hele");
  return dele;
}

/** Beskrivelsen af ydelsen: teksten mellem datoen og "Fakturaen lyder på". */
function beskrivelseAfYdelse(tekst: string): string {
  return /den \d{1,2}\. \S+ \d{4} (.*?)\. Fakturaen lyder på/.exec(tekst)?.[1] ?? "";
}
const MOMS_UDEN = "Der kan ikke afløftes moms, da beløbet er faktureret uden moms.";
const MOMS_UDEN_FLERTAL = "Der kan ikke afløftes moms, da beløbene er faktureret uden moms.";

/** Bilagstyper, der er omkostningsbilag og derfor skal have en momsformulering (8.3). */
const OMKOSTNINGSBILAG: readonly Bilagstype[] = [
  "forsikring", "realkredit", "administrator", "vedligeholdelse", "forbedring", "omkostning", "kassekreditrenter",
];

/** Tilladte likviditetsforhold pr. bilagstype (8.3 og 8.4). */
const TILLADT_LIKVIDITET: Record<Bilagstype, readonly string[]> = {
  leje: ["indbetaltBank", "opkraevetIkkeIndbetalt"],
  forsikring: ["bankkonto", "kassekredit", "skyldig"],
  realkredit: ["bankkonto", "kassekredit"],
  administrator: ["bankkonto", "kassekredit"],
  vedligeholdelse: ["bankkonto", "kassekredit", "skyldig"],
  forbedring: ["bankkonto", "kassekredit", "skyldig"],
  dagsvaerdi: ["ingenLikviditet"],
  amortisering: ["ingenLikviditet"],
  momsafslutning: ["ingenLikviditet"],
  momsbetaling: ["bankkonto", "kassekredit"],
  omkostning: ["bankkonto", "kassekredit", "skyldig"],
  kassekreditrenter: ["kassekredit"],
  renteindtaegter: ["indbetaltBank"],
  tidligereSkyldig: ["tidligereSkyldigBetales"],
  lejerIndbetaler: ["lejerIndbetalerTidligere"],
};

const FASTE_BILAG: readonly Bilagstype[] = [
  "leje", "forsikring", "realkredit", "administrator", "vedligeholdelse", "forbedring", "dagsvaerdi", "amortisering",
];
const AARSAFSLUTNING: readonly Bilagstype[] = ["dagsvaerdi", "amortisering", "momsafslutning", "momsbetaling"];

const KATEGORI = new Map(KONTOPLAN.map((k) => [k.nummer, k.kategori]));
const OMKOSTNINGSKONTI = KONTOPLAN.filter((k) => k.kategori === "Omkostning").map((k) => k.nummer);
const INDTAEGTSKONTI = KONTOPLAN.filter((k) => k.kategori === "Indtægt").map((k) => k.nummer);
const RESULTATKONTI = KONTOPLAN.filter((k) => k.kategori !== "Aktiver" && k.kategori !== "Passiver").map((k) => k.nummer);

const g = (netto: ReadonlyMap<number, number>, konto: number) => netto.get(konto) ?? 0;

/** Resultat før skat (positivt = overskud). */
function resultatFoerSkat(netto: ReadonlyMap<number, number>): number {
  return -RESULTATKONTI.filter((k) => k !== 9000).reduce((sum, k) => sum + g(netto, k), 0);
}

function antalBeloeb(tekst: string): number {
  return beloebITekst(tekst).length;
}

function facitNetto(bilag: Bilag): Map<number, number> {
  const netto = new Map<number, number>();
  bogfoerFacit(netto, bilag.facit);
  for (const [konto, beloeb] of netto) if (beloeb === 0) netto.delete(konto);
  return netto;
}

function inklMomsBeloeb(bilag: Bilag): number | null {
  if (!bilag.tekst.includes("inklusive moms")) return null;
  if (bilag.type === "leje") {
    const m = /Lejeindtægter \(momspligtig\) udgør (\d{1,3}(?:\.\d{3})*,\d{2}) kr\. inklusive moms/.exec(bilag.tekst);
    return m ? beloebITekst(`${m[1]} kr.`)[0] : null;
  }
  const alle = beloebITekst(bilag.tekst);
  return alle.length === 1 ? alle[0] : null;
}

export function kontrollerOpgave(opgave: Opgave): string[] {
  const fejl: string[] = [];
  const brud = (tekst: string) => fejl.push(tekst);
  const status = opgave.variant.momsstatus;
  const moms = status !== "momsfri";
  const p = opgave.momsfradragsprocent;
  const skjult = new Set(skjulteKonti(status));
  const synlige = synligeKonti(status);
  const synligeNumre = [...synlige.resultat, ...synlige.balance].map((k) => k.nummer);
  const bilagsliste = opgave.bilag;

  // ---------- 8.1 Periode og datoer, 8.2 bilag der altid indgår ----------
  if (bilagsliste.length !== ANTAL_BILAG) brud(`8.2: Opgaven har ${bilagsliste.length} bilag, ikke ${ANTAL_BILAG}.`);
  bilagsliste.forEach((b, i) => {
    if (b.nummer !== i + 1) brud(`Bilag nr. ${b.nummer} står på plads ${i + 1}.`);
    const [aar, maaned] = b.dato.split("-").map(Number);
    if (aar !== opgave.aar || maaned < 10 || maaned > 12) brud(`8.1: Bilag ${b.nummer} er ikke dateret i 4. kvartal ${opgave.aar}.`);
    if (!erBankdag(b.dato)) brud(`8.1: Bilag ${b.nummer} er dateret ${b.dato}, som ikke er en bankdag.`);
    if (i > 0 && b.dato < bilagsliste[i - 1].dato) brud(`8.1: Bilag ${b.nummer} står ikke i kronologisk rækkefølge.`);
    if (AARSAFSLUTNING.includes(b.type) && b.dato !== sidsteBankdagIDecember(opgave.aar)) {
      brud(`8.1: Årsafslutningsbilag ${b.nummer} er ikke dateret sidste bankdag i december.`);
    }
  });
  const antal = (type: Bilagstype) => bilagsliste.filter((b) => b.type === type).length;
  for (const type of FASTE_BILAG) if (antal(type) !== 1) brud(`8.2: Bilagstypen ${type} forekommer ${antal(type)} gange, ikke 1.`);
  if (moms) {
    if (bilagsliste[18]?.type !== "momsafslutning") brud("8.2: Bilag 19 er ikke afslutning af momskonti.");
    if (bilagsliste[19]?.type !== "momsbetaling") brud("8.2: Bilag 20 er ikke betaling af moms.");
    if (antal("momsafslutning") !== 1 || antal("momsbetaling") !== 1) brud("8.2: Momsbilagene forekommer ikke præcis én gang.");
  } else if (antal("momsafslutning") + antal("momsbetaling") > 0) {
    brud("8.2: Momsfri ejendom må ikke have momsafslutning eller momsbetaling.");
  }
  const leje = bilagsliste.find((b) => b.type === "leje");
  if (leje && !bankdageIMaaned(opgave.aar, 10).slice(0, 3).includes(leje.dato)) {
    brud("8.2: Huslejen er ikke opkrævet i starten af oktober.");
  }
  const vedligehold = bilagsliste.find((b) => b.type === "vedligeholdelse");
  if (vedligehold && !vedligehold.indhold.every((i) => i.konto === 4001)) brud("8.2: Det faste vedligeholdelsesbilag er ikke fra 4001.");
  if (status === "momsfri" && bilagsliste.some((b) => b.indhold.some((i) => i.indhold === "Dækningsafgift"))) {
    brud("8.2: Dækningsafgift må ikke bruges ved momsfri ejendom.");
  }

  // ---------- 3.1 Kontoplanen ----------
  for (const b of bilagsliste) {
    for (const ref of b.indhold) {
      const konto = KONTOPLAN.find((k) => k.nummer === ref.konto);
      const linje = konto?.indhold.find((l) => l.tekst === ref.indhold);
      if (!linje) {
        brud(`3.1: Bilag ${b.nummer} henviser til indhold, der ikke findes på konto ${ref.konto}: "${ref.indhold}".`);
        continue;
      }
      const ordret = b.tekst.toLowerCase().includes(ref.indhold.toLowerCase());
      // 8.2: "Reparation af badeværelser" beskrives uden for boliger som toilet- og omklædningsfaciliteter.
      const alias = ref.indhold === "Reparation af badeværelser" && b.tekst.includes(TOILET_OG_OMKLAEDNING);
      if (["omkostning", "administrator", "vedligeholdelse"].includes(b.type) && !ordret && !alias) {
        brud(`8.3: Indholdsteksten "${ref.indhold}" står ikke i bilag ${b.nummer}.`);
      }
      if (OMKOSTNINGSBILAG.includes(b.type) && konto?.kategori === "Omkostning") {
        if (linje.inklusiveMoms === true && !b.tekst.includes("inklusive moms")) {
          brud(`8.3: Bilag ${b.nummer} angiver ikke, at beløbet er inklusive moms.`);
        }
        if (linje.inklusiveMoms === false && b.tekst.includes("inklusive moms")) {
          brud(`8.3: Bilag ${b.nummer} er inklusive moms, men indholdslinjen er uden moms.`);
        }
      }
    }
    if (b.type === "omkostning" && b.indhold.length !== 1) brud(`Bilag ${b.nummer} skal bygge på én indholdslinje.`);
    for (const linje of b.facit) {
      if (!KATEGORI.has(linje.konto)) brud(`3.1: Bilag ${b.nummer} bogfører på konto ${linje.konto}, som ikke findes.`);
      if (skjult.has(linje.konto)) brud(`9.1: Bilag ${b.nummer} bogfører på konto ${linje.konto}, som ikke bruges ved ${status}.`);
      if (!Number.isInteger(linje.oere) || linje.oere <= 0) brud(`Bilag ${b.nummer} har et ugyldigt beløb i facit.`);
      if (linje.konto === 9000) brud(`10.1: Bilag ${b.nummer} bogfører på selskabsskat (9000).`);
      if (linje.konto === 20003 && linje.side === "kredit") brud(`10.1: Bilag ${b.nummer} udgiftsfører periodeafgrænsningsposter.`);
    }
    const debet = b.facit.filter((l) => l.side === "debet").reduce((s, l) => s + l.oere, 0);
    const kredit = b.facit.filter((l) => l.side === "kredit").reduce((s, l) => s + l.oere, 0);
    if (debet !== kredit) brud(`Bilag ${b.nummer}: debet og kredit i facit stemmer ikke.`);
  }

  // ---------- 8.3 Bilagstekster ----------
  for (const b of bilagsliste) {
    const t = b.tekst;
    if (/\n/.test(t)) brud(`6.2: Bilag ${b.nummer} er ikke én sammenhængende tekst.`);
    if (!t.includes(formaterDato(b.dato))) brud(`8.3: Bilag ${b.nummer} indeholder ikke datoen.`);
    if (antalBeloeb(t) === 0 && b.type !== "momsafslutning") brud(`8.3: Bilag ${b.nummer} indeholder intet beløb.`);
    const flere = antalBeloeb(t) > 1;
    const forventet = LIKVIDITET[b.likviditet];
    if (!forventet) {
      brud(`8.3: Bilag ${b.nummer} har et ukendt likviditetsforhold.`);
      continue;
    }
    if (!TILLADT_LIKVIDITET[b.type].includes(b.likviditet)) {
      brud(`8.3: Bilag ${b.nummer} (${b.type}) må ikke have likviditetsforholdet ${b.likviditet}.`);
    }
    const formulering = flere && forventet.flertal ? forventet.flertal : forventet.ental;
    if (!t.includes(formulering)) brud(`8.3: Bilag ${b.nummer} mangler formuleringen "${formulering}".`);
    const fundne = ALLE_LIKVIDITETSTEKSTER.filter((f) => t.includes(f));
    if (b.type === "tidligereSkyldig") {
      // Den betalende konto skal fremgå, så bilaget kan bogføres (bank eller kassekredit).
      const betaling = fundne.filter((f) => f !== LIKVIDITET.tidligereSkyldigBetales.ental);
      if (fundne.length !== 2 || !betaling.every((f) => f === LIKVIDITET.bankkonto.ental || f === LIKVIDITET.kassekredit.ental)) {
        brud(`8.3: Bilag ${b.nummer} angiver ikke, hvordan den tidligere skyldige regning betales.`);
      }
    } else if (b.type === "lejerIndbetaler") {
      // Kontoen, der indbetales på, skal fremgå (8.3).
      if (fundne.length !== 2 || !t.includes(LIKVIDITET.indbetaltBank.ental)) {
        brud(`8.3: Bilag ${b.nummer} oplyser ikke, hvilken konto lejen indbetales på.`);
      }
    } else if (fundne.length !== 1) {
      brud(`8.3: Bilag ${b.nummer} har ${fundne.length} likviditetsformuleringer, ikke én.`);
    }

    // Momsformulering for omkostningsbilag.
    const heleProcent = [...t.matchAll(MOMS_HELE)].map((m) => Number(m[1]));
    const dele = delIFormulering(t);
    const momsTekster =
      [t.includes(MOMS_FRI), t.includes(MOMS_FULD), t.includes(MOMS_UDEN) || t.includes(MOMS_UDEN_FLERTAL)].filter(Boolean).length + dele.length;
    if (OMKOSTNINGSBILAG.includes(b.type)) {
      if (momsTekster !== 1) brud(`8.3: Bilag ${b.nummer} har ${momsTekster} momsformuleringer, ikke én.`);
      const inkl = t.includes("inklusive moms");
      if (inkl) {
        if (status === "momsfri" && !t.includes(MOMS_FRI)) brud(`8.3: Bilag ${b.nummer} har forkert momsformulering for momsfri ejendom.`);
        if (status === "momspligtig" && !t.includes(MOMS_FULD)) brud(`8.3: Bilag ${b.nummer} har forkert momsformulering for momspligtig ejendom.`);
        if (status === "delvis") {
          // (b) Præcis én af de tre formuleringer, og beskrivelsen nævner delen direkte.
          if (dele.length !== 1) brud(`8.3: Bilag ${b.nummer} har ikke præcis én af de tre formuleringer for delvis moms.`);
          else {
            const del = dele[0];
            if (del === "hele" && heleProcent[0] !== p) brud(`8.3: Bilag ${b.nummer} har forkert momsfradragsprocent.`);
            const ydelse = beskrivelseAfYdelse(t);
            const nævnt =
              del === "bolig"
                ? BOLIGORD.test(ydelse) && !ERHVERVSORD.test(ydelse)
                : del === "erhverv"
                  ? ERHVERVSORD.test(ydelse) && !BOLIGORD.test(ydelse) && !/badeværelse/i.test(ydelse)
                  : HELEORD.test(ydelse) && !BOLIGORD.test(ydelse) && !ERHVERVSORD.test(ydelse);
            if (!nævnt) brud(`8.3: Beskrivelsen i bilag ${b.nummer} nævner ikke direkte, at fakturaen vedrører ${DELENS_NAVN[del]}.`);
            // 9.2: delen skal være tilladt for indholdslinjen i den godkendte klassifikationsliste.
            const ref = b.indhold[0];
            const k = KLASSIFIKATION.find((x) => x.konto === ref?.konto && x.indhold === ref?.indhold);
            if (b.type !== "forbedring" && (!k || k[del] === null || !t.includes(k[del]!))) {
              brud(`9.2: Bilag ${b.nummer} følger ikke klassifikationslisten for "${ref?.indhold}" (${del}).`);
            }
          }
        } else if (b.type !== "forbedring") {
          const ref = b.indhold[0];
          const k = KLASSIFIKATION.find((x) => x.konto === ref?.konto && x.indhold === ref?.indhold);
          if (!k || k[status] === null || !t.includes(k[status]!)) {
            brud(`9.1: Bilag ${b.nummer} følger ikke klassifikationslisten for "${ref?.indhold}" (${status}).`);
          }
        }
      } else {
        const uden = flere ? MOMS_UDEN_FLERTAL : MOMS_UDEN;
        if (!t.includes(uden)) brud(`8.3: Bilag ${b.nummer} mangler "${uden}".`);
      }
    } else if (momsTekster > 0) {
      brud(`8.3: Bilag ${b.nummer} er ikke et omkostningsbilag, men har en momsformulering.`);
    }

    // (a) 9.1: ren erhvervsejendom – ingen beboelse; ren boligejendom – intet erhverv.
    if (status === "momspligtig" && BEBOELSESORD.test(t)) brud(`9.1: Bilag ${b.nummer} nævner eller antyder beboelse ved momspligtig ejendom.`);
    if (status === "momsfri" && /erhverv/i.test(t)) brud(`9.1: Bilag ${b.nummer} nævner erhverv ved momsfri ejendom (ren boligejendom).`);
    // (c) 8.4: periodiseringsbilag oplyser 30 dage pr. måned og 360 dage pr. år.
    if (b.type === "forsikring" && !t.includes("Der regnes med 30 dage pr. måned og 360 dage pr. år.")) {
      brud(`8.4: Periodiseringsbilag ${b.nummer} oplyser ikke 30 dage pr. måned og 360 dage pr. år.`);
    }
    // (d) 8.4: betegnelserne positiv/negativ dagsværdiregulering – aldrig opskrivning/nedskrivning.
    if (/opskrivning|nedskrivning/i.test(t)) brud(`8.4: Bilag ${b.nummer} bruger "opskrivning" eller "nedskrivning".`);
    if (b.type === "dagsvaerdi" && !/(positiv|negativ) dagsværdiregulering/.test(t)) {
      brud(`8.4: Bilag ${b.nummer} bruger ikke betegnelsen positiv eller negativ dagsværdiregulering.`);
    }

    // Momsbeløbet må aldrig stå i teksten.
    const momsbeloeb = b.facit.filter((l) => l.konto === 30005 || l.konto === 30006).map((l) => l.oere);
    if (b.type !== "momsafslutning" && beloebITekst(t).some((x) => momsbeloeb.includes(x))) {
      brud(`8.3: Bilag ${b.nummer} oplyser momsbeløbet.`);
    }

    // Facit skal passe med likviditetsforholdet.
    const fn = facitNetto(b);
    const lk: Record<string, [number, number]> = {
      bankkonto: [20004, -1], kassekredit: [30003, -1], skyldig: [30004, -1], indbetaltBank: [20004, 1], opkraevetIkkeIndbetalt: [20002, 1],
    };
    const krav = lk[b.likviditet];
    if (krav && !(Math.sign(g(fn, krav[0])) === krav[1])) {
      brud(`8.3: Facit for bilag ${b.nummer} passer ikke med likviditetsforholdet.`);
    }
    if (b.likviditet === "ingenLikviditet" && [20004, 30003, 30004, 20002].some((k) => fn.has(k))) {
      brud(`8.3: Bilag ${b.nummer} har ingen likviditetseffekt, men facit rører likvide konti.`);
    }
    const henvisning = /bilag (\d+)/.exec(t);
    if (henvisning && Number(henvisning[1]) >= b.nummer) brud(`8.3: Bilag ${b.nummer} henviser til et senere bilag.`);
  }

  // ---------- Saldi efter hvert bilag ----------
  const tilstande: Map<number, number>[] = [nettoSaldi(opgave.saldi)];
  for (const b of bilagsliste) {
    const foer = tilstande[tilstande.length - 1];
    // 8.3/8.4/9: facit skal kunne udledes af bilagsteksten alene (plus T-kontienes saldi).
    try {
      const laest = laesBilag(b.tekst, foer);
      for (const [k, v] of laest) if (v === 0) laest.delete(k);
      const facit = facitNetto(b);
      const ens = laest.size === facit.size && [...facit].every(([k, v]) => laest.get(k) === v);
      if (!ens) brud(`8.3: Facit for bilag ${b.nummer} kan ikke udledes af bilagsteksten.`);
    } catch (e) {
      brud(`8.3: Bilag ${b.nummer} kan ikke læses: ${(e as Error).message}`);
    }
    const efter = new Map(foer);
    bogfoerFacit(efter, b.facit);
    tilstande.push(efter);
  }
  const start = tilstande[0];
  const slut = tilstande[tilstande.length - 1];

  // ---------- 10.1 Saldi ved opgavens start ----------
  const startDebet = opgave.saldi.filter((s) => s.side === "debet").reduce((s, x) => s + x.oere, 0);
  const startKredit = opgave.saldi.filter((s) => s.side === "kredit").reduce((s, x) => s + x.oere, 0);
  if (startDebet !== startKredit) brud("Saldiene ved opgavens start: debet og kredit stemmer ikke.");
  if (new Set(opgave.saldi.map((s) => s.konto)).size !== opgave.saldi.length) brud("En konto har flere saldi ved start.");
  for (const s of opgave.saldi) {
    if (!Number.isInteger(s.oere) || s.oere <= 0) brud(`10.1: Ugyldig saldo på konto ${s.konto}.`);
    if (skjult.has(s.konto)) brud(`10.1: Konto ${s.konto} bruges ikke ved ${status}, men har en saldo.`);
  }
  for (const nummer of synligeNumre) {
    const harSaldo = g(start, nummer) !== 0;
    if (nummer === 8000 || nummer === 30007) {
      if (harSaldo) brud(`10.1: Konto ${nummer} skal starte uden saldo.`);
    } else if (!harSaldo) {
      brud(`10.1: Konto ${nummer} har ingen saldo ved opgavens start.`);
    }
  }
  const resultat = resultatFoerSkat(slut);
  if (g(slut, 9000) * 100 !== 22 * resultat) brud("10.1: Selskabsskat (9000) er ikke 22 % af årets resultat før skat.");

  // ---------- 9 Moms ----------
  for (const b of bilagsliste) {
    const brutto = inklMomsBeloeb(b);
    if (brutto !== null) {
      if (brutto % (5 * KR) !== 0) brud(`9.3: Momsen i bilag ${b.nummer} giver ikke hele kroner.`);
      // Den fradragsberettigede del gælder købsmoms på omkostninger, ikke salgsmoms på husleje.
      else if (b.type !== "leje" && status === "delvis" && delIFormulering(b.tekst)[0] === "hele" && p !== null && ((brutto / 5) * p) % (100 * KR) !== 0) {
        brud(`9.3: Den fradragsberettigede moms i bilag ${b.nummer} giver ikke hele kroner.`);
      }
    }
    for (const l of b.facit) {
      if ((l.konto === 30005 || l.konto === 30006 || l.konto === 30007) && l.oere % KR !== 0) {
        brud(`9.3: Bilag ${b.nummer} bogfører moms, der ikke er hele kroner.`);
      }
    }
  }
  if (status === "delvis") {
    if (p === null || !Number.isInteger(p) || p < 40 || p > 65) brud("9.2: Momsfradragsprocenten er ikke et helt tal mellem 40 og 65.");
    if (!leje?.facit.some((l) => l.konto === 1000) || !leje?.facit.some((l) => l.konto === 1001)) {
      brud("8.2: Huslejeopkrævningen ved delvis moms skal indeholde både momspligtig og momsfri leje.");
    }
    const momspligtig = -g(slut, 1000);
    const samlet = momspligtig - g(slut, 1001);
    const procent = samlet > 0 ? Math.floor((100 * momspligtig + samlet - 1) / samlet) : NaN; // rundet op
    if (procent !== p) brud(`9.2: Momsfradragsprocenten (${p} %) kan ikke beregnes i retrospekt (giver ${procent} %).`);
  } else if (p !== null) {
    brud("9.2: Momsfradragsprocent må kun angives ved delvis moms.");
  }
  if (moms) {
    tilstande.forEach((t, i) => {
      if (g(t, 30007) > 0) brud(`9.4: Momsafregning har en debetsaldo efter bilag ${i}.`);
      if (i < 19) {
        const salgsmoms = -g(t, 30005);
        const koebsmoms = g(t, 30006);
        if (!(salgsmoms > koebsmoms)) brud(`9.4: Salgsmoms er ikke højere end købsmoms efter bilag ${i}.`);
        if (koebsmoms < 0) brud(`9.4: Købsmoms har en kreditsaldo efter bilag ${i}.`);
      }
    });
    const efter19 = tilstande[19];
    if (efter19 && (g(efter19, 30005) !== 0 || g(efter19, 30006) !== 0)) brud("9.4: Momskontiene er ikke afsluttet fuldt ud i bilag 19.");
    if (g(slut, 30007) !== 0) brud("9.4: Momsafregningen er ikke betalt fuldt ud i bilag 20.");
    const bilag20 = bilagsliste[19];
    if (bilag20 && !bilag20.facit.some((l) => l.konto === 30007 && l.side === "debet")) brud("8.2: Bilag 20 er ikke en betaling af moms.");
  }

  // ---------- 8.4 Særlige regler ----------
  bilagsliste.forEach((b, i) => {
    const foer = tilstande[i];
    if (b.type === "forsikring") {
      const m = /dækker perioden (\w+) indeværende regnskabsår til og med (\w+) efterfølgende regnskabsår/.exec(b.tekst);
      const startmaaned = m ? ["oktober", "november", "december"].indexOf(m[1]) : -1;
      const slutMaaned = m ? ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november"].indexOf(m[2]) + 1 : 0;
      const maaneder = startmaaned >= 0 ? 3 - startmaaned + slutMaaned : 0;
      if (startmaaned < 0 || slutMaaned < 1 || ![6, 12].includes(maaneder)) brud("8.4: Bygningsforsikringens dækningsperiode er ikke 6 eller 12 måneder fra oktober–december.");
      const praemie = b.facit.find((l) => l.side === "kredit")?.oere ?? 0;
      const aarligPraemie = maaneder > 0 ? (praemie * 12) / maaneder : 0;
      const ejendom = g(foer, 20000);
      if (aarligPraemie < 0.0005 * ejendom || aarligPraemie > 0.005 * ejendom) brud("10.3: Forsikringens niveau passer ikke til ejendommens størrelse.");
    }
    if (b.type === "realkredit") {
      const afdrag = b.facit.find((l) => l.konto === 30002 && l.side === "debet")?.oere ?? 0;
      const laan = -g(foer, 30002);
      if (afdrag < 0.005 * laan || afdrag > 0.01 * laan) brud("10.3: Afdraget er ikke 0,5–1,0 % af lånet.");
      if (!b.facit.some((l) => l.konto === 7000 && l.side === "debet")) brud("8.4: Rente og bidrag er ikke bogført på 7000.");
    }
    if (b.type === "amortisering") {
      const x = b.facit.find((l) => l.konto === 7000)?.oere ?? 0;
      if (x < 1_000 * KR || x > 20_000 * KR) brud("10.3: Amortiseringen er ikke 1.000–20.000 kr.");
      if (!b.facit.some((l) => l.konto === 30002 && l.side === "kredit")) brud("8.4: Amortiseringen er ikke bogført mod 30002.");
    }
    if (b.type === "renteindtaegter") {
      const x = b.facit.find((l) => l.konto === 7001)?.oere ?? 0;
      if (x < 100 * KR || x > 5_000 * KR) brud("10.3: Renteindtægterne er ikke 100–5.000 kr.");
    }
    if (b.type === "forbedring" && !b.facit.some((l) => l.konto === 20000 && l.side === "debet")) brud("8.4: Forbedringen er ikke bogført på 20000.");
    if (b.type === "dagsvaerdi") {
      const linje = b.facit.find((l) => l.konto === 8000);
      const andel = (linje?.oere ?? 0) / g(foer, 20000);
      if (!linje || !b.facit.some((l) => l.konto === 20001) || andel < 0.005 || andel > 0.03) {
        brud("8.4: Dagsværdireguleringen er ikke 0,5–3 % af 20000 bogført på 8000 mod 20001.");
      }
    }
    // 10.3: momsbelagte enkeltbilag og forbedringer.
    const brutto = inklMomsBeloeb(b);
    if (brutto !== null && b.type !== "leje" && b.type !== "forbedring" && (brutto < 2_000 * KR || brutto > 150_000 * KR)) {
      brud(`10.3: Det momsbelagte bilag ${b.nummer} er ikke 2.000–150.000 kr. inklusive moms.`);
    }
    if (b.type === "forbedring" && brutto !== null) {
      if (brutto > 750_000 * KR) brud("10.3: Forbedringen er over 750.000 kr.");
      if (brutto < 100_000 * KR) {
        if (!moms) brud("10.3: Forbedringen er under 100.000 kr. ved momsfri ejendom.");
        else {
          // 9.4 har forrang: en forbedring på 100.000 kr. må ikke have kunnet overholde reglen.
          const del = delIFormulering(b.tekst)[0];
          const andel = status === "momspligtig" || del === "erhverv" ? 1 : del === "hele" ? (p ?? 0) / 100 : 0;
          const fradrag = (x: number) => (x / 5) * andel;
          const plads = Math.min(...tilstande.slice(i + 1, 19).map((t) => -g(t, 30005) - g(t, 30006)));
          if (plads + fradrag(brutto) - fradrag(100_000 * KR) > 0) brud("9.4/10.3: Forbedringen er gjort mindre end 100.000 kr. uden grund.");
        }
      }
    }
  });

  // ---------- 10.2 Begrænsninger (efter hvert bilag) ----------
  tilstande.forEach((t, i) => {
    const efter = i === 0 ? "ved opgavens start" : `efter bilag ${i}`;
    const aktiekapital = -g(t, 30000);
    if (aktiekapital < 500_000 * KR || aktiekapital > 2_000_000 * KR) brud(`10.2: Aktiekapital er ikke 500.000–2.000.000 kr. ${efter}.`);
    if (g(t, 30000) + g(t, 30001) > 0) brud(`10.2: Egenkapitalen er negativ ${efter}.`);
    if (!(g(t, 20004) > 0)) brud(`10.2: Bankkontoen er ikke positiv ${efter}.`);
    if (!(g(t, 30003) < 0)) brud(`10.2: Kassekreditten har ikke et træk ${efter}.`);
    const ejendom = g(t, 20000);
    if (Math.abs(g(t, 20001)) > 0.2 * ejendom) brud(`10.2: 20001 ligger uden for ±20 % af 20000 ${efter}.`);
    if (!(ejendom + g(t, 20001) > 0)) brud(`10.2: 20000 og 20001 har tilsammen en kreditsaldo ${efter}.`);
    if (g(t, 30002) > 0) brud(`10.2: Realkreditlånet har en debetsaldo ${efter}.`);
    if (g(t, 20002) < 0) brud(`10.2: Tilgodehavende leje har en kreditsaldo ${efter}.`);
    if (g(t, 20003) < 0 || g(t, 20003) > 400_000 * KR) brud(`10.2: Periodeafgrænsningsposter er uden for 0–400.000 kr. ${efter}.`);
    if (g(t, 30004) > 0 || -g(t, 30004) > 500_000 * KR) brud(`10.2: Andre kreditorer er uden for 0–500.000 kr. ${efter}.`);
    for (const k of OMKOSTNINGSKONTI) if (g(t, k) < 0) brud(`10.2: Omkostningskonto ${k} har en kreditsaldo ${efter}.`);
    for (const k of INDTAEGTSKONTI) if (g(t, k) > 0) brud(`10.2: Indtægtskonto ${k} har en debetsaldo ${efter}.`);
    const foerSkat = resultatFoerSkat(t);
    if (!(foerSkat > 0)) brud(`10.2: Underskud før skat ${efter}.`);
    if (!(foerSkat - g(t, 9000) > 0)) brud(`10.2: Underskud efter skat ${efter}.`);
  });
  const ejendomStart = g(start, 20000);
  if (ejendomStart < 8_000_000 * KR || ejendomStart > 15_000_000 * KR) brud("10.2: Investeringsejendomme er ikke 8–15 mio. kr. ved start.");
  const laanAndel = -g(start, 30002) / (ejendomStart + g(start, 20001));
  if (laanAndel < 0.5 || laanAndel > 0.6) brud("10.2: Realkreditlånet er ikke 50–60 % af 20000 + 20001 ved start.");
  const lejeIalt = -(g(slut, 1000) + g(slut, 1001));
  const vedligeholdIalt = g(slut, 4000) + g(slut, 4001) + g(slut, 5000);
  if (vedligeholdIalt < 0.1 * lejeIalt || vedligeholdIalt > 0.12 * lejeIalt) brud("10.2: 4000 + 4001 + 5000 er ikke 10–12 % af lejeindtægterne.");
  if (g(slut, 7000) < 0.3 * lejeIalt || g(slut, 7000) > 0.4 * lejeIalt) brud("10.2: 7000 er ikke 30–40 % af lejeindtægterne.");
  // (g) 10.2: årets resultat før skat udgør mindst 5 % af lejeindtægterne ekskl. moms.
  if (resultat < 0.05 * lejeIalt) brud("10.2: Årets resultat før skat er under 5 % af lejeindtægterne.");
  // (b) 9.2: ved delvis moms mindst ét momsbelagt bilag af hver af de tre typer.
  if (status === "delvis") {
    const fundneDele = new Set(bilagsliste.flatMap((b) => (b.tekst.includes("inklusive moms") && b.type !== "leje" ? delIFormulering(b.tekst) : [])));
    for (const del of ["bolig", "erhverv", "hele"] as const) {
      if (!fundneDele.has(del)) brud(`9.2: Opgaven har intet bilag, der vedrører ${DELENS_NAVN[del]}.`);
    }
  }

  // ---------- 10.3 Beløbsrammer ----------
  if (lejeIalt < 0.05 * g(slut, 20000) || lejeIalt > 0.08 * g(slut, 20000)) brud("10.3: Lejeindtægterne er ikke 5–8 % af 20000.");
  if (leje) {
    for (const konto of [1000, 1001]) {
      const kvartal = -g(facitNetto(leje), konto);
      if (-g(start, konto) !== 3 * kvartal) brud(`10.3: Lejen på ${konto} er ikke den samme i alle fire kvartaler.`);
    }
    const kvartalsopkraevning = leje.facit.filter((l) => l.side === "debet").reduce((s, l) => s + l.oere, 0);
    if (!(g(start, 20002) > 0) || g(start, 20002) > kvartalsopkraevning / 3) brud("10.3: Tilgodehavende leje er ikke over 0 og højst 1 måneds leje.");
    if (moms) {
      const momspligtigKvartal = -g(facitNetto(leje), 1000);
      if (-g(start, 30005) !== momspligtigKvartal / 4) brud("10.3: Salgsmoms ved start er ikke momsen af 3. kvartals leje.");
    }
  }
  const mellem = (konto: number, min: number, max: number, navn: string, fortegn = 1) => {
    const x = fortegn * g(start, konto);
    if (x < min * KR || x > max * KR) brud(`10.3: ${navn} er ikke ${formaterBeloeb(min * KR)}–${formaterBeloeb(max * KR)} kr. ved start.`);
  };
  mellem(20004, 150_000, 750_000, "Bankkonto");
  mellem(30003, 50_000, 500_000, "Kassekredit", -1);
  mellem(30004, 20_000, 250_000, "Andre kreditorer", -1);
  mellem(20003, 10_000, 150_000, "Periodeafgrænsningsposter");
  if (Math.abs(g(start, 20001)) > 0.15 * ejendomStart) brud("10.3: 20001 er ikke mellem −15 % og +15 % af 20000 ved start.");
  if (!(g(start, 30001) < 0)) brud("10.3: Overført resultat har ikke en kreditsaldo.");
  if (moms) {
    // Købsmoms ved start ≈ momsen af ca. 3 måneders momsbelagte omkostninger (saldiene dækker 9 måneder).
    const fradragsandel = status === "momspligtig" ? 1 : (p ?? 0) / 100;
    const momsbelagte = KONTOPLAN.filter((k) => k.kategori === "Omkostning" && k.indhold.every((l) => l.inklusiveMoms === true));
    const fradrag9 = momsbelagte.reduce((sum, k) => {
      const saldo = g(start, k.nummer); // ekskl. moms + ikke-fradragsberettiget moms
      const eksklMoms = saldo / (1 + 0.25 * (1 - fradragsandel));
      return sum + eksklMoms * 0.25 * fradragsandel;
    }, 0);
    const koebsmoms = g(start, 30006);
    if (koebsmoms < (fradrag9 / 3) * 0.75 || koebsmoms > (fradrag9 / 3) * 1.25) brud("10.3: Købsmoms ved start svarer ikke til ca. 3 måneders momsbelagte omkostninger.");
  }

  return fejl;
}
