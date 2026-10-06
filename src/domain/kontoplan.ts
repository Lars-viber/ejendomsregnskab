import kontoplanData from "../data/kontoplan.json";

/** Kontoplanens kategorier, som de står i Kontoplan.xlsx. */
export type Kategori = "Indtægt" | "Omkostning" | "Omkostning/indtægt" | "Aktiver" | "Passiver";

export interface Indholdslinje {
  tekst: string;
  /** Kolonnen "Inklusive moms": true = ja, false = nej, null = tom (balancekonti). */
  inklusiveMoms: boolean | null;
}

export interface Konto {
  nummer: number;
  kategori: Kategori;
  navn: string;
  indhold: Indholdslinje[];
}

export type Opgoerelse = "resultat" | "balance";

const KATEGORIER: readonly Kategori[] = ["Indtægt", "Omkostning", "Omkostning/indtægt", "Aktiver", "Passiver"];

function kontrolleretKontoplan(): Konto[] {
  return kontoplanData.konti.map((konto) => {
    if (!KATEGORIER.includes(konto.kategori as Kategori)) {
      throw new Error(`Ukendt kategori "${konto.kategori}" på konto ${konto.nummer}.`);
    }
    return { ...konto, kategori: konto.kategori as Kategori };
  });
}

/** Alle konti i stigende kontonummer. Kilden er Kontoplan.xlsx via kontoplan.json. */
export const KONTOPLAN: readonly Konto[] = kontrolleretKontoplan();

export function opgoerelse(konto: Konto): Opgoerelse {
  return konto.kategori === "Aktiver" || konto.kategori === "Passiver" ? "balance" : "resultat";
}

export function findKonto(nummer: number): Konto {
  const konto = KONTOPLAN.find((k) => k.nummer === nummer);
  if (!konto) throw new Error(`Konto ${nummer} findes ikke i kontoplanen.`);
  return konto;
}
