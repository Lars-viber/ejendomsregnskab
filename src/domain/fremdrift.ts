/**
 * Regler for, hvilke bilag den studerende kan se og arbejde med (Reference.docx afsnit 5 og 7.2):
 * man kan aldrig gå frem til et senere bilag, før det aktuelle bilag er godkendt,
 * men man kan altid gå tilbage og se tidligere bilag.
 */
import type { Opgave } from "./opgave";

/** Det første bilag, der endnu ikke er godkendt, eller null, når alle er godkendt. */
export function aktueltBilag(opgave: Opgave, godkendte: readonly number[]): number | null {
  return opgave.bilag.find((bilag) => !godkendte.includes(bilag.nummer))?.nummer ?? null;
}

/** Om bilaget kan vælges i statusbaren: det aktuelle bilag og alle tidligere bilag. */
export function kanVaelgeBilag(opgave: Opgave, godkendte: readonly number[], nummer: number): boolean {
  if (!opgave.bilag.some((bilag) => bilag.nummer === nummer)) return false;
  const aktuelt = aktueltBilag(opgave, godkendte);
  return aktuelt === null || nummer <= aktuelt;
}

/** Om der kan bogføres på det viste bilag: kun det aktuelle, endnu ikke godkendte bilag. */
export function kanBogfoerePaa(opgave: Opgave, godkendte: readonly number[], vist: number): boolean {
  return aktueltBilag(opgave, godkendte) === vist;
}

/** Bilaget, som [Næste bilag] fører til, eller null, når knappen skal være grå. */
export function naesteBilag(opgave: Opgave, godkendte: readonly number[], vist: number): number | null {
  if (!godkendte.includes(vist)) return null;
  const naeste = opgave.bilag.find((bilag) => bilag.nummer > vist)?.nummer ?? null;
  return naeste !== null && kanVaelgeBilag(opgave, godkendte, naeste) ? naeste : null;
}
