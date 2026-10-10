/**
 * Fiktive afsendere til bilagsteksterne (Reference.docx afsnit 8.3). Afsenderen skal passe til ydelsen:
 * et arkitektfirma projekterer, en entreprenør eller håndværker udfører. Alle firmanavne er opdigtede.
 * Beskrivelserne af momsbelagte ydelser står i den godkendte klassifikationsliste (klassifikation.ts).
 */

export interface Indholdstekst {
  /** Mulige fiktive afsendere. */
  afsendere: readonly string[];
  /** Afsendere, når ydelsen vedrører boliger (momsfri ejendom eller boligdelen). */
  afsendereBolig?: readonly string[];
  /** Afsendere, når ydelsen vedrører erhverv (momspligtig ejendom eller erhvervsdelen). */
  afsendereErhverv?: readonly string[];
  /** Tekst efter indholdsteksten for ydelser uden moms, f.eks. "for 2. halvår". */
  beskrivelse?: string;
  /** Måneder (10–12), hvor bilaget er plausibelt. Udeladt = hele kvartalet. */
  maaneder?: readonly number[];
}

const RENGOERING = ["Rengøringsselskabet Klar Trappe ApS", "Glans & Co. Rengøring ApS", "Opgangsservice Nord ApS"];
const GARTNER = ["Anlægsgartner Lindebjerg ApS", "Grønne Hænder Ejendomsservice ApS", "Have & Gård Service ApS"];
const SKADEDYR = ["Skadedyrsservice Fældeby ApS", "Musefri Ejendomsservice ApS"];
const VVS = ["VVS-firmaet Rørholm & Søn ApS", "Vandværket Installation ApS", "Rørmester Krogsgaard ApS"];
const MALER = ["Malerfirmaet Penselstrøg ApS", "Malermester Farvebjerg ApS"];
const TOEMRER = ["Tømrerfirmaet Høvlstrup ApS", "Tømrermester Bjælkegaard ApS"];
const MURER = ["Murerfirmaet Mørtelby ApS", "Murermester Fugholm ApS"];
const ELEKTRIKER = ["El-installatør Strømsted ApS", "Elfirmaet Kabelgaard ApS"];
const TAG = ["Tagdækkerfirmaet Tegltop ApS", "Tagservice Rygningsholm ApS"];
const GULV = ["Gulvfirmaet Plankebo ApS", "Gulvmester Slibgaard ApS"];
const VINDUE = ["Vinduesservice Karmholt ApS", "Glarmester Rudegaard ApS"];
const KLOAK = ["Kloakservice Afløbsdal ApS", "Kloakmester Brøndum ApS"];
const LAAS = ["Låsesmeden Nøglegaard ApS", "Låse- og Sikringsfirmaet Cylindra ApS"];
const HVIDEVARER = ["Hvidevareservice Køleby ApS", "Teknikeren Vaskegaard ApS"];
const KOEKKEN = ["Køkkenservice Bordplade ApS", "Snedkeriet Skabholm ApS"];
const AFFALD = ["Containerservice Affaldsby ApS", "Affaldshåndtering Ryddeholm ApS"];
const SERVICE = ["Teknisk Ejendomsservice Driftholm ApS", "Serviceteknik Nordvang ApS"];
const ELEVATOR = ["Elevatorservice Løftegaard ApS", "Elevatorfirmaet Op & Ned ApS"];
const FORSYNING = ["Forsyningsselskabet Strøm & Vand A/S", "Fjernvarmeværket Varmedal A.m.b.a."];
const TELE = ["Teleselskabet Signalby A/S", "Bredbåndsfirmaet Fiberholm A/S"];
const REVISOR = ["Revisionsfirmaet Østergaard & Kjær", "Revisorhuset Balancegaard"];
const ADVOKAT = ["Advokatfirmaet Krogh & Bang", "Advokathuset Paragrafholm"];
const IT = ["Softwarehuset Ejendomsdata ApS", "IT-firmaet Driftsdata ApS"];
const KONTOR = ["Kontorforsyningen Papirby ApS", "Kontorhuset Mappegaard ApS"];
const INDKOEB = ["Byggemarkedet Værktøjsholm ApS", "Ejendomsudstyr Gårdmøbel ApS"];
const VAGT = ["Vagtselskabet Natteravn ApS", "Alarmcentralen Sikkerby ApS"];
const KOMMUNE = ["Kommunen"];

export const INDHOLDSTEKSTER: Record<string, Indholdstekst> = {
  // 2000 Skatter og forsikring (uden moms)
  "Grundskyld / ejendomsskatter": { afsendere: KOMMUNE, beskrivelse: "for 2. halvår" },
  "Dækningsafgift": { afsendere: KOMMUNE, beskrivelse: "for 2. halvår" },
  "Renovationsafgifter": { afsendere: KOMMUNE, beskrivelse: "for 4. kvartal" },
  "Rottebekæmpelsesafgift": { afsendere: KOMMUNE, beskrivelse: "for indeværende år" },
  "Skorstensfejning, kommunal": { afsendere: KOMMUNE, beskrivelse: "af ejendommens skorstene" },
  // 2001 Foreningsbidrag (uden moms)
  "Grundejerforeningsbidrag": { afsendere: ["Grundejerforeningen Kildevang"], beskrivelse: "for 2. halvår" },
  "Fællesforeningsbidrag": { afsendere: ["Fællesforeningen Søholm Park"], beskrivelse: "for 4. kvartal" },
  // 3000 Renholdelse
  "Trappevask": { afsendere: RENGOERING },
  "Vinduespudsning": { afsendere: RENGOERING },
  "Rengøring af fællesarealer": { afsendere: RENGOERING },
  // 3001 Ejendommens el, vand og varme
  "Elektricitet til fællesarealer": { afsendere: FORSYNING.slice(0, 1) },
  "Vand til fællesarealer - ejendommens andel": { afsendere: FORSYNING.slice(0, 1) },
  "Varme til fællesarealer - ejendommens andel": { afsendere: FORSYNING.slice(1) },
  // 3002 Kommunikation
  "Internet": { afsendere: TELE },
  "Telefon": { afsendere: TELE },
  // 4000 Vedligeholdelse af grønne områder
  "Ejendomsservice af grønne områder": { afsendere: GARTNER, maaneder: [10, 11] },
  "Snerydning": { afsendere: GARTNER, maaneder: [12] },
  "Saltning": { afsendere: GARTNER, maaneder: [11, 12] },
  "Hækklipning": { afsendere: GARTNER, maaneder: [10] },
  "Beplantning": { afsendere: GARTNER, maaneder: [10, 11] },
  "Havearbejde": { afsendere: GARTNER, maaneder: [10, 11] },
  "Vedligeholdelse af grønne områder": { afsendere: GARTNER, maaneder: [10, 11] },
  "Skadedyrsbekæmpelse": { afsendere: SKADEDYR },
  // 4001 Vedligeholdelse af bygning
  "Rensning af tagrender": { afsendere: TAG, maaneder: [10, 11] },
  "Rensning af tag": { afsendere: TAG },
  "Container- og affaldsservice": { afsendere: AFFALD },
  "Malerarbejde, vedligeholdelse": { afsendere: MALER },
  "Tømrerarbejde, vedligeholdelse": { afsendere: TOEMRER },
  "Murerarbejde, vedligeholdelse": { afsendere: MURER },
  "VVS-arbejde, vedligeholdelse": { afsendere: VVS },
  "Elektrikerarbejde, vedligeholdelse": { afsendere: ELEKTRIKER },
  "Gulvarbejde, vedligeholdelse": { afsendere: GULV },
  "Tagreparationer, vedligeholdelse": { afsendere: TAG },
  "Facadereparationer, vedligeholdelse": { afsendere: MURER },
  "Reparation af vinduer og døre": { afsendere: VINDUE },
  "Reparation af kloak og afløb": { afsendere: KLOAK },
  "Låseservice": { afsendere: LAAS },
  "Reparation af hårde hvidevarer": { afsendere: HVIDEVARER },
  "Reparation af køkkeninventar": { afsendere: KOEKKEN },
  "Reparation af badeværelser": { afsendere: VVS },
  // 5000 Serviceomkostninger
  "Elevatorservice": { afsendere: ELEVATOR },
  "Service på varmeanlæg": { afsendere: SERVICE, maaneder: [10] },
  "Service på ventilationsanlæg": { afsendere: SERVICE },
  "Service på brandanlæg": { afsendere: SERVICE },
  "Service på sprinkleranlæg": { afsendere: SERVICE },
  "Service på adgangskontrol": { afsendere: SERVICE },
  "Service på porttelefon": { afsendere: SERVICE },
  "Service på CTS/BMS-anlæg": { afsendere: SERVICE },
  "Service på pumper": { afsendere: SERVICE },
  // 6000–6009 Administration
  "Administratorhonorar": { afsendere: ["Ejendomsadministrationen Forvalterhuset ApS", "Administrationsselskabet Lejegaarden ApS"] },
  "Bogføring, revision og anden regnskabsmæssig assistance": { afsendere: REVISOR },
  "Honorar til advokat": { afsendere: ADVOKAT },
  "Overførselsgebyr, hævegebyr, netbankgebyr": { afsendere: ["Bøgely Bank A/S"], beskrivelse: "for 4. kvartal" },
  "IT-system til ejendomsadministration": { afsendere: IT },
  "Lejeadministrationssystem": { afsendere: IT },
  "Papir, mapper, toner, kuglepenne": { afsendere: KONTOR },
  "Mindre nyanskaffelser": { afsendere: INDKOEB },
  "Annoncering af ledige lejemål": {
    afsendere: ["Annoncebureauet Ledigt Lejemål ApS"],
    afsendereBolig: ["Boligportalen Lejebo ApS"],
    afsendereErhverv: ["Erhvervsportalen Lokaleguiden ApS"],
  },
  "Udlejningshonorar": {
    afsendere: ["Udlejningsbureauet Nøglen ApS"],
    afsendereBolig: ["Udlejningsbureauet Nøglen ApS"],
    afsendereErhverv: ["Erhvervsmægler Lokalegaard ApS"],
  },
  "Mæglerhonorar ved udlejning": {
    afsendere: ["Udlejningsmægleren Nøglegaard ApS"],
    afsendereBolig: ["Udlejningsmægleren Nøglegaard ApS"],
    afsendereErhverv: ["Erhvervsmægler Lokalegaard ApS"],
  },
  "Ingeniørhonorarer ved almindelig drift": { afsendere: ["Ingeniørfirmaet Statikholm ApS"] },
  "Arkitekthonorarer ved almindelig drift": { afsendere: ["Arkitektfirmaet Tegnestuen Linjegaard"] },
  "Sikkerheds- og vagttjeneste": { afsendere: VAGT },
  "Alarmabonnement": { afsendere: VAGT },
};

/** Fiktive afsendere til de faste bilag. */
export const FORSIKRINGSSELSKABER = ["Lindholm Forsikring A/S", "Forsikringsselskabet Tryghavn A/S"];
export const REALKREDITINSTITUTTER = ["Skovbo Realkredit A/S", "Kredithuset Nordkyst A/S"];
export const BANKER = ["Bøgely Bank A/S"];
export const VALUARER = ["Valuarfirmaet Bach & Mølgaard ApS", "Ejendomsvurdering Taksholm ApS"];

/**
 * Leverandører af regninger fra før opgavens start (8.3: beløbet skal passe til leverandøren).
 * Ydelsen nævner ikke beboelse, så teksten kan bruges ved alle momsstatusser.
 */
export const REGNINGER_FOER_START: readonly { afsendere: readonly string[]; ydelse: string; min: number; max: number }[] = [
  { afsendere: VVS, ydelse: "VVS-arbejde", min: 4_000, max: 40_000 },
  { afsendere: MALER, ydelse: "malerarbejde", min: 8_000, max: 60_000 },
  { afsendere: TOEMRER, ydelse: "tømrerarbejde", min: 6_000, max: 50_000 },
  { afsendere: ELEKTRIKER, ydelse: "elektrikerarbejde", min: 4_000, max: 35_000 },
  { afsendere: TAG, ydelse: "tagarbejde", min: 10_000, max: 80_000 },
  { afsendere: REVISOR, ydelse: "revision", min: 10_000, max: 45_000 },
  { afsendere: ADVOKAT, ydelse: "juridisk bistand", min: 5_000, max: 35_000 },
  { afsendere: RENGOERING, ydelse: "rengøring", min: 3_000, max: 15_000 },
  { afsendere: GARTNER, ydelse: "pleje af ejendommens grønne områder", min: 3_000, max: 20_000 },
  { afsendere: LAAS, ydelse: "låseservice", min: 2_000, max: 8_000 },
  { afsendere: ["Totalentreprenør Byggeholm A/S"], ydelse: "byggearbejde", min: 50_000, max: 200_000 },
];
