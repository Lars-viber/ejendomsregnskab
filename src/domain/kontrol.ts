/**
 * Kontrol af et bilag (Reference.docx afsnit 7.1).
 *
 * Kontrollen sammenligner nettobeløbet pr. konto i bilaget (debet minus kredit) med facit:
 * - har en konto det rigtige nettobeløb, er alle dens linjer grønne – også når beløbet er delt på
 *   flere linjer, står i en anden rækkefølge eller er bogført via en mellemregning;
 * - har en konto et forkert nettobeløb, er dens linjer røde;
 * - er der bogført på en konto, som ikke indgår i facit, er linjerne røde.
 * Hjælpeteksterne er vejledende og afslører aldrig facit.
 */
import type { FacitLinje, Postering } from "./opgave";

export type Markering = "korrekt" | "forkert";

export interface Kontrolresultat {
  korrekt: boolean;
  /** Markering pr. postering (postering.id). */
  posteringer: Record<string, Markering>;
  /** Vejledende hjælpetekster i fast rækkefølge; tom, når bilaget er korrekt. */
  hjaelpetekster: string[];
}

export const HJAELPETEKST = {
  tomt: "Der er ikke bogført noget på bilaget endnu.",
  ubalance: "Bilagets debiteringer og krediteringer balancerer ikke.",
  forkertKonto: "En eller flere af de valgte konti er forkerte.",
  manglendeKonto: "Der mangler bogføring på en eller flere konti.",
  forkertBeloeb: "Et eller flere af de indtastede beløb er forkerte.",
  forkertSide: "Et eller flere beløb står i den forkerte side (debet/kredit).",
} as const;

function netto(linjer: readonly { konto: number; side: "debet" | "kredit"; oere: number }[]): Map<number, number> {
  const resultat = new Map<number, number>();
  for (const l of linjer) resultat.set(l.konto, (resultat.get(l.konto) ?? 0) + (l.side === "debet" ? l.oere : -l.oere));
  return resultat;
}

/** Kontrollerer den studerendes posteringer på ét bilag mod bilagets facit. */
export function kontrollerBilag(facit: readonly FacitLinje[], posteringer: readonly Postering[]): Kontrolresultat {
  const facitNetto = netto(facit);
  const studerendeNetto = netto(posteringer);

  const kontoKorrekt = (konto: number) =>
    facitNetto.has(konto) && (studerendeNetto.get(konto) ?? 0) === facitNetto.get(konto);

  const markeringer: Record<string, Markering> = {};
  for (const p of posteringer) markeringer[p.id] = kontoKorrekt(p.konto) ? "korrekt" : "forkert";

  const hjaelpetekster: string[] = [];
  if (posteringer.length === 0) {
    hjaelpetekster.push(HJAELPETEKST.tomt);
  } else {
    const sum = [...studerendeNetto.values()].reduce((s, x) => s + x, 0);
    if (sum !== 0) hjaelpetekster.push(HJAELPETEKST.ubalance);
    const bogfoerteKonti = new Set(posteringer.map((p) => p.konto));
    if ([...bogfoerteKonti].some((konto) => !facitNetto.has(konto))) hjaelpetekster.push(HJAELPETEKST.forkertKonto);
    if ([...facitNetto.keys()].some((konto) => !bogfoerteKonti.has(konto))) hjaelpetekster.push(HJAELPETEKST.manglendeKonto);
    // Rigtigt beløb i den forkerte side giver en særskilt hjælpetekst (7.1, version 1.6).
    const forkerte = [...bogfoerteKonti].filter((konto) => facitNetto.has(konto) && !kontoKorrekt(konto));
    const iForkertSide = (konto: number) => (studerendeNetto.get(konto) ?? 0) === -(facitNetto.get(konto) ?? 0);
    if (forkerte.some((konto) => !iForkertSide(konto))) hjaelpetekster.push(HJAELPETEKST.forkertBeloeb);
    if (forkerte.some(iForkertSide)) hjaelpetekster.push(HJAELPETEKST.forkertSide);
  }

  return { korrekt: hjaelpetekster.length === 0, posteringer: markeringer, hjaelpetekster };
}
