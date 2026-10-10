/**
 * Saldiopgørelsen (Reference.docx afsnit 7.3): den studerende opgør saldoen på hver synlig T-konto
 * efter sidste bilag og vælger "Debet", "Kredit" eller "Ingen saldo". En konto med saldo 0 angives
 * med beløbet 0 og "Ingen saldo". Kontrollen markerer hver saldo grøn eller rød som ved bilagene.
 */
import { fortolkBeloeb } from "./beloeb";
import { bogfoerFacit, nettoSaldi, synligeKonti, type Opgave } from "./opgave";

export type SaldoSide = "debet" | "kredit" | "ingen";

export interface SaldoSvar {
  /** Det indtastede beløb eller regneudtryk ("=..."). */
  udtryk: string;
  side: SaldoSide | null;
}

export interface Kontosaldo {
  konto: number;
  side: SaldoSide;
  /** Saldoen i øre (altid ≥ 0). */
  oere: number;
  /** Summen af debet- og kreditsiden (saldo ved start + alle posteringer). */
  sumDebet: number;
  sumKredit: number;
}

/** Saldo efter sidste bilag for hver synlig konto (ud fra saldi ved start og facit). */
export function saldiEfterSidsteBilag(opgave: Opgave): Kontosaldo[] {
  const debet = new Map<number, number>();
  const kredit = new Map<number, number>();
  const laeg = (konto: number, side: "debet" | "kredit", oere: number) => {
    const m = side === "debet" ? debet : kredit;
    m.set(konto, (m.get(konto) ?? 0) + oere);
  };
  for (const s of opgave.saldi) laeg(s.konto, s.side, s.oere);
  for (const b of opgave.bilag) for (const l of b.facit) laeg(l.konto, l.side, l.oere);
  const { resultat, balance } = synligeKonti(opgave.variant.momsstatus);
  return [...resultat, ...balance].map((k) => {
    const sumDebet = debet.get(k.nummer) ?? 0;
    const sumKredit = kredit.get(k.nummer) ?? 0;
    const netto = sumDebet - sumKredit;
    return { konto: k.nummer, side: netto > 0 ? "debet" : netto < 0 ? "kredit" : "ingen", oere: Math.abs(netto), sumDebet, sumKredit };
  });
}

/** Saldi (debet minus kredit) efter sidste bilag, også for skjulte konti. */
export function nettoEfterSidsteBilag(opgave: Opgave): Map<number, number> {
  const netto = nettoSaldi(opgave.saldi);
  for (const b of opgave.bilag) bogfoerFacit(netto, b.facit);
  return netto;
}

export type SaldoMarkering = "korrekt" | "forkert";

export interface SaldoKontrol {
  korrekt: boolean;
  /** Markering pr. konto (kontonummer som nøgle). */
  konti: Record<number, SaldoMarkering>;
  hjaelpetekster: string[];
}

export const SALDO_HJAELPETEKST = {
  mangler: 'Der mangler en saldo eller et valg af "Debet", "Kredit" eller "Ingen saldo" på en eller flere konti.',
  ulaeseligt: 'Et eller flere saldobeløb kan ikke læses. Skriv et beløb eller et regneudtryk, der starter med "=".',
  forkertBeloeb: "En eller flere saldi er forkerte.",
  forkertSide: "En eller flere saldi står i den forkerte side (debet/kredit).",
  ingenSaldo: 'En konto med saldo 0 angives med beløbet 0 og valget "Ingen saldo".',
} as const;

type Fejl = keyof typeof SALDO_HJAELPETEKST;

/** Kontrollerer den studerendes saldiopgørelse. Hjælpeteksterne afslører ikke facit. */
export function kontrollerSaldi(opgave: Opgave, svar: Readonly<Record<string, SaldoSvar>>): SaldoKontrol {
  const konti: Record<number, SaldoMarkering> = {};
  const fejl = new Set<Fejl>();
  for (const forventet of saldiEfterSidsteBilag(opgave)) {
    const s = svar[forventet.konto];
    let kontoFejl: Fejl | null = null;
    if (!s || !s.udtryk.trim() || !s.side) kontoFejl = "mangler";
    else {
      const beloeb = fortolkBeloeb(s.udtryk, { tilladNul: true });
      if (!beloeb.ok) kontoFejl = "ulaeseligt";
      else if (forventet.side === "ingen") {
        if (beloeb.oere !== 0) kontoFejl = s.side === "ingen" ? "ingenSaldo" : "forkertBeloeb";
        else if (s.side !== "ingen") kontoFejl = "ingenSaldo";
      } else if (beloeb.oere !== forventet.oere) {
        kontoFejl = "forkertBeloeb";
      } else if (s.side !== forventet.side) {
        kontoFejl = s.side === "ingen" ? "ingenSaldo" : "forkertSide";
      }
    }
    konti[forventet.konto] = kontoFejl ? "forkert" : "korrekt";
    if (kontoFejl) fejl.add(kontoFejl);
  }
  const raekkefoelge: Fejl[] = ["mangler", "ulaeseligt", "forkertBeloeb", "forkertSide", "ingenSaldo"];
  const hjaelpetekster = raekkefoelge.filter((f) => fejl.has(f)).map((f) => SALDO_HJAELPETEKST[f]);
  return { korrekt: hjaelpetekster.length === 0, konti, hjaelpetekster };
}
