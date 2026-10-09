/**
 * Læser en bilagstekst, som en studerende ville gøre, og udregner, hvordan bilaget skal bogføres.
 *
 * Bruger kun: bilagsteksten, kontoplanen og – for afslutningen af momskontiene – saldiene i
 * T-kontiene lige før bilaget (dem kan den studerende se). Den kender intet til opgavegeneratoren.
 * Reglerne er skrevet ud fra Reference.docx afsnit 8.2, 8.3, 8.4 og 9 (version 1.4).
 */
import { KONTOPLAN } from "../domain/kontoplan";

export type Bogfoering = Map<number, number>; // konto → debet minus kredit (øre)

const BELOEB = /(\d{1,3}(?:\.\d{3})*,\d{2}) kr\./g;
const MAANEDER = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

function tilOere(tekst: string): number {
  const [kroner, oere] = tekst.split(",");
  return Number(kroner.replace(/\./g, "")) * 100 + Number(oere);
}

/** Alle beløb i teksten i den rækkefølge, de står. */
export function beloebITekst(tekst: string): number[] {
  return [...tekst.matchAll(BELOEB)].map((m) => tilOere(m[1]));
}

function beloebEfter(tekst: string, foran: RegExp): number {
  const m = new RegExp(`${foran.source} (\\d{1,3}(?:\\.\\d{3})*,\\d{2}) kr\\.`, "i").exec(tekst);
  if (!m) throw new Error(`Beløbet efter "${foran.source}" findes ikke i teksten.`);
  return tilOere(m[1]);
}

function eneste(tekst: string): number {
  const alle = beloebITekst(tekst);
  if (alle.length !== 1) throw new Error(`Forventede ét beløb i teksten, fandt ${alle.length}.`);
  return alle[0];
}

function post(b: Bogfoering, konto: number, debetMinusKredit: number): void {
  if (debetMinusKredit === 0) return;
  b.set(konto, (b.get(konto) ?? 0) + debetMinusKredit);
}

/** Kontoen for likviditetsformuleringen (8.3). Positivt fortegn = pengene kommer ind. */
function likviditetskonto(tekst: string): { konto: number; ind: boolean } | null {
  if (tekst.includes("Bilaget er betalt via kassekredit.")) return { konto: 30003, ind: false };
  if (tekst.includes("Bilaget er betalt via bankkonto.")) return { konto: 20004, ind: false };
  if (/Beløbe(t|ne) er skyldig(t|e)\./.test(tekst)) return { konto: 30004, ind: false };
  if (/Beløbe(t|ne) er indbetalt på bankkonto\./.test(tekst)) return { konto: 20004, ind: true };
  if (/Beløbe(t|ne) er opkrævet, men endnu ikke indbetalt af lejer\./.test(tekst)) return { konto: 20002, ind: true };
  return null;
}

function kraevLikviditet(tekst: string): { konto: number; ind: boolean } {
  const l = likviditetskonto(tekst);
  if (!l) throw new Error("Bilagsteksten mangler en likviditetsformulering.");
  return l;
}

/** Den fradragsberettigede købsmoms af et beløb inkl. moms (9.1–9.3). */
function fradragsberettigetMoms(tekst: string, inklMoms: number): number {
  if (!tekst.includes("inklusive moms")) return 0;
  const moms = inklMoms / 5; // 25 % moms af beløbet ekskl. moms = 1/5 af beløbet inkl. moms
  if (tekst.includes("Der kan afløftes fuld moms, da ejendommen er fuldt momsregistreret.")) return moms;
  if (tekst.includes("Der kan ikke afløftes moms, da ejendommen er momsfri.")) return 0;
  // Delvis moms: fradraget afgøres af, hvilken del af ejendommen fakturaen vedrører (9.2).
  if (tekst.includes("Fakturaen vedrører ejendommens boliglejemål, som er momsfritaget. Der kan ikke afløftes moms.")) return 0;
  if (tekst.includes("Fakturaen vedrører ejendommens momsregistrerede erhvervslejemål. Der kan afløftes fuld moms.")) return moms;
  const hele = /Fakturaen vedrører hele ejendommen\. Der kan afløftes delvis moms med momsfradragsprocenten \((\d+) %\)\./.exec(tekst);
  if (hele) return (moms * Number(hele[1])) / 100;
  throw new Error("Bilaget er inklusive moms, men momsforholdet er ikke angivet.");
}

/** Andre beskrivelser af en indholdslinje, som Reference.docx tillader (8.2). */
const ALIAS: readonly { tekst: string; konto: number }[] = [
  // "Reparation af badeværelser" beskrives ved momspligtig ejendom og erhvervsdelen sådan.
  { tekst: "reparation af toilet- og omklædningsfaciliteter", konto: 4001 },
];

/** Finder kontoen ud fra den længste indholdstekst fra kontoplanen, der står i bilagsteksten. */
function kontoForIndhold(tekst: string): { konto: number; kategori: string } {
  const smaa = tekst.toLowerCase();
  let bedst: { konto: number; kategori: string; laengde: number } | null = null;
  for (const alias of ALIAS) {
    if (smaa.includes(alias.tekst)) bedst = { konto: alias.konto, kategori: "Omkostning", laengde: alias.tekst.length };
  }
  for (const konto of KONTOPLAN) {
    if (konto.kategori === "Aktiver" || konto.kategori === "Passiver") continue;
    for (const linje of konto.indhold) {
      const indhold = linje.tekst.toLowerCase();
      if (smaa.includes(indhold) && (!bedst || indhold.length > bedst.laengde)) {
        bedst = { konto: konto.nummer, kategori: konto.kategori, laengde: indhold.length };
      }
    }
  }
  if (!bedst) throw new Error("Ingen indholdstekst fra kontoplanen står i bilagsteksten.");
  return bedst;
}

/** En omkostning (evt. inkl. moms) betalt eller skyldig. */
function omkostning(b: Bogfoering, tekst: string, konto: number, beloeb: number): void {
  const moms = fradragsberettigetMoms(tekst, beloeb);
  const l = kraevLikviditet(tekst);
  post(b, konto, beloeb - moms);
  post(b, 30006, moms);
  post(b, l.konto, -beloeb);
}

/**
 * Udregner bogføringen af et bilag ud fra teksten.
 * @param saldiFoer saldiene (debet minus kredit) i T-kontiene lige før bilaget.
 */
export function laesBilag(tekst: string, saldiFoer: ReadonlyMap<number, number>): Bogfoering {
  const b: Bogfoering = new Map();

  if (tekst.includes("Lejer indbetaler tidligere opkrævet leje.")) {
    const x = eneste(tekst);
    post(b, 20004, x); // alle indbetalinger går til bankkontoen (8.3)
    post(b, 20002, -x);
    return b;
  }

  if (tekst.includes("En tidligere skyldig regning betales.")) {
    const x = eneste(tekst);
    post(b, 30004, x);
    post(b, kraevLikviditet(tekst).konto, -x);
    return b;
  }

  if (tekst.includes("afsluttes momskontiene")) {
    const salgsmoms = -(saldiFoer.get(30005) ?? 0); // kreditsaldo
    const koebsmoms = saldiFoer.get(30006) ?? 0; // debetsaldo
    post(b, 30005, salgsmoms);
    post(b, 30006, -koebsmoms);
    post(b, 30007, -(salgsmoms - koebsmoms));
    return b;
  }

  if (tekst.includes("betales momsen for momsperioden")) {
    const x = eneste(tekst);
    post(b, 30007, x);
    post(b, kraevLikviditet(tekst).konto, -x);
    return b;
  }

  if (tekst.includes("husleje for 4. kvartal")) {
    const l = kraevLikviditet(tekst);
    let i = 0;
    if (/Lejeindtægter \(momspligtig\) udgør/i.test(tekst)) {
      const brutto = beloebEfter(tekst, /Lejeindtægter \(momspligtig\) udgør/);
      post(b, 1000, -(brutto * 4) / 5);
      post(b, 30005, -brutto / 5);
      i += brutto;
    }
    if (/lejeindtægter \(ikke momspligtig\) udgør/i.test(tekst)) {
      const momsfri = beloebEfter(tekst, /[Ll]ejeindtægter \(ikke momspligtig\) udgør/);
      post(b, 1001, -momsfri);
      i += momsfri;
    }
    post(b, l.konto, i);
    return b;
  }

  if (tekst.includes("bygningsforsikring")) {
    const praemie = beloebEfter(tekst, /bygningsforsikring på/);
    const m = /dækker perioden (\w+) indeværende regnskabsår til og med (\w+) efterfølgende regnskabsår/.exec(tekst);
    if (!m) throw new Error("Forsikringsperioden står ikke i teksten.");
    const iAar = 12 - MAANEDER.indexOf(m[1]); // hele måneder i indeværende år
    const naesteAar = MAANEDER.indexOf(m[2]) + 1;
    const iAarBeloeb = (praemie * iAar) / (iAar + naesteAar); // 360-dages-konvention, hele måneder
    post(b, 2000, iAarBeloeb);
    post(b, 20003, praemie - iAarBeloeb);
    post(b, kraevLikviditet(tekst).konto, -praemie);
    return b;
  }

  if (tekst.includes("ydelse på ejendommens realkreditlån")) {
    const rente = beloebEfter(tekst, /renteomkostninger på realkreditlån/);
    const bidrag = beloebEfter(tekst, /bidrag til realkreditinstitut/);
    const afdrag = beloebEfter(tekst, /afdrag på realkreditlån/);
    post(b, 7000, rente + bidrag);
    post(b, 30002, afdrag);
    post(b, kraevLikviditet(tekst).konto, -(rente + bidrag + afdrag));
    return b;
  }

  if (tekst.includes("dagsværdiregulering på")) {
    const x = eneste(tekst);
    if (tekst.includes("positiv dagsværdiregulering")) {
      post(b, 20001, x);
      post(b, 8000, -x);
    } else if (tekst.includes("negativ dagsværdiregulering")) {
      post(b, 8000, x);
      post(b, 20001, -x);
    } else throw new Error("Det fremgår ikke, om dagsværdireguleringen er positiv eller negativ.");
    return b;
  }

  if (tekst.includes("amortisering af låneomkostninger")) {
    const x = eneste(tekst);
    post(b, 7000, x);
    post(b, 30002, -x);
    return b;
  }

  if (tekst.includes("forbedring af investeringsejendommen")) {
    omkostning(b, tekst, 20000, eneste(tekst));
    return b;
  }

  const { konto, kategori } = kontoForIndhold(tekst);
  const x = eneste(tekst);
  if (kategori === "Indtægt") {
    const l = kraevLikviditet(tekst);
    post(b, konto, -x);
    post(b, l.konto, x);
  } else {
    omkostning(b, tekst, konto, x);
  }
  return b;
}
