/**
 * Reproducerbar tilfældighed: samme frø giver altid samme talrække, på alle computere.
 * Frøet er en tekst (generatorversion, variantnummer og forsøgsnummer).
 */
export interface Tilfaeldig {
  /** Tal i [0; 1). */
  tal(): number;
  /** Helt tal i [min; max]. */
  heltal(min: number, max: number): number;
  /** Kommatal i [min; max). */
  interval(min: number, max: number): number;
  vaelg<T>(liste: readonly T[]): T;
  chance(sandsynlighed: number): boolean;
  /** Ny, blandet kopi af listen. */
  bland<T>(liste: readonly T[]): T[];
}

export function danTilfaeldig(froe: string): Tilfaeldig {
  // FNV-1a giver et 32-bit startpunkt; mulberry32 giver talrækken.
  let tilstand = 2166136261;
  for (const tegn of froe) tilstand = Math.imul(tilstand ^ tegn.charCodeAt(0), 16777619) >>> 0;
  const naeste = () => {
    tilstand = (tilstand + 0x6d2b79f5) >>> 0;
    let t = tilstand;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tilfaeldig: Tilfaeldig = {
    tal: naeste,
    heltal: (min, max) => min + Math.floor(naeste() * (max - min + 1)),
    interval: (min, max) => min + naeste() * (max - min),
    vaelg: (liste) => {
      if (liste.length === 0) throw new Error("Kan ikke vælge fra en tom liste.");
      return liste[Math.floor(naeste() * liste.length)];
    },
    chance: (sandsynlighed) => naeste() < sandsynlighed,
    bland: (liste) => {
      const kopi = [...liste];
      for (let i = kopi.length - 1; i > 0; i--) {
        const j = Math.floor(naeste() * (i + 1));
        [kopi[i], kopi[j]] = [kopi[j], kopi[i]];
      }
      return kopi;
    },
  };
  return tilfaeldig;
}
