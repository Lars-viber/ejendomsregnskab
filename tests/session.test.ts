import { danVariant } from "../src/domain/variant";
import { GENERATOR_VERSION } from "../src/generator/generator";
import {
  SESSION_NOEGLE,
  gemSession,
  huskVariant,
  indlaesSession,
  nySession,
  rensSession,
  senesteVarianter,
  sletSession,
} from "../src/session/session";

describe("gemning af fremskridt (Reference.docx afsnit 4)", () => {
  const variant = danVariant("delvis", 483915);

  it("gemmer og indlæser en session uændret", () => {
    const session = {
      ...nySession(variant, 2026),
      posteringer: [{ id: "p1", bilag: 1, konto: 20004, side: "debet" as const, udtryk: "100", oere: 10_000 }],
      godkendte: [1],
      vistBilag: 2,
    };
    gemSession(session);
    expect(indlaesSession()).toEqual(session);
  });

  it("låser årstallet i sessionen (8.1)", () => {
    gemSession(nySession(variant, 2026));
    expect(indlaesSession()?.aar).toBe(2026);
  });

  it("kasserer ødelagte eller forældede data", () => {
    localStorage.setItem(SESSION_NOEGLE, "{ikke json");
    expect(indlaesSession()).toBeNull();
    expect(localStorage.getItem(SESSION_NOEGLE)).toBeNull();

    gemSession({ ...nySession(variant, 2026), generatorversion: GENERATOR_VERSION + 1 });
    expect(indlaesSession()).toBeNull();

    gemSession({ ...nySession(variant, 2026), variant: "9999999" });
    expect(indlaesSession()).toBeNull();
  });

  it("retter huller i de godkendte bilag og et ugyldigt vist bilag", () => {
    const renset = rensSession({ ...nySession(variant, 2026), godkendte: [1, 2, 4], vistBilag: 9, nyligtGodkendt: 4 });
    expect(renset?.godkendte).toEqual([1, 2]);
    expect(renset?.vistBilag).toBe(3);
    expect(renset?.nyligtGodkendt).toBeNull();
  });

  it("fjerner posteringer på bilag, som endnu ikke kan nås", () => {
    const renset = rensSession({
      ...nySession(variant, 2026),
      posteringer: [
        { id: "p1", bilag: 1, konto: 20004, side: "debet", udtryk: "1", oere: 100 },
        { id: "p2", bilag: 5, konto: 20004, side: "debet", udtryk: "1", oere: 100 },
      ],
    });
    expect(renset?.posteringer.map((p) => p.id)).toEqual(["p1"]);
  });

  it("sletter sessionen", () => {
    gemSession(nySession(variant, 2026));
    sletSession();
    expect(indlaesSession()).toBeNull();
  });

  it("husker de senest brugte variantnumre", () => {
    huskVariant("1000001");
    huskVariant("2000002");
    huskVariant("1000001");
    expect(senesteVarianter()).toEqual(["2000002", "1000001"]);
  });
});
