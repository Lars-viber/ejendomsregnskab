/**
 * Læser Kontoplan.xlsx uden eksterne biblioteker og omdanner den til den
 * struktur, der gemmes i src/data/kontoplan.json.
 *
 * Bruges kun lokalt (Kontoplan.xlsx er ikke i git). Selve applikationen og
 * byggeriet på GitHub læser aldrig Excel-filen.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

export interface KontoplanLinje {
  kontonummer: number;
  kategori: string;
  kontonavn: string;
  indhold: string;
  /** "ja" → true, "nej" → false, tom celle → null. */
  inklusiveMoms: boolean | null;
}

export interface KontoplanKonto {
  nummer: number;
  kategori: string;
  navn: string;
  indhold: { tekst: string; inklusiveMoms: boolean | null }[];
}

export interface KontoplanData {
  kilde: "Kontoplan.xlsx";
  konti: KontoplanKonto[];
}

const FORVENTEDE_KOLONNER = ["Konto nr.", "Kategori", "Kontonavn", "Indhold", "Inklusive moms"];

/** Udpakker alle filer i et zip-arkiv (xlsx er et zip-arkiv). */
export function udpakZip(buffer: Buffer): Map<string, Buffer> {
  const filer = new Map<string, Buffer>();
  let slut = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      slut = i;
      break;
    }
  }
  if (slut < 0) throw new Error("Kontoplan.xlsx er ikke en gyldig Excel-fil.");
  const antal = buffer.readUInt16LE(slut + 10);
  let pos = buffer.readUInt32LE(slut + 16);
  for (let n = 0; n < antal; n++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) throw new Error("Ugyldigt indhold i Kontoplan.xlsx.");
    const metode = buffer.readUInt16LE(pos + 10);
    const pakketStoerrelse = buffer.readUInt32LE(pos + 20);
    const navnLaengde = buffer.readUInt16LE(pos + 28);
    const ekstraLaengde = buffer.readUInt16LE(pos + 30);
    const kommentarLaengde = buffer.readUInt16LE(pos + 32);
    const lokalHoved = buffer.readUInt32LE(pos + 42);
    const navn = buffer.toString("utf8", pos + 46, pos + 46 + navnLaengde);
    const dataStart =
      lokalHoved + 30 + buffer.readUInt16LE(lokalHoved + 26) + buffer.readUInt16LE(lokalHoved + 28);
    const data = buffer.subarray(dataStart, dataStart + pakketStoerrelse);
    if (metode === 0) filer.set(navn, Buffer.from(data));
    else if (metode === 8) filer.set(navn, inflateRawSync(data));
    else throw new Error(`Ukendt komprimering i Kontoplan.xlsx (${navn}).`);
    pos += 46 + navnLaengde + ekstraLaengde + kommentarLaengde;
  }
  return filer;
}

function afkodXml(tekst: string): string {
  return tekst
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tekstIndhold(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => afkodXml(m[1])).join("");
}

function kolonneIndeks(reference: string): number {
  const bogstaver = reference.replace(/\d+/g, "");
  let indeks = 0;
  for (const tegn of bogstaver) indeks = indeks * 26 + (tegn.charCodeAt(0) - 64);
  return indeks - 1;
}

/** Returnerer første ark som rækker af tekstceller. */
export function laesArk(sti: string): string[][] {
  const filer = udpakZip(readFileSync(sti));
  const hent = (navn: string) => {
    const fil = filer.get(navn);
    if (!fil) throw new Error(`Kontoplan.xlsx mangler delen ${navn}.`);
    return fil.toString("utf8");
  };

  const delteTekster = filer.has("xl/sharedStrings.xml")
    ? [...hent("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => tekstIndhold(m[1]))
    : [];

  const foersteArkId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(hent("xl/workbook.xml"))?.[1];
  const relationer = hent("xl/_rels/workbook.xml.rels");
  const maal = [...relationer.matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => m[0])
    .find((rel) => rel.includes(`Id="${foersteArkId}"`))
    ?.match(/Target="([^"]+)"/)?.[1];
  if (!maal) throw new Error("Kontoplan.xlsx: første ark blev ikke fundet.");
  const arkSti = maal.startsWith("/") ? maal.slice(1) : `xl/${maal}`;

  const raekker: string[][] = [];
  for (const raekke of hent(arkSti).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const celler: string[] = [];
    for (const celle of raekke[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributter = celle[1];
      const indre = celle[2] ?? "";
      const reference = /\br="([A-Z]+\d+)"/.exec(attributter)?.[1];
      const type = /\bt="([^"]+)"/.exec(attributter)?.[1];
      const vaerdi = /<v>([\s\S]*?)<\/v>/.exec(indre)?.[1];
      let tekst = "";
      if (type === "s" && vaerdi !== undefined) tekst = delteTekster[Number(vaerdi)];
      else if (type === "inlineStr") tekst = tekstIndhold(indre);
      else if (vaerdi !== undefined) tekst = afkodXml(vaerdi);
      const indeks = reference ? kolonneIndeks(reference) : celler.length;
      celler[indeks] = tekst.trim();
    }
    raekker.push(Array.from(celler, (c) => c ?? ""));
  }
  return raekker;
}

/** Læser og kontrollerer kontoplanens linjer i Excel-filens rækkefølge. */
export function laesKontoplanLinjer(sti: string): KontoplanLinje[] {
  const [overskrift, ...raekker] = laesArk(sti);
  const kolonner = FORVENTEDE_KOLONNER.map((_, i) => overskrift?.[i] ?? "");
  if (kolonner.join("|") !== FORVENTEDE_KOLONNER.join("|")) {
    throw new Error(
      `Kontoplan.xlsx har ikke de forventede kolonner. Fandt: ${kolonner.join(", ")}`,
    );
  }
  return raekker
    .filter((raekke) => raekke.some((celle) => celle !== ""))
    .map((raekke, i) => {
      const [nr, kategori, kontonavn, indhold, moms = ""] = raekke;
      const kontonummer = Number(nr);
      const linjeNr = i + 2;
      if (!Number.isInteger(kontonummer) || kontonummer <= 0) {
        throw new Error(`Kontoplan.xlsx række ${linjeNr}: ugyldigt kontonummer "${nr}".`);
      }
      if (!kategori || !kontonavn || !indhold) {
        throw new Error(`Kontoplan.xlsx række ${linjeNr}: kategori, kontonavn og indhold skal udfyldes.`);
      }
      const momsTekst = moms.toLowerCase();
      if (!["ja", "nej", ""].includes(momsTekst)) {
        throw new Error(`Kontoplan.xlsx række ${linjeNr}: "Inklusive moms" skal være ja, nej eller tom.`);
      }
      return {
        kontonummer,
        kategori,
        kontonavn,
        indhold,
        inklusiveMoms: momsTekst === "" ? null : momsTekst === "ja",
      };
    });
}

/** Samler linjerne pr. konto, sorteret efter kontonummer (3.1: rækkefølgen i Excel er uden betydning). */
export function danKontoplanData(linjer: KontoplanLinje[]): KontoplanData {
  const konti = new Map<number, KontoplanKonto>();
  for (const linje of linjer) {
    const konto = konti.get(linje.kontonummer);
    if (!konto) {
      konti.set(linje.kontonummer, {
        nummer: linje.kontonummer,
        kategori: linje.kategori,
        navn: linje.kontonavn,
        indhold: [{ tekst: linje.indhold, inklusiveMoms: linje.inklusiveMoms }],
      });
      continue;
    }
    if (konto.kategori !== linje.kategori || konto.navn !== linje.kontonavn) {
      throw new Error(
        `Konto ${linje.kontonummer} har forskellig kategori eller kontonavn på flere linjer i Kontoplan.xlsx.`,
      );
    }
    konto.indhold.push({ tekst: linje.indhold, inklusiveMoms: linje.inklusiveMoms });
  }
  return {
    kilde: "Kontoplan.xlsx",
    konti: [...konti.values()].sort((a, b) => a.nummer - b.nummer),
  };
}

export function serialiserKontoplan(data: KontoplanData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
