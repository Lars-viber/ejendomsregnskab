import type { Momsstatus } from "./momsstatus";

/**
 * Variantnummeret har 7 cifre (PLAN.md afsnit c):
 * første ciffer er momsstatus (1 = momsfri, 2 = delvis moms, 3 = momspligtig),
 * de seks næste er løbenummeret 000001–999999, som styrer alle tilfældige valg.
 * Første ciffer 4–9 er reserveret til senere generatorversioner.
 */
export interface Variant {
  nummer: string;
  momsstatus: Momsstatus;
  loebenummer: number;
}

export const MAKS_LOEBENUMMER = 999_999;

const CIFFER_FOR_MOMSSTATUS: Record<Momsstatus, string> = {
  momsfri: "1",
  delvis: "2",
  momspligtig: "3",
};

const MOMSSTATUS_FOR_CIFFER: Record<string, Momsstatus> = {
  "1": "momsfri",
  "2": "delvis",
  "3": "momspligtig",
};

export type VariantResultat = { ok: true; variant: Variant } | { ok: false; fejl: string };

export function danVariant(momsstatus: Momsstatus, loebenummer: number): Variant {
  if (!Number.isInteger(loebenummer) || loebenummer < 1 || loebenummer > MAKS_LOEBENUMMER) {
    throw new Error(`Løbenummeret skal være et helt tal fra 1 til ${MAKS_LOEBENUMMER}.`);
  }
  const nummer = `${CIFFER_FOR_MOMSSTATUS[momsstatus]}${String(loebenummer).padStart(6, "0")}`;
  return { nummer, momsstatus, loebenummer };
}

/** Fortolker et indtastet variantnummer. Mellemrum og bindestreger ignoreres. */
export function fortolkVariantnummer(indtastet: string): VariantResultat {
  const tekst = indtastet.replace(/[\s-]/g, "");
  if (tekst === "") return { ok: false, fejl: "Indtast et variantnummer." };
  if (!/^\d+$/.test(tekst)) return { ok: false, fejl: "Variantnummeret må kun indeholde cifre." };
  if (tekst.length !== 7) return { ok: false, fejl: "Variantnummeret skal have 7 cifre." };
  const momsstatus = MOMSSTATUS_FOR_CIFFER[tekst[0]];
  if (!momsstatus) {
    return { ok: false, fejl: "Variantnummeret skal begynde med 1, 2 eller 3." };
  }
  const loebenummer = Number(tekst.slice(1));
  if (loebenummer === 0) return { ok: false, fejl: "Variantnummeret findes ikke." };
  return { ok: true, variant: { nummer: tekst, momsstatus, loebenummer } };
}

/**
 * Trækker et nyt, tilfældigt variantnummer med den valgte momsstatus.
 * Numre i `undgaa` springes over, så samme browser ikke straks får samme opgave igen.
 */
export function nytVariantnummer(
  momsstatus: Momsstatus,
  undgaa: Iterable<string> = [],
  tilfaeldig: () => number = Math.random,
): Variant {
  const udelukket = new Set(undgaa);
  let loebenummer = Math.floor(tilfaeldig() * MAKS_LOEBENUMMER) + 1;
  for (let forsoeg = 0; forsoeg < MAKS_LOEBENUMMER; forsoeg++) {
    const variant = danVariant(momsstatus, loebenummer);
    if (!udelukket.has(variant.nummer)) return variant;
    loebenummer = (loebenummer % MAKS_LOEBENUMMER) + 1;
  }
  throw new Error("Der er ingen ledige variantnumre.");
}
