import type { Likviditet } from "./formuleringer";
import { KONTOPLAN, opgoerelse, type Konto } from "./kontoplan";
import type { Momsstatus } from "./momsstatus";
import type { Variant } from "./variant";

export type Side = "debet" | "kredit";

/** Antal bilag i en opgave (Reference.docx afsnit 8.2). */
export const ANTAL_BILAG = 20;

export interface Saldo {
  konto: number;
  side: Side;
  /** Beløb i øre, altid større end 0. */
  oere: number;
}

/** Henvisning til en indholdslinje i kontoplanen, som bilaget bygger på. */
export interface Indholdshenvisning {
  konto: number;
  indhold: string;
}

/** Én linje i facit for et bilag. */
export interface FacitLinje {
  konto: number;
  side: Side;
  /** Beløb i øre, altid større end 0. */
  oere: number;
}

export type Bilagstype =
  | "leje"
  | "forsikring"
  | "realkredit"
  | "administrator"
  | "vedligeholdelse"
  | "forbedring"
  | "dagsvaerdi"
  | "amortisering"
  | "momsafslutning"
  | "momsbetaling"
  | "omkostning"
  | "kassekreditrenter"
  | "renteindtaegter"
  | "tidligereSkyldig"
  | "lejerIndbetaler";

export interface Bilag {
  nummer: number;
  /** Dato som ÅÅÅÅ-MM-DD. */
  dato: string;
  /** Bilagsteksten som én sammenhængende tekst (6.2). */
  tekst: string;
  type: Bilagstype;
  likviditet: Likviditet;
  indhold: Indholdshenvisning[];
  /** Den korrekte bogføring af bilaget; bruges af [Kontroller] i fase 4. */
  facit: FacitLinje[];
}

export interface Opgave {
  variant: Variant;
  /** Årstallet låses, når opgaven dannes (8.1). */
  aar: number;
  generatorversion: number;
  /** Kun ved delvis moms. */
  momsfradragsprocent: number | null;
  /** Saldi ved opgavens start. Konti uden saldo er ikke med. */
  saldi: Saldo[];
  bilag: Bilag[];
}

/** Den studerendes postering i en T-konto. */
export interface Postering {
  id: string;
  bilag: number;
  konto: number;
  side: Side;
  /** Det indtastede, f.eks. "12345,67" eller "=1000*1,25". */
  udtryk: string;
  oere: number;
}

/** Konti, der skjules ved den valgte momsstatus (6.3). Konto 8000 vises altid. */
export function skjulteKonti(momsstatus: Momsstatus): number[] {
  if (momsstatus === "momsfri") return [1000, 30005, 30006, 30007];
  if (momsstatus === "momspligtig") return [1001];
  return [];
}

/** Synlige konti i stigende kontonummer, delt på resultatopgørelse og balance. */
export function synligeKonti(momsstatus: Momsstatus): { resultat: Konto[]; balance: Konto[] } {
  const skjult = new Set(skjulteKonti(momsstatus));
  const synlige = KONTOPLAN.filter((konto) => !skjult.has(konto.nummer));
  return {
    resultat: synlige.filter((konto) => opgoerelse(konto) === "resultat"),
    balance: synlige.filter((konto) => opgoerelse(konto) === "balance"),
  };
}

export const MAANEDER = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

/** "2026-10-01" → "1. oktober 2026". */
export function formaterDato(dato: string): string {
  const [aar, maaned, dag] = dato.split("-").map(Number);
  return `${dag}. ${MAANEDER[maaned - 1]} ${aar}`;
}

/** Saldo pr. konto som debet minus kredit (øre). */
export function nettoSaldi(saldi: readonly Saldo[]): Map<number, number> {
  const netto = new Map<number, number>();
  for (const s of saldi) netto.set(s.konto, (netto.get(s.konto) ?? 0) + (s.side === "debet" ? s.oere : -s.oere));
  return netto;
}

/** Lægger et bilags facit til saldiene (debet minus kredit). */
export function bogfoerFacit(netto: Map<number, number>, facit: readonly FacitLinje[]): void {
  for (const linje of facit) {
    netto.set(linje.konto, (netto.get(linje.konto) ?? 0) + (linje.side === "debet" ? linje.oere : -linje.oere));
  }
}
