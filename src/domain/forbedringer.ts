/**
 * Forbedringsprojekter (Reference.docx 8.3, 8.4, 9.1 og 9.2, version 1.6).
 *
 * - Afsenderen udfører selv arbejdet (8.3).
 * - Beskrivelsen findes for de anvendelser, hvor projektet giver mening; ved delvis moms nævner den
 *   direkte, hvilken del projektet vedrører (9.2). Vinduer vedrører aldrig hele ejendommen, tag altid;
 *   altaner kun boliger.
 * - Beløbet skal passe til projektets art og omfang (8.4): hvert projekt har et realistisk prisinterval
 *   i kr. inklusive moms inden for rammen 100.000–750.000 kr. Store projekter bruges kun ved store beløb.
 * - Små projekter (lille: true) bruges også, når reglen i 9.4 (salgsmomsen størst) gør forbedringen
 *   mindre end 100.000 kr.
 * Listen er referencedata og bruges af både generatoren og regelkontrollen.
 */
export interface Forbedring {
  navn: string;
  /** Prisinterval i hele kroner inklusive moms. */
  min: number;
  max: number;
  lille?: boolean;
  afsender: string;
  momsfri?: string;
  momspligtig?: string;
  bolig?: string;
  erhverv?: string;
  hele?: string;
}

export const FORBEDRINGER: readonly Forbedring[] = [
  // Altaner: kun boliger.
  {
    navn: "Altaner",
    min: 300_000,
    max: 700_000,
    afsender: "Tømrerfirmaet Høvlstrup ApS",
    momsfri: "etablering af nye altaner til ejendommens lejligheder",
    bolig: "etablering af nye altaner til lejlighederne i boligdelen",
  },
  {
    navn: "Badeværelser / toilet- og omklædningsfaciliteter",
    min: 150_000,
    max: 350_000,
    afsender: "VVS-firmaet Rørholm & Søn ApS",
    momsfri: "nye badeværelser i to af ejendommens lejligheder",
    momspligtig: "nye toilet- og omklædningsfaciliteter i et af ejendommens kontorlejemål",
    bolig: "nye badeværelser i to af boligdelens lejligheder",
    erhverv: "nye toilet- og omklædningsfaciliteter i et af ejendommens erhvervslejemål",
  },
  // Vinduer kan opdeles og vedrører derfor aldrig hele ejendommen (9.2).
  {
    navn: "Energiruder",
    min: 200_000,
    max: 600_000,
    afsender: "Vinduesservice Karmholt ApS",
    momsfri: "udskiftning af alle ejendommens vinduer til energiruder",
    momspligtig: "udskiftning af alle kontorvinduer til energiruder",
    bolig: "udskiftning af vinduerne i boligdelens lejligheder til energiruder",
    erhverv: "udskiftning af vinduerne i erhvervslejemålene til energiruder",
  },
  // Ombygning af et lejemål.
  {
    navn: "Ombygning af et lejemål",
    min: 150_000,
    max: 450_000,
    afsender: "Totalentreprenør Byggeholm A/S",
    momsfri: "ombygning og modernisering af en af ejendommens lejligheder",
    momspligtig: "ombygning af et af ejendommens kontorlejemål til moderne kontorer",
    bolig: "ombygning og modernisering af en lejlighed i boligdelen",
    erhverv: "ombygning af et erhvervslejemål til moderne kontorer",
  },
  // Udnyttelse af tagetagen.
  {
    navn: "Udnyttelse af tagetagen",
    min: 500_000,
    max: 750_000,
    afsender: "Totalentreprenør Byggeholm A/S",
    momsfri: "udnyttelse af tagetagen til to nye lejligheder",
    momspligtig: "udnyttelse af tagetagen til nye kontorlokaler",
    bolig: "udnyttelse af tagetagen til to nye lejligheder i boligdelen",
    erhverv: "udnyttelse af tagetagen til et nyt erhvervslejemål",
  },
  // Tag: altid hele ejendommen (9.2).
  {
    navn: "Efterisolering og ny tagbelægning",
    min: 450_000,
    max: 750_000,
    afsender: "Tagdækkerfirmaet Tegltop ApS",
    momsfri: "efterisolering og ny tagbelægning på hele ejendommen",
    momspligtig: "efterisolering og ny tagbelægning på hele ejendommen",
    hele: "efterisolering og ny tagbelægning på hele ejendommen",
  },
  {
    navn: "Ladestandere",
    min: 100_000,
    max: 250_000,
    lille: true,
    afsender: "El-installatør Strømsted ApS",
    momsfri: "etablering af ladestandere på ejendommens fælles parkeringsplads",
    momspligtig: "etablering af ladestandere på ejendommens parkeringsplads",
    bolig: "etablering af ladestandere på boligernes parkeringspladser",
    erhverv: "etablering af ladestandere ved erhvervslejemålenes parkeringspladser",
    hele: "etablering af ladestandere på ejendommens fælles parkeringsplads",
  },
  {
    navn: "Ny elevator",
    min: 450_000,
    max: 750_000,
    afsender: "Elevatorfirmaet Op & Ned ApS",
    momsfri: "installation af en ny elevator i ejendommens opgang",
    momspligtig: "installation af en ny elevator i kontorbygningen",
    bolig: "installation af en ny elevator i boligopgangen",
    erhverv: "installation af en ny elevator i erhvervsdelen",
    hele: "installation af en ny fælles elevator i ejendommens hovedopgang",
  },
  {
    navn: "Ventilationsanlæg",
    min: 250_000,
    max: 600_000,
    afsender: "Ventilationsfirmaet Luftstrøm ApS",
    momsfri: "etablering af nyt ventilationsanlæg med varmegenvinding i ejendommens lejligheder",
    momspligtig: "etablering af nyt ventilationsanlæg med varmegenvinding i ejendommens kontorer",
    bolig: "etablering af nyt ventilationsanlæg med varmegenvinding i boligdelens lejligheder",
    erhverv: "etablering af nyt ventilationsanlæg med varmegenvinding i erhvervslejemålene",
    hele: "etablering af nyt fælles ventilationsanlæg med varmegenvinding for hele ejendommen",
  },
  // Energirenovering.
  {
    navn: "Efterisolering af facader",
    min: 450_000,
    max: 750_000,
    afsender: "Murerfirmaet Mørtelby ApS",
    momsfri: "efterisolering af hele ejendommens facader",
    momspligtig: "efterisolering af hele ejendommens facader",
    hele: "efterisolering af hele ejendommens facader",
  },
  {
    navn: "Varmepumpe",
    min: 120_000,
    max: 300_000,
    lille: true,
    afsender: "VVS-firmaet Rørholm & Søn ApS",
    momsfri: "installation af en ny varmepumpe til ejendommens fælles varmeanlæg",
    momspligtig: "installation af en ny varmepumpe til ejendommens fælles varmeanlæg",
    hele: "installation af en ny varmepumpe til ejendommens fælles varmeanlæg",
  },
  {
    navn: "Solceller",
    min: 100_000,
    max: 280_000,
    lille: true,
    afsender: "El-installatør Strømsted ApS",
    momsfri: "etablering af solceller på ejendommens tag",
    momspligtig: "etablering af solceller på ejendommens tag",
    hele: "etablering af solceller på ejendommens tag",
  },
];

/** Beskrivelserne af et projekt (alle anvendelser). */
export function forbedringstekster(f: Forbedring): string[] {
  return [f.momsfri, f.momspligtig, f.bolig, f.erhverv, f.hele].filter((x): x is string => Boolean(x));
}
