/**
 * Gemning af den studerendes fremskridt i browseren (Reference.docx afsnit 4), efter samme princip
 * som reference-applikationen: én igangværende opgave gemmes i localStorage efter hver ændring.
 * Opgaven selv gemmes ikke; den dannes igen ud fra variantnummer og årstal (8.1 og 8.5).
 */
import { ANTAL_BILAG, type Opgave, type Postering } from "../domain/opgave";
import { KONTOPLAN } from "../domain/kontoplan";
import type { SaldoSide, SaldoSvar } from "../domain/saldi";
import { fortolkVariantnummer } from "../domain/variant";
import { GENERATOR_VERSION } from "../generator/generator";

export const SESSION_SCHEMA = 2;

/** Bogføring af bilagene → saldiopgørelse (7.3) → afsluttende oversigt. */
export type Fase = "bogfoering" | "saldi" | "afsluttet";
export const SESSION_NOEGLE = "ejendomsregnskab.session";
export const SENESTE_NOEGLE = "ejendomsregnskab.seneste-varianter";

export interface Session {
  schema: number;
  generatorversion: number;
  /** Variantnummeret (7 cifre). */
  variant: string;
  /** Årstallet låses, når opgaven dannes (8.1). */
  aar: number;
  /** Kontrolsum af opgavens bilag og saldi; passer den ikke, er opgaven ændret, og fremskridtet kasseres. */
  fingeraftryk: string;
  posteringer: Postering[];
  /** Godkendte bilag; altid bilag 1, 2, … uden huller. */
  godkendte: number[];
  /** Det bilag, der vises i Boks 1. */
  vistBilag: number;
  /** Senest godkendte bilag, indtil der trykkes [Næste bilag] (vises grønt, 7.2). */
  nyligtGodkendt: number | null;
  fase: Fase;
  /** Den studerendes saldiopgørelse pr. konto (kontonummer som nøgle). */
  saldiSvar: Record<string, SaldoSvar>;
  opdateret: string;
}

/** Kontrolsum af opgavens indhold (bilagstekster, facit og saldi ved start). */
export function fingeraftryk(opgave: Opgave): string {
  const tekst = JSON.stringify([opgave.saldi, opgave.bilag.map((b) => [b.tekst, b.facit])]);
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) h = Math.imul(h ^ tekst.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}

export function nySession(opgave: Opgave): Session {
  return {
    schema: SESSION_SCHEMA,
    generatorversion: GENERATOR_VERSION,
    variant: opgave.variant.nummer,
    aar: opgave.aar,
    fingeraftryk: fingeraftryk(opgave),
    posteringer: [],
    godkendte: [],
    vistBilag: 1,
    nyligtGodkendt: null,
    fase: "bogfoering",
    saldiSvar: {},
    opdateret: new Date().toISOString(),
  };
}

const SALDOSIDER: readonly (SaldoSide | null)[] = ["debet", "kredit", "ingen", null];

function rensSaldiSvar(data: unknown): Record<string, SaldoSvar> {
  const resultat: Record<string, SaldoSvar> = {};
  if (typeof data !== "object" || data === null) return resultat;
  for (const [konto, svar] of Object.entries(data as Record<string, SaldoSvar>)) {
    if (!KONTONUMRE.has(Number(konto)) || typeof svar !== "object" || svar === null) continue;
    if (typeof svar.udtryk !== "string" || !SALDOSIDER.includes(svar.side)) continue;
    resultat[konto] = { udtryk: svar.udtryk, side: svar.side };
  }
  return resultat;
}

const KONTONUMRE = new Set(KONTOPLAN.map((k) => k.nummer));
const erBilagsnummer = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= ANTAL_BILAG;

function erPostering(x: unknown): x is Postering {
  const p = x as Postering;
  return (
    typeof p === "object" &&
    p !== null &&
    typeof p.id === "string" &&
    erBilagsnummer(p.bilag) &&
    KONTONUMRE.has(p.konto) &&
    (p.side === "debet" || p.side === "kredit") &&
    typeof p.udtryk === "string" &&
    Number.isInteger(p.oere) &&
    p.oere > 0
  );
}

/** Kontrollerer og retter gemte data; returnerer null, hvis de ikke kan bruges. */
export function rensSession(data: unknown): Session | null {
  const s = data as Session;
  if (typeof s !== "object" || s === null) return null;
  if (s.schema !== SESSION_SCHEMA || s.generatorversion !== GENERATOR_VERSION) return null;
  if (typeof s.fingeraftryk !== "string") return null;
  if (typeof s.variant !== "string" || !fortolkVariantnummer(s.variant).ok) return null;
  if (!Number.isInteger(s.aar) || s.aar < 2000 || s.aar > 2200) return null;
  if (!Array.isArray(s.posteringer) || !s.posteringer.every(erPostering)) return null;
  if (!Array.isArray(s.godkendte) || !s.godkendte.every(erBilagsnummer)) return null;

  // Godkendte bilag skal være 1, 2, … uden huller (man kan aldrig springe et bilag over).
  const godkendte: number[] = [];
  while (s.godkendte.includes(godkendte.length + 1)) godkendte.push(godkendte.length + 1);
  const aktuelt = godkendte.length < ANTAL_BILAG ? godkendte.length + 1 : ANTAL_BILAG;
  // Posteringer på senere bilag end det aktuelle kan ikke findes; de fjernes.
  const posteringer = s.posteringer.filter((p) => p.bilag <= aktuelt);
  const vistBilag = erBilagsnummer(s.vistBilag) && s.vistBilag <= aktuelt ? s.vistBilag : aktuelt;
  const nyligtGodkendt =
    erBilagsnummer(s.nyligtGodkendt) && s.nyligtGodkendt === godkendte[godkendte.length - 1] ? s.nyligtGodkendt : null;

  // Saldiopgørelsen og den afsluttende oversigt kræver, at alle bilag er godkendt.
  const fase: Fase = godkendte.length === ANTAL_BILAG && (s.fase === "saldi" || s.fase === "afsluttet") ? s.fase : "bogfoering";

  return {
    schema: SESSION_SCHEMA,
    generatorversion: GENERATOR_VERSION,
    variant: s.variant,
    aar: s.aar,
    fingeraftryk: s.fingeraftryk,
    posteringer,
    godkendte,
    vistBilag,
    nyligtGodkendt,
    fase,
    saldiSvar: rensSaldiSvar(s.saldiSvar),
    opdateret: typeof s.opdateret === "string" ? s.opdateret : new Date().toISOString(),
  };
}

// Browserens lager kan være slået fra (privat vindue); så virker applikationen blot uden gemning.
function laes(noegle: string): string | null {
  try {
    return localStorage.getItem(noegle);
  } catch {
    return null;
  }
}

function skriv(noegle: string, vaerdi: string | null): void {
  try {
    if (vaerdi === null) localStorage.removeItem(noegle);
    else localStorage.setItem(noegle, vaerdi);
  } catch {
    // Gemning er ikke mulig; opgaven kan stadig løses.
  }
}

export function gemSession(session: Session): void {
  skriv(SESSION_NOEGLE, JSON.stringify(session));
}

export function indlaesSession(): Session | null {
  const tekst = laes(SESSION_NOEGLE);
  if (!tekst) return null;
  try {
    const session = rensSession(JSON.parse(tekst));
    if (!session) skriv(SESSION_NOEGLE, null);
    return session;
  } catch {
    skriv(SESSION_NOEGLE, null);
    return null;
  }
}

export function sletSession(): void {
  skriv(SESSION_NOEGLE, null);
}

/** De senest brugte variantnumre, så [Ny opgave] ikke straks giver samme opgave igen. */
export function senesteVarianter(): string[] {
  try {
    const liste: unknown = JSON.parse(laes(SENESTE_NOEGLE) ?? "[]");
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string").slice(-20) : [];
  } catch {
    return [];
  }
}

export function huskVariant(nummer: string): void {
  const liste = senesteVarianter().filter((x) => x !== nummer);
  skriv(SENESTE_NOEGLE, JSON.stringify([...liste, nummer].slice(-20)));
}
