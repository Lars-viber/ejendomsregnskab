// @vitest-environment node
import { formaterBeloeb, fortolkBeloeb } from "../src/domain/beloeb";

const oere = (tekst: string) => {
  const resultat = fortolkBeloeb(tekst);
  return resultat.ok ? resultat.oere : resultat.fejl;
};

describe("formatering af beløb (6.4)", () => {
  it("bruger tusindtalsseparator og decimalkomma", () => {
    expect(formaterBeloeb(1_234_567)).toBe("12.345,67");
    expect(formaterBeloeb(1_025_000_000)).toBe("10.250.000,00");
    expect(formaterBeloeb(5)).toBe("0,05");
    expect(formaterBeloeb(100)).toBe("1,00");
  });
});

describe("indtastning af beløb (6.4)", () => {
  it("forstår direkte indtastede beløb", () => {
    expect(oere("12345,67")).toBe(1_234_567);
    expect(oere("12.345,67")).toBe(1_234_567);
    expect(oere("12345")).toBe(1_234_500);
    expect(oere("12.345")).toBe(1_234_500);
    expect(oere("1.234.567")).toBe(123_456_700);
    expect(oere(" 250 ")).toBe(25_000);
    expect(oere("0,5")).toBe(50);
    expect(oere(",5")).toBe(50);
  });

  it("beregner regneudtryk, der starter med =", () => {
    expect(oere("=1000*1,25")).toBe(125_000);
    expect(oere("=1.000*1,25")).toBe(125_000);
    expect(oere("=120000/1,25")).toBe(9_600_000);
    expect(oere("=(4000+250)/2")).toBe(212_500);
    expect(oere("=100-20-30")).toBe(5_000);
    expect(oere("=2+3*4")).toBe(1_400);
    expect(oere("=(2+3)*4")).toBe(2_000);
    expect(oere("= 0,1 + 0,2")).toBe(30);
    expect(oere("=-5+10")).toBe(500);
    expect(oere("=4000*0,25*54/100")).toBe(54_000);
  });

  it("afrunder til hele øre", () => {
    expect(oere("=10/3")).toBe(333);
    expect(oere("=20/3")).toBe(667);
    expect(oere("12,345")).toBe(1_235);
  });

  it("afviser ugyldige indtastninger med en dansk fejlbesked", () => {
    expect(oere("")).toBe("Skriv et beløb.");
    expect(oere("abc")).toMatch(/Skriv et beløb/);
    expect(oere("1000*1,25")).toBe('Et regneudtryk skal starte med "=", f.eks. =1000*1,25.');
    expect(oere("=")).toMatch(/kan ikke beregnes/);
    expect(oere("=(1+2")).toMatch(/kan ikke beregnes/);
    expect(oere("=1+")).toMatch(/kan ikke beregnes/);
    expect(oere("=5/0")).toMatch(/kan ikke beregnes/);
    expect(oere("=2^3")).toMatch(/kan ikke beregnes/);
    expect(oere("=alert(1)")).toMatch(/kan ikke beregnes/);
    expect(oere("1,2,3")).toMatch(/Skriv et beløb/);
    expect(oere("12.34.5")).toMatch(/Skriv et beløb/);
  });

  it("afviser beløb, der ikke er større end 0", () => {
    expect(oere("0")).toBe("Beløbet skal være større end 0.");
    expect(oere("=5-10")).toBe("Beløbet skal være større end 0.");
    expect(oere("0,001")).toBe("Beløbet skal være større end 0.");
  });
});
