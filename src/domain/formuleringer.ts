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

/**
 * Momsforholdet for et omkostningsbilag (8.3):
 * - momsfri / fuld: momsfri og fuldt momsregistreret ejendom,
 * - delvisBolig / delvisErhverv / delvisHele: delvis momsregistreret ejendom, efter hvilken del fakturaen vedrører,
 * - faktureretUdenMoms: beløbet er faktureret uden moms.
 */
export type Momsforhold = "momsfri" | "fuld" | "delvisBolig" | "delvisErhverv" | "delvisHele" | "faktureretUdenMoms";

/** Momsformuleringen for omkostningsbilag, ordret fra Reference.docx 8.3. */
export function momsformulering(
  momsforhold: Momsforhold,
  { momsfradragsprocent, antalBeloeb = 1 }: { momsfradragsprocent?: number; antalBeloeb?: number } = {},
): string {
  switch (momsforhold) {
    case "momsfri":
      return "Der kan ikke afløftes moms, da ejendommen er momsfri.";
    case "fuld":
      return "Der kan afløftes fuld moms, da ejendommen er fuldt momsregistreret.";
    case "delvisBolig":
      return "Fakturaen vedrører ejendommens boliglejemål, som er momsfritaget. Der kan ikke afløftes moms.";
    case "delvisErhverv":
      return "Fakturaen vedrører ejendommens momsregistrerede erhvervslejemål. Der kan afløftes fuld moms.";
    case "delvisHele":
      if (momsfradragsprocent === undefined) throw new Error("Momsfradragsprocenten mangler.");
      return `Fakturaen vedrører hele ejendommen. Der kan afløftes delvis moms med momsfradragsprocenten (${momsfradragsprocent} %).`;
    case "faktureretUdenMoms":
      return antalBeloeb > 1
        ? "Der kan ikke afløftes moms, da beløbene er faktureret uden moms."
        : "Der kan ikke afløftes moms, da beløbet er faktureret uden moms.";
  }
}
