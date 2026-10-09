// @vitest-environment node
import { KLASSIFIKATION, TOILET_OG_OMKLAEDNING } from "../src/domain/klassifikation";
import { KONTOPLAN } from "../src/domain/kontoplan";

/**
 * Den godkendte klassifikationsliste (Reference.docx 8.2, 8.3, 9.1 og 9.2, version 1.4).
 * Hver beskrivelse kontrolleres for sig, så også sjældent valgte indholdslinjer er dækket.
 */
const BOLIGORD = /bolig|lejlighed/i;
const ERHVERVSORD = /erhverv|kontor|butik/i;
const HELEORD = /ejendomme|fælles/i;
const BEBOELSESORD = /bolig|lejlighed|beboe|badeværelse|vaskeri|altan/i;

describe("klassifikationslisten", () => {
  it("dækker præcis kontoplanens momsbelagte indholdslinjer", () => {
    const iKontoplan = KONTOPLAN.flatMap((k) =>
      k.indhold.filter((l) => l.inklusiveMoms === true).map((l) => `${k.nummer}|${l.tekst}`),
    ).sort();
    expect(KLASSIFIKATION.map((k) => `${k.konto}|${k.indhold}`).sort()).toEqual(iKontoplan);
  });

  // Lejeindtægter og forbedringer har egne tekster i generatoren.
  const fakturalinjer = KLASSIFIKATION.filter((k) => k.konto !== 1000 && k.konto !== 20000);

  it.each(fakturalinjer.map((k) => [k.indhold, k] as const))("%s", (_, k) => {
    // Mindst én del ved delvis moms og en beskrivelse ved både momsfri og momspligtig ejendom.
    expect(Boolean(k.bolig || k.erhverv || k.hele)).toBe(true);
    expect(k.momsfri).not.toBeNull();
    expect(k.momspligtig).not.toBeNull();

    // Indholdsteksten indgår ordret (8.3), undtagen badeværelser uden for boliger (8.2).
    for (const [anvendelse, tekst] of Object.entries({ momsfri: k.momsfri, momspligtig: k.momspligtig, bolig: k.bolig, erhverv: k.erhverv, hele: k.hele })) {
      if (!tekst) continue;
      const alias = k.indhold === "Reparation af badeværelser" && (anvendelse === "momspligtig" || anvendelse === "erhverv");
      if (alias) expect(tekst.startsWith(TOILET_OG_OMKLAEDNING)).toBe(true);
      else expect(tekst.toLowerCase()).toContain(k.indhold.toLowerCase());
    }

    // 9.1: ren erhvervsejendom uden beboelse; ren boligejendom uden erhverv.
    expect(k.momspligtig).not.toMatch(BEBOELSESORD);
    expect(k.momsfri).not.toMatch(/erhverv/i);

    // 8.3 og 9.2: delen nævnes direkte.
    if (k.bolig) {
      expect(k.bolig).toMatch(BOLIGORD);
      expect(k.bolig).not.toMatch(ERHVERVSORD);
    }
    if (k.erhverv) {
      expect(k.erhverv).toMatch(ERHVERVSORD);
      expect(k.erhverv).not.toMatch(BOLIGORD);
      expect(k.erhverv).not.toMatch(/badeværelse/i);
    }
    if (k.hele) {
      expect(k.hele).toMatch(HELEORD);
      expect(k.hele).not.toMatch(BOLIGORD);
      expect(k.hele).not.toMatch(ERHVERVSORD);
    }
  });

  it("følger projektejerens godkendelse 9. oktober 2026", () => {
    const find = (indhold: string) => KLASSIFIKATION.find((k) => k.indhold === indhold)!;
    for (const indhold of ["Trappevask", "Ejendomsservice af grønne områder", "Facadereparationer, vedligeholdelse", "Elevatorservice", "Service på porttelefon"]) {
      const k = find(indhold);
      expect([k.bolig, k.erhverv, k.hele].every((x) => x !== null)).toBe(true);
    }
    expect(find("Reparation af hårde hvidevarer").erhverv).toMatch(/tekøkken|frokoststue/);
    expect(find("Reparation af køkkeninventar").erhverv).toMatch(/tekøkken|frokoststue/);
    expect(find("Reparation af badeværelser").bolig).toMatch(/badeværelser/);
    expect(find("Reparation af badeværelser").erhverv).toMatch(/toilet- og omklædningsfaciliteter/);
    expect(find("Mæglerhonorar ved udlejning").bolig).toMatch(/lejlighed/);
  });
});
