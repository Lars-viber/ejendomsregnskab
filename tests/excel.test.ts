// @vitest-environment node
import { danExcel, excelFilnavn } from "../src/domain/excel";
import { nettoSaldi } from "../src/domain/opgave";
import { nettoEfterSidsteBilag } from "../src/domain/saldi";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";
import { udpakZip } from "../scripts/kontoplanXlsx.ts";

/** Excel-udtrækket (Reference.docx 7.3, version 1.6). */
const opgave = danOpgave(danVariant("delvis", 104729), 2026);
const filer = udpakZip(Buffer.from(danExcel(opgave)));
const tekst = (navn: string) => filer.get(navn)!.toString("utf8");

const afkod = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** Rækker i et ark: tekstceller, kontonumre (heltal uden typografi) og beløb (talceller med beløbsformat). */
function rækker(nr: number): { tekster: string[]; konti: number[]; tal: number[] }[] {
  return [...tekst(`xl/worksheets/sheet${nr}.xml`).matchAll(/<row r="\d+">([\s\S]*?)<\/row>/g)].map((r) => ({
    tekster: [...r[1].matchAll(/<t xml:space="preserve">([\s\S]*?)<\/t>/g)].map((m) => afkod(m[1])),
    konti: [...r[1].matchAll(/<c r="[A-Z]+\d+"><v>(\d+)<\/v><\/c>/g)].map((m) => Number(m[1])),
    tal: [...r[1].matchAll(/<c r="[A-Z]+\d+" s="[13]"><v>([^<]*)<\/v><\/c>/g)].map((m) => Number(m[1])),
  }));
}

/** Konto → beløb i kroner ud fra et ark med kontolinjer. */
function kontolinjer(nr: number): Map<number, number> {
  const resultat = new Map<number, number>();
  for (const r of rækker(nr)) {
    if (r.konti.length !== 1 || r.tal.length !== 1) continue;
    resultat.set(r.konti[0], r.tal[0]);
  }
  return resultat;
}

describe("Excel-filen", () => {
  it("har et filnavn med variantnummeret", () => {
    expect(excelFilnavn(opgave)).toBe("Ejendomsregnskab_variant_2104729.xlsx");
  });

  it("er en gyldig projektmappe med de tre faner i rigtig rækkefølge", () => {
    for (const del of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml"]) {
      expect(filer.has(del)).toBe(true);
    }
    const navne = [...tekst("xl/workbook.xml").matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    expect(navne).toEqual(["Saldi ved start", "Bilag og facit", "Saldobalance"]);
  });

  it("indeholder saldiene ved start som tal med to decimaler", () => {
    const xml = tekst("xl/worksheets/sheet1.xml");
    for (const [konto, netto] of nettoSaldi(opgave.saldi)) {
      expect(xml).toContain(`<v>${konto}</v>`);
      expect(xml).toContain(`<v>${(Math.abs(netto) / 100).toFixed(2)}</v>`);
    }
    // Beløb er talceller (ikke tekst) med talformatet #.##0,00.
    expect(xml).not.toMatch(/<t xml:space="preserve">[\d.]+,\d\d<\/t>/);
    expect(tekst("xl/styles.xml")).toContain('numFmtId="4"');
    expect(kontolinjer(1).size).toBe(nettoSaldi(opgave.saldi).size);
  });

  it("indeholder alle 20 bilagstekster med facit", () => {
    const r = rækker(2);
    const alleTekster = r.flatMap((x) => x.tekster);
    for (const b of opgave.bilag) {
      expect(alleTekster).toContain(b.tekst);
      expect(alleTekster).toContain(`Bilag ${b.nummer}`);
    }
    const alleTal = r.flatMap((x) => x.tal);
    const facit = opgave.bilag.flatMap((b) => b.facit.map((l) => l.oere / 100));
    expect(alleTal.sort()).toEqual(facit.sort());
  });

  it("indeholder saldobalancen efter sidste bilag, og debet er lig kredit", () => {
    const xml = tekst("xl/worksheets/sheet3.xml");
    let debet = 0;
    let kredit = 0;
    for (const [konto, netto] of nettoEfterSidsteBilag(opgave)) {
      if (netto === 0) {
        expect(xml).not.toContain(`<v>${konto}</v>`);
        continue;
      }
      expect(xml).toContain(`<v>${konto}</v>`);
      if (netto > 0) debet += netto;
      else kredit -= netto;
    }
    expect(debet).toBe(kredit);
    expect(xml).toContain(`<v>${(debet / 100).toFixed(2)}</v>`);
  });

  it("indeholder ingen nøgletal", () => {
    const alt = [1, 2, 3].map((n) => tekst(`xl/worksheets/sheet${n}.xml`)).join("");
    expect(alt).not.toMatch(/nøgletal|ramme|i % af/i);
  });
});
