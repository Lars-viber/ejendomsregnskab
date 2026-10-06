// @vitest-environment node
import { bankdageIMaaned, erBankdag, foersteBankdagIOktober, sidsteBankdagIDecember } from "../src/domain/bankdage";

describe("bankdage (8.1)", () => {
  it("udelukker weekender, 24., 25., 26. og 31. december", () => {
    expect(erBankdag("2026-10-10")).toBe(false); // lørdag
    expect(erBankdag("2026-10-11")).toBe(false); // søndag
    expect(erBankdag("2026-10-12")).toBe(true); // mandag
    for (const dag of ["24", "25", "26", "31"]) expect(erBankdag(`2025-12-${dag}`)).toBe(false);
    expect(erBankdag("2025-12-23")).toBe(true); // tirsdag
  });

  it("kender de bevægelige helligdage", () => {
    expect(erBankdag("2026-04-03")).toBe(false); // langfredag 2026
    expect(erBankdag("2026-05-14")).toBe(false); // Kristi himmelfartsdag 2026
    expect(erBankdag("2026-06-05")).toBe(false); // grundlovsdag
  });

  it("finder første bankdag i oktober og sidste bankdag i december", () => {
    expect(foersteBankdagIOktober(2026)).toBe("2026-10-01"); // torsdag
    expect(foersteBankdagIOktober(2027)).toBe("2027-10-01"); // fredag
    expect(foersteBankdagIOktober(2028)).toBe("2028-10-02"); // 1. oktober 2028 er en søndag
    expect(sidsteBankdagIDecember(2026)).toBe("2026-12-30"); // onsdag
    expect(sidsteBankdagIDecember(2028)).toBe("2028-12-29"); // fredag (30. er lørdag)
  });

  it("har kun bankdage i listen for hver måned i 4. kvartal", () => {
    for (let aar = 2026; aar <= 2040; aar++) {
      for (const maaned of [10, 11, 12]) {
        const dage = bankdageIMaaned(aar, maaned);
        expect(dage.length).toBeGreaterThanOrEqual(16);
        expect(dage.every(erBankdag)).toBe(true);
      }
    }
  });
});
