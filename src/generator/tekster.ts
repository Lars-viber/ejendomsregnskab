/**
 * Fiktive afsendere og korte beskrivelser til bilagsteksterne (Reference.docx afsnit 8.3).
 * Nøglen er indholdsteksten fra kontoplanens kolonne "Indhold"; den indgår ordret i bilagsteksten.
 * Alle firmanavne er opdigtede.
 */

export interface Indholdstekst {
  /** Mulige fiktive afsendere. */
  afsendere: readonly string[];
  /** Tekst efter indholdsteksten, f.eks. "i ejendommens opgange for 4. kvartal". */
  beskrivelse: string;
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
const BAD = ["Badeværelsesservice Flisegaard ApS", "VVS-firmaet Rørholm & Søn ApS"];
const AFFALD = ["Containerservice Affaldsby ApS", "Affaldshåndtering Ryddeholm ApS"];
const SERVICE = ["Teknisk Ejendomsservice Driftholm ApS", "Serviceteknik Nordvang ApS"];
const ELEVATOR = ["Elevatorservice Løftegaard ApS", "Elevatorfirmaet Op & Ned ApS"];
const FORSYNING = ["Forsyningsselskabet Strøm & Vand A/S", "Fjernvarmeværket Varmedal A.m.b.a."];
const TELE = ["Teleselskabet Signalby A/S", "Bredbåndsfirmaet Fiberholm A/S"];
const REVISOR = ["Revisionsfirmaet Østergaard & Kjær", "Revisorhuset Balancegaard"];
const ADVOKAT = ["Advokatfirmaet Krogh & Bang", "Advokathuset Paragrafholm"];
const IT = ["Softwarehuset Ejendomsdata ApS", "IT-firmaet Lejersystem ApS"];
const KONTOR = ["Kontorforsyningen Papirby ApS", "Kontorhuset Mappegaard ApS"];
const INDKOEB = ["Byggemarkedet Værktøjsholm ApS", "Ejendomsudstyr Gårdmøbel ApS"];
const ANNONCE = ["Boligportalen Lejebo ApS", "Annoncebureauet Ledigt Lejemål ApS"];
const RAADGIVER = ["Ingeniørfirmaet Statikholm ApS", "Arkitektfirmaet Tegnestuen Linjegaard"];
const UDLEJNING = ["Udlejningsbureauet Nøglen ApS", "Erhvervsmægler Lokalegaard ApS"];
const VAGT = ["Vagtselskabet Natteravn ApS", "Alarmcentralen Sikkerby ApS"];
const KOMMUNE = ["Kommunen"];
const FORENING = ["Grundejerforeningen Kildevang", "Fællesforeningen Søholm Park"];

export const INDHOLDSTEKSTER: Record<string, Indholdstekst> = {
  // 2000 Skatter og forsikring (uden moms)
  "Grundskyld / ejendomsskatter": { afsendere: KOMMUNE, beskrivelse: "for 2. halvår" },
  "Dækningsafgift": { afsendere: KOMMUNE, beskrivelse: "for 2. halvår" },
  "Renovationsafgifter": { afsendere: KOMMUNE, beskrivelse: "for 4. kvartal" },
  "Rottebekæmpelsesafgift": { afsendere: KOMMUNE, beskrivelse: "for indeværende år" },
  "Skorstensfejning, kommunal": { afsendere: KOMMUNE, beskrivelse: "af ejendommens skorstene" },
  // 2001 Foreningsbidrag (uden moms)
  "Grundejerforeningsbidrag": { afsendere: FORENING.slice(0, 1), beskrivelse: "for 2. halvår" },
  "Fællesforeningsbidrag": { afsendere: FORENING.slice(1), beskrivelse: "for 4. kvartal" },
  // 3000 Renholdelse
  "Trappevask": { afsendere: RENGOERING, beskrivelse: "i ejendommens opgange for 4. kvartal" },
  "Vinduespudsning": { afsendere: RENGOERING, beskrivelse: "af vinduerne i ejendommens opgange" },
  "Rengøring af fællesarealer": { afsendere: RENGOERING, beskrivelse: "for 4. kvartal" },
  // 3001 Ejendommens el, vand og varme
  "Elektricitet til fællesarealer": { afsendere: FORSYNING.slice(0, 1), beskrivelse: "aconto for 4. kvartal" },
  "Vand til fællesarealer - ejendommens andel": { afsendere: FORSYNING.slice(0, 1), beskrivelse: "aconto for 4. kvartal" },
  "Varme til fællesarealer - ejendommens andel": { afsendere: FORSYNING.slice(1), beskrivelse: "aconto for 4. kvartal" },
  // 3002 Kommunikation
  "Internet": { afsendere: TELE, beskrivelse: "til ejendommens fælles netværk for 4. kvartal" },
  "Telefon": { afsendere: TELE, beskrivelse: "til ejendommens servicetelefon for 4. kvartal" },
  // 4000 Vedligeholdelse af grønne områder
  "Ejendomsservice af grønne områder": { afsendere: GARTNER, beskrivelse: "i ejendommens gårdanlæg", maaneder: [10, 11] },
  "Snerydning": { afsendere: GARTNER, beskrivelse: "på ejendommens stier og parkeringsplads", maaneder: [12] },
  "Saltning": { afsendere: GARTNER, beskrivelse: "af ejendommens adgangsveje", maaneder: [11, 12] },
  "Hækklipning": { afsendere: GARTNER, beskrivelse: "langs ejendommens skel", maaneder: [10] },
  "Beplantning": { afsendere: GARTNER, beskrivelse: "med nye buske i gårdanlægget", maaneder: [10, 11] },
  "Havearbejde": { afsendere: GARTNER, beskrivelse: "med efterårsoprydning i gårdanlægget", maaneder: [10, 11] },
  "Vedligeholdelse af grønne områder": { afsendere: GARTNER, beskrivelse: "omkring ejendommen", maaneder: [10, 11] },
  "Skadedyrsbekæmpelse": { afsendere: SKADEDYR, beskrivelse: "i ejendommens kælder" },
  // 4001 Vedligeholdelse af bygning
  "Rensning af tagrender": { afsendere: TAG, beskrivelse: "efter løvfald", maaneder: [10, 11] },
  "Rensning af tag": { afsendere: TAG, beskrivelse: "for mos og alger" },
  "Container- og affaldsservice": { afsendere: AFFALD, beskrivelse: "ved oprydning i ejendommens kælder" },
  "Malerarbejde, vedligeholdelse": { afsendere: MALER, beskrivelse: "i ejendommens opgange" },
  "Tømrerarbejde, vedligeholdelse": { afsendere: TOEMRER, beskrivelse: "på ejendommens kælderdøre" },
  "Murerarbejde, vedligeholdelse": { afsendere: MURER, beskrivelse: "på ejendommens skorsten" },
  "VVS-arbejde, vedligeholdelse": { afsendere: VVS, beskrivelse: "på ejendommens faldstammer" },
  "Elektrikerarbejde, vedligeholdelse": { afsendere: ELEKTRIKER, beskrivelse: "på belysningen i opgangene" },
  "Gulvarbejde, vedligeholdelse": { afsendere: GULV, beskrivelse: "i en af ejendommens lejligheder" },
  "Tagreparationer, vedligeholdelse": { afsendere: TAG, beskrivelse: "efter en efterårsstorm" },
  "Facadereparationer, vedligeholdelse": { afsendere: MURER, beskrivelse: "på ejendommens gavl" },
  "Reparation af vinduer og døre": { afsendere: VINDUE, beskrivelse: "i ejendommens opgange" },
  "Reparation af kloak og afløb": { afsendere: KLOAK, beskrivelse: "i ejendommens gård" },
  "Låseservice": { afsendere: LAAS, beskrivelse: "med udskiftning af cylindre i hoveddørene" },
  "Reparation af hårde hvidevarer": { afsendere: HVIDEVARER, beskrivelse: "i en af ejendommens lejligheder" },
  "Reparation af køkkeninventar": { afsendere: KOEKKEN, beskrivelse: "i en af ejendommens lejligheder" },
  "Reparation af badeværelser": { afsendere: BAD, beskrivelse: "i en af ejendommens lejligheder" },
  // 5000 Serviceomkostninger
  "Elevatorservice": { afsendere: ELEVATOR, beskrivelse: "på ejendommens elevator for 4. kvartal" },
  "Service på varmeanlæg": { afsendere: SERVICE, beskrivelse: "inden fyringssæsonen", maaneder: [10] },
  "Service på ventilationsanlæg": { afsendere: SERVICE, beskrivelse: "med filterskift" },
  "Service på brandanlæg": { afsendere: SERVICE, beskrivelse: "ved det årlige eftersyn" },
  "Service på sprinkleranlæg": { afsendere: SERVICE, beskrivelse: "ved det årlige eftersyn" },
  "Service på adgangskontrol": { afsendere: SERVICE, beskrivelse: "for 4. kvartal" },
  "Service på porttelefon": { afsendere: SERVICE, beskrivelse: "for 4. kvartal" },
  "Service på CTS/BMS-anlæg": { afsendere: SERVICE, beskrivelse: "for 4. kvartal" },
  "Service på pumper": { afsendere: SERVICE, beskrivelse: "i ejendommens varmecentral" },
  // 6000–6009 Administration
  "Administratorhonorar": {
    afsendere: ["Ejendomsadministrationen Forvalterhuset ApS", "Administrationsselskabet Lejegaarden ApS"],
    beskrivelse: "for ejendomsadministration i 4. kvartal",
  },
  "Bogføring, revision og anden regnskabsmæssig assistance": { afsendere: REVISOR, beskrivelse: "i forbindelse med kvartalsregnskabet" },
  "Honorar til advokat": { afsendere: ADVOKAT, beskrivelse: "for bistand i en lejesag" },
  "Overførselsgebyr, hævegebyr, netbankgebyr": { afsendere: ["Bøgely Bank A/S"], beskrivelse: "for 4. kvartal" },
  "IT-system til ejendomsadministration": { afsendere: IT, beskrivelse: "med licens for 4. kvartal" },
  "Lejeadministrationssystem": { afsendere: IT, beskrivelse: "med licens for 4. kvartal" },
  "Papir, mapper, toner, kuglepenne": { afsendere: KONTOR, beskrivelse: "til ejendomskontoret" },
  "Mindre nyanskaffelser": { afsendere: INDKOEB, beskrivelse: "i form af nye cykelstativer til gården" },
  "Annoncering af ledige lejemål": { afsendere: ANNONCE, beskrivelse: "på boligportaler" },
  "Udlejningshonorar": { afsendere: UDLEJNING, beskrivelse: "for genudlejning af en lejlighed" },
  "Mæglerhonorar ved udlejning": { afsendere: UDLEJNING, beskrivelse: "af et erhvervslejemål" },
  "Ingeniørhonorarer ved almindelig drift": { afsendere: RAADGIVER.slice(0, 1), beskrivelse: "for gennemgang af ejendommens tag" },
  "Arkitekthonorarer ved almindelig drift": { afsendere: RAADGIVER.slice(1), beskrivelse: "for rådgivning om vedligeholdelse af facaden" },
  "Sikkerheds- og vagttjeneste": { afsendere: VAGT, beskrivelse: "med rundering for 4. kvartal" },
  "Alarmabonnement": { afsendere: VAGT, beskrivelse: "for 4. kvartal" },
};

/** Fiktive afsendere til de faste bilag. */
export const FORSIKRINGSSELSKABER = ["Lindholm Forsikring A/S", "Forsikringsselskabet Tryghavn A/S"];
export const REALKREDITINSTITUTTER = ["Skovbo Realkredit A/S", "Kredithuset Nordkyst A/S"];
export const BANKER = ["Bøgely Bank A/S"];
export const VALUARER = ["Valuarfirmaet Bach & Mølgaard ApS", "Ejendomsvurdering Taksholm ApS"];

/** Forbedringsprojekter: afsender og beskrivelse af arbejdet. */
export const FORBEDRINGER: readonly { afsender: string; projekt: string }[] = [
  { afsender: "Tømrerfirmaet Høvlstrup ApS", projekt: "etablering af nye altaner på gårdfacaden" },
  { afsender: "Totalentreprenør Byggeholm A/S", projekt: "efterisolering og udnyttelse af tagetagen" },
  { afsender: "Vinduesservice Karmholt ApS", projekt: "udskiftning af alle vinduer til energiruder" },
  { afsender: "VVS-firmaet Rørholm & Søn ApS", projekt: "nye badeværelser i to lejligheder" },
  { afsender: "El-installatør Strømsted ApS", projekt: "etablering af ladestandere på parkeringspladsen" },
  { afsender: "Arkitektfirmaet Tegnestuen Linjegaard", projekt: "projektering og opførelse af nye kælderrum" },
];
