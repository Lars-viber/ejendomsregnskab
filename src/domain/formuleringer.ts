/**
 * Faste formuleringer til bilagsteksterne (Reference.docx afsnit 8.3).
 * Ental står ordret som i Reference.docx. Nævner et bilag flere beløb,
 * bruges flertal: "Beløbet ..." bliver til "Beløbene ..." (projektejerens rettelse til fase 2).
 */

export type Likviditet =
  | "kassekredit"
  | "bankkonto"
  | "indbetaltBank"
  | "skyldig"
  | "tidligereSkyldigBetales"
  | "opkraevetIkkeIndbetalt"
  | "lejerIndbetalerTidligere"
  | "ingenLikviditet";

const LIKVIDITET_ENTAL: Record<Likviditet, string> = {
  kassekredit: "Bilaget er betalt via kassekredit.",
  bankkonto: "Bilaget er betalt via bankkonto.",
  indbetaltBank: "Beløbet er indbetalt på bankkonto.",
  skyldig: "Beløbet er skyldigt.",
  tidligereSkyldigBetales: "En tidligere skyldig regning betales.",
  opkraevetIkkeIndbetalt: "Beløbet er opkrævet, men endnu ikke indbetalt af lejer.",
  lejerIndbetalerTidligere: "Lejer indbetaler tidligere opkrævet leje.",
  ingenLikviditet: "Bilaget har ingen likviditetseffekt.",
};

const LIKVIDITET_FLERTAL: Partial<Record<Likviditet, string>> = {
  indbetaltBank: "Beløbene er indbetalt på bankkonto.",
  skyldig: "Beløbene er skyldige.",
  opkraevetIkkeIndbetalt: "Beløbene er opkrævet, men endnu ikke indbetalt af lejer.",
};

/** Likviditetsformuleringen; `antalBeloeb` er antallet af beløb, bilagsteksten nævner. */
export function likviditetsformulering(likviditet: Likviditet, antalBeloeb: number): string {
  if (antalBeloeb > 1) return LIKVIDITET_FLERTAL[likviditet] ?? LIKVIDITET_ENTAL[likviditet];
  return LIKVIDITET_ENTAL[likviditet];
}

export type Momsforhold = "momsfri" | "delvis" | "fuld" | "faktureretUdenMoms";

/** Momsformuleringen for omkostningsbilag. */
export function momsformulering(
  momsforhold: Momsforhold,
  { momsfradragsprocent, antalBeloeb = 1 }: { momsfradragsprocent?: number; antalBeloeb?: number } = {},
): string {
  switch (momsforhold) {
    case "momsfri":
      return "Der kan ikke afløftes moms, da ejendommen er momsfri.";
    case "delvis":
      if (momsfradragsprocent === undefined) throw new Error("Momsfradragsprocenten mangler.");
      return `Der kan afløftes delvis moms, da ejendommen er delvis momsregistreret (momsfradragsprocenten er ${momsfradragsprocent} %).`;
    case "fuld":
      return "Der kan afløftes fuld moms, da ejendommen er fuldt momsregistreret.";
    case "faktureretUdenMoms":
      return antalBeloeb > 1
        ? "Der kan ikke afløftes moms, da beløbene er faktureret uden moms."
        : "Der kan ikke afløftes moms, da beløbet er faktureret uden moms.";
  }
}
