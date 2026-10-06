// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KONTOPLAN, opgoerelse } from "../src/domain/kontoplan";
import { danKontoplanData, laesKontoplanLinjer, serialiserKontoplan } from "../scripts/kontoplanXlsx.ts";

const XLSX = fileURLToPath(new URL("../Kontoplan.xlsx", import.meta.url));
const JSON_FIL = fileURLToPath(new URL("../src/data/kontoplan.json", import.meta.url));
const xlsxFindes = existsSync(XLSX);

describe("kontoplan.json", () => {
  it("har entydige konti i stigende kontonummer", () => {
    const numre = KONTOPLAN.map((konto) => konto.nummer);
    expect(new Set(numre).size).toBe(numre.length);
    expect(numre).toEqual([...numre].sort((a, b) => a - b));
  });

  it("har mindst én indholdslinje på hver konto", () => {
    for (const konto of KONTOPLAN) expect(konto.indhold.length).toBeGreaterThan(0);
  });

  it("angiver ja/nej for moms på alle resultatkonti", () => {
    for (const konto of KONTOPLAN.filter((k) => opgoerelse(k) === "resultat")) {
      for (const linje of konto.indhold) expect(typeof linje.inklusiveMoms).toBe("boolean");
    }
  });

  it("indeholder alle konti, som Reference.docx henviser til", () => {
    const numre = new Set(KONTOPLAN.map((konto) => konto.nummer));
    const naevnt = [
      1000, 1001, 4000, 4001, 5000, 7000, 8000, 9000, 20000, 20001, 20002, 20003, 20004, 30000, 30001,
      30002, 30003, 30004, 30005, 30006, 30007,
    ];
    for (const nummer of naevnt) expect(numre.has(nummer)).toBe(true);
  });

  it("placerer indtægter og omkostninger i resultatopgørelsen og aktiver og passiver i balancen", () => {
    for (const konto of KONTOPLAN) {
      const forventet = konto.kategori === "Aktiver" || konto.kategori === "Passiver" ? "balance" : "resultat";
      expect(opgoerelse(konto)).toBe(forventet);
    }
  });
});

// Kontoplan.xlsx ligger kun på projektejerens computer og ikke på GitHub.
// Sammenligningen springes derfor over, når filen ikke findes.
describe.skipIf(!xlsxFindes)(
  `kontoplan.json sammenlignet med Kontoplan.xlsx${xlsxFindes ? "" : " (springes over: Kontoplan.xlsx findes ikke)"}`,
  () => {
    it("er nøjagtig den fil, scriptet danner ud fra Kontoplan.xlsx", () => {
      const forventet = serialiserKontoplan(danKontoplanData(laesKontoplanLinjer(XLSX)));
      expect(readFileSync(JSON_FIL, "utf8").replace(/\r\n/g, "\n")).toBe(forventet);
    });

    it("indeholder hver eneste linje i Kontoplan.xlsx og intet andet", () => {
      const fraExcel = laesKontoplanLinjer(XLSX)
        .map((l) => `${l.kontonummer}|${l.kategori}|${l.kontonavn}|${l.indhold}|${l.inklusiveMoms}`)
        .sort();
      const fraJson = KONTOPLAN.flatMap((konto) =>
        konto.indhold.map(
          (linje) => `${konto.nummer}|${konto.kategori}|${konto.navn}|${linje.tekst}|${linje.inklusiveMoms}`,
        ),
      ).sort();
      expect(fraJson).toEqual(fraExcel);
    });
  },
);
