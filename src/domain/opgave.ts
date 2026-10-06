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

export interface Bilag {
  nummer: number;
  /** Dato som ÅÅÅÅ-MM-DD. */
  dato: string;
  /** Bilagsteksten som én sammenhængende tekst (6.2). */
  tekst: string;
  indhold: Indholdshenvisning[];
}

export interface Opgave {
  variant: Variant;
  /** Årstallet låses, når opgaven dannes (8.1). */
  aar: number;
  /** Kun ved delvis moms. */
  momsfradragsprocent: number | null;
  /** Saldi ved opgavens start. Konti uden saldo er ikke med. */
  saldi: Saldo[];
  bilag: Bilag[];
  /** Markerer en fast prøveopgave (fase 2), indtil opgavegeneratoren findes. */
  erProeveopgave: boolean;
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

const MAANEDER = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

/** "2026-10-01" → "1. oktober 2026". */
export function formaterDato(dato: string): string {
  const [aar, maaned, dag] = dato.split("-").map(Number);
  return `${dag}. ${MAANEDER[maaned - 1]} ${aar}`;
}
