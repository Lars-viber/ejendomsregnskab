// @vitest-environment node
import { aktueltBilag, kanBogfoerePaa, kanVaelgeBilag, naesteBilag } from "../src/domain/fremdrift";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";

const opgave = danOpgave(danVariant("momsfri", 1), 2026); // bilag 1–20

describe("navigation mellem bilag (5 og 7.2)", () => {
  it("starter på bilag 1, og kun bilag 1 kan vælges", () => {
    expect(aktueltBilag(opgave, [])).toBe(1);
    expect([1, 2, 3, 4, 20].map((n) => kanVaelgeBilag(opgave, [], n))).toEqual([true, false, false, false, false]);
    expect(kanBogfoerePaa(opgave, [], 1)).toBe(true);
    expect(naesteBilag(opgave, [], 1)).toBeNull();
  });

  it("giver adgang til næste bilag først, når det aktuelle bilag er godkendt", () => {
    expect(aktueltBilag(opgave, [1])).toBe(2);
    expect(naesteBilag(opgave, [1], 1)).toBe(2);
    expect([1, 2, 3].map((n) => kanVaelgeBilag(opgave, [1], n))).toEqual([true, true, false]);
  });

  it("tillader kun visning af tidligere, godkendte bilag", () => {
    const godkendte = [1, 2, 3];
    expect(kanVaelgeBilag(opgave, godkendte, 2)).toBe(true);
    expect(kanBogfoerePaa(opgave, godkendte, 2)).toBe(false);
    expect(kanBogfoerePaa(opgave, godkendte, 4)).toBe(true);
    expect(naesteBilag(opgave, godkendte, 2)).toBe(3);
    expect(naesteBilag(opgave, godkendte, 4)).toBeNull();
    expect(kanVaelgeBilag(opgave, godkendte, 5)).toBe(false);
  });

  it("gør alle bilag tilgængelige, når alle er godkendt", () => {
    const alle = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(aktueltBilag(opgave, alle)).toBeNull();
    expect(alle.every((n) => kanVaelgeBilag(opgave, alle, n))).toBe(true);
    expect(alle.some((n) => kanBogfoerePaa(opgave, alle, n))).toBe(false);
    expect(naesteBilag(opgave, alle, 20)).toBeNull();
  });

  it("afviser bilag, der ikke findes", () => {
    expect(kanVaelgeBilag(opgave, Array.from({ length: 20 }, (_, i) => i + 1), 21)).toBe(false);
  });
});
