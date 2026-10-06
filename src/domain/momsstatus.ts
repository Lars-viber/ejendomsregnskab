export type Momsstatus = "momsfri" | "delvis" | "momspligtig";

export const MOMSSTATUSSER: readonly Momsstatus[] = ["momsfri", "delvis", "momspligtig"];

/** Knaptekster på forsiden (Reference.docx afsnit 5). */
export const MOMSSTATUS_KNAP: Record<Momsstatus, string> = {
  momsfri: "Momsfri",
  delvis: "Delvis moms",
  momspligtig: "Momspligtig",
};

/** Kort beskrivelse til visning sammen med variantnummeret. */
export const MOMSSTATUS_BESKRIVELSE: Record<Momsstatus, string> = {
  momsfri: "momsfri ejendom",
  delvis: "delvis momsregistreret ejendom",
  momspligtig: "fuldt momsregistreret ejendom",
};
