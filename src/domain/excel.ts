/**
 * Excel-udtræk af en opgave (Reference.docx afsnit 7.3, version 1.6).
 *
 * Filen har tre faner: "Saldi ved start", "Bilag og facit" og "Saldobalance". Den indeholder ingen
 * nøgletal, og filnavnet indeholder variantnummeret. Beløb står som tal med to decimaler, så der kan
 * regnes på dem i Excel. Filen dannes helt i browseren (uden server og uden eksterne biblioteker),
 * så applikationen fortsat kan ligge som statisk side på GitHub Pages.
 */
import { KONTOPLAN } from "./kontoplan";
import { MOMSSTATUS_BESKRIVELSE } from "./momsstatus";
import { formaterDato, nettoSaldi, type Opgave } from "./opgave";
import { nettoEfterSidsteBilag } from "./saldi";

const NAVN = new Map(KONTOPLAN.map((k) => [k.nummer, k.navn]));

// ---------------------------------------------------------------------------
// Zip-arkiv uden komprimering (en .xlsx-fil er et zip-arkiv)
// ---------------------------------------------------------------------------

const CRC_TABEL = (() => {
  const tabel = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabel[n] = c >>> 0;
  }
  return tabel;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABEL[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(filer: { navn: string; indhold: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const dele: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const fil of filer) {
    const navn = enc.encode(fil.navn);
    const data = enc.encode(fil.indhold);
    const crc = crc32(data);
    const lokal = new DataView(new ArrayBuffer(30));
    lokal.setUint32(0, 0x04034b50, true);
    lokal.setUint16(4, 20, true); // version
    lokal.setUint16(6, 0x0800, true); // UTF-8-navne
    lokal.setUint16(8, 0, true); // ingen komprimering
    lokal.setUint16(10, 0, true); // tid
    lokal.setUint16(12, 0x21, true); // dato 1980-01-01
    lokal.setUint32(14, crc, true);
    lokal.setUint32(18, data.length, true);
    lokal.setUint32(22, data.length, true);
    lokal.setUint16(26, navn.length, true);
    lokal.setUint16(28, 0, true);
    dele.push(new Uint8Array(lokal.buffer), navn, data);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, navn.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), navn);
    offset += 30 + navn.length + data.length;
  }
  const centralStoerrelse = central.reduce((s, d) => s + d.length, 0);
  const slut = new DataView(new ArrayBuffer(22));
  slut.setUint32(0, 0x06054b50, true);
  slut.setUint16(8, filer.length, true);
  slut.setUint16(10, filer.length, true);
  slut.setUint32(12, centralStoerrelse, true);
  slut.setUint32(16, offset, true);
  const alle = [...dele, ...central, new Uint8Array(slut.buffer)];
  const resultat = new Uint8Array(alle.reduce((s, d) => s + d.length, 0));
  let pos = 0;
  for (const d of alle) {
    resultat.set(d, pos);
    pos += d.length;
  }
  return resultat;
}

// ---------------------------------------------------------------------------
// Regneark
// ---------------------------------------------------------------------------

/** Celletyper: tekst, heltal (kontonummer) eller beløb (i øre). Typografi: fed og/eller ombrudt tekst. */
type Celle = { tekst: string; fed?: boolean; ombryd?: boolean } | { heltal: number } | { oere: number; fed?: boolean } | null;
type Raekke = Celle[];

interface Ark {
  navn: string;
  kolonnebredder: number[];
  raekker: Raekke[];
}

const esc = (tekst: string) =>
  tekst
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const kolonne = (i: number) => String.fromCharCode(65 + i);

// Typografier i styles.xml: 0 normal, 1 beløb, 2 fed, 3 fed beløb, 4 ombrudt tekst.
function celleXml(celle: Celle, ref: string): string {
  if (!celle) return "";
  if ("oere" in celle) return `<c r="${ref}" s="${celle.fed ? 3 : 1}"><v>${(celle.oere / 100).toFixed(2)}</v></c>`;
  if ("heltal" in celle) return `<c r="${ref}"><v>${celle.heltal}</v></c>`;
  const s = celle.ombryd ? 4 : celle.fed ? 2 : 0;
  return `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${esc(celle.tekst)}</t></is></c>`;
}

function arkXml(ark: Ark): string {
  const cols = ark.kolonnebredder
    .map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`)
    .join("");
  const rows = ark.raekker
    .map((raekke, r) => `<row r="${r + 1}">${raekke.map((c, i) => celleXml(c, `${kolonne(i)}${r + 1}`)).join("")}</row>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function projektmappe(ark: Ark[]): Uint8Array {
  const filer = [
    {
      navn: "[Content_Types].xml",
      indhold: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ark
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    },
    {
      navn: "_rels/.rels",
      indhold: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      navn: "xl/workbook.xml",
      indhold: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${ark
        .map((a, i) => `<sheet name="${esc(a.navn)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    },
    {
      navn: "xl/_rels/workbook.xml.rels",
      indhold: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ark
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${ark.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { navn: "xl/styles.xml", indhold: STYLES },
    ...ark.map((a, i) => ({ navn: `xl/worksheets/sheet${i + 1}.xml`, indhold: arkXml(a) })),
  ];
  return zip(filer);
}

// ---------------------------------------------------------------------------
// Opgavens indhold
// ---------------------------------------------------------------------------

const OVERSKRIFT: Raekke = [
  { tekst: "Konto", fed: true },
  { tekst: "Kontonavn", fed: true },
  { tekst: "Debet", fed: true },
  { tekst: "Kredit", fed: true },
];

function kontoraekker(netto: Map<number, number>): Raekke[] {
  const raekker = [...netto]
    .filter(([, v]) => v !== 0)
    .sort((a, b) => a[0] - b[0])
    .map(([konto, v]): Raekke => [{ heltal: konto }, { tekst: NAVN.get(konto) ?? "" }, v > 0 ? { oere: v } : null, v < 0 ? { oere: -v } : null]);
  const debet = [...netto.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const kredit = -[...netto.values()].filter((v) => v < 0).reduce((s, v) => s + v, 0);
  return [OVERSKRIFT, ...raekker, [null, { tekst: "I alt", fed: true }, { oere: debet, fed: true }, { oere: kredit, fed: true }]];
}

function titel(opgave: Opgave, del: string): Raekke[] {
  const moms = MOMSSTATUS_BESKRIVELSE[opgave.variant.momsstatus];
  const procent = opgave.momsfradragsprocent !== null ? `, momsfradragsprocent ${opgave.momsfradragsprocent} %` : "";
  return [
    [{ tekst: `Ejendomsselskabet Ejendommen A/S – bogføring af 4. kvartal ${opgave.aar} – ${del}`, fed: true }],
    [{ tekst: `Variantnummer ${opgave.variant.nummer} – ${moms}${procent}` }],
    [],
  ];
}

export function excelFilnavn(opgave: Opgave): string {
  return `Ejendomsregnskab_variant_${opgave.variant.nummer}.xlsx`;
}

/** Danner Excel-filen for opgaven. */
export function danExcel(opgave: Opgave): Uint8Array {
  const bredder = [10, 70, 16, 16];
  const start: Ark = {
    navn: "Saldi ved start",
    kolonnebredder: bredder,
    raekker: [...titel(opgave, "saldi ved opgavens start"), ...kontoraekker(nettoSaldi(opgave.saldi))],
  };

  const bilagsraekker: Raekke[] = [...titel(opgave, "bilag og facit")];
  for (const b of opgave.bilag) {
    bilagsraekker.push([{ tekst: `Bilag ${b.nummer}`, fed: true }, { tekst: formaterDato(b.dato), fed: true }]);
    bilagsraekker.push([null, { tekst: b.tekst, ombryd: true }]);
    bilagsraekker.push(OVERSKRIFT);
    for (const l of b.facit) {
      bilagsraekker.push([
        { heltal: l.konto },
        { tekst: NAVN.get(l.konto) ?? "" },
        l.side === "debet" ? { oere: l.oere } : null,
        l.side === "kredit" ? { oere: l.oere } : null,
      ]);
    }
    bilagsraekker.push([]);
  }
  const bilag: Ark = { navn: "Bilag og facit", kolonnebredder: bredder, raekker: bilagsraekker };

  const saldobalance: Ark = {
    navn: "Saldobalance",
    kolonnebredder: bredder,
    raekker: [...titel(opgave, "saldobalance (saldi efter sidste bilag)"), ...kontoraekker(nettoEfterSidsteBilag(opgave))],
  };

  return projektmappe([start, bilag, saldobalance]);
}
