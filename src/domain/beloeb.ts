/**
 * Beløb regnes internt i hele øre (heltal), så der aldrig opstår afrundingsfejl.
 * Visning og indtastning følger Reference.docx afsnit 6.4.
 */

const FORMAT = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formaterer øre som beløb med tusindtalsseparator og decimalkomma, f.eks. 12.345,67. */
export function formaterBeloeb(oere: number): string {
  // Intl bruger et særligt minustegn; et almindeligt bindestreg-minus er lettere at læse og teste.
  return FORMAT.format(oere / 100).replace(/−/g, "-");
}

export type BeloebResultat = { ok: true; oere: number } | { ok: false; fejl: string };

const FEJL_TAL = 'Skriv et beløb, f.eks. 12.345,67, eller et regneudtryk, der starter med "=".';
const FEJL_UDTRYK = "Regneudtrykket kan ikke beregnes. Brug tal, + - * / og parenteser.";

/**
 * Fortolker ét tal skrevet på dansk: komma er decimaltegn, punktum er tusindtalsseparator.
 * Som i reference-applikationen accepteres også punktum som decimaltegn, når tallet
 * ikke ligner et tal med tusindtalsseparatorer (f.eks. 12.5).
 */
function fortolkTal(tekst: string): number {
  if (!/^[0-9.,]+$/.test(tekst) || !/[0-9]/.test(tekst)) return Number.NaN;
  if (tekst.includes(",")) {
    if ((tekst.match(/,/g) ?? []).length > 1) return Number.NaN;
    const [heltal, decimaler] = tekst.split(",");
    if (heltal.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(heltal)) return Number.NaN;
    if (decimaler.includes(".")) return Number.NaN;
    return Number(`${heltal.replace(/\./g, "") || "0"}.${decimaler || "0"}`);
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(tekst)) return Number(tekst.replace(/\./g, ""));
  if ((tekst.match(/\./g) ?? []).length > 1) return Number.NaN;
  return Number(tekst);
}

type Token = { type: "tal"; vaerdi: number } | { type: "tegn"; vaerdi: string };

function delOpITokens(udtryk: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < udtryk.length) {
    const tegn = udtryk[i];
    if ("+-*/()".includes(tegn)) {
      tokens.push({ type: "tegn", vaerdi: tegn });
      i += 1;
      continue;
    }
    if (!/[0-9.,]/.test(tegn)) return null;
    let slut = i + 1;
    while (slut < udtryk.length && /[0-9.,]/.test(udtryk[slut])) slut += 1;
    const vaerdi = fortolkTal(udtryk.slice(i, slut));
    if (!Number.isFinite(vaerdi)) return null;
    tokens.push({ type: "tal", vaerdi });
    i = slut;
  }
  return tokens;
}

/** Lille regnemaskine for + - * / og parenteser med almindelig regnearternes hierarki (ingen eval). */
function beregn(tokens: Token[]): number {
  let pos = 0;
  const erTegn = (t: string) => tokens[pos]?.type === "tegn" && tokens[pos].vaerdi === t;

  const udtryk = (): number => {
    let vaerdi = led();
    while (erTegn("+") || erTegn("-")) {
      const tegn = tokens[pos++].vaerdi;
      const naeste = led();
      vaerdi = tegn === "+" ? vaerdi + naeste : vaerdi - naeste;
    }
    return vaerdi;
  };

  const led = (): number => {
    let vaerdi = faktor();
    while (erTegn("*") || erTegn("/")) {
      const tegn = tokens[pos++].vaerdi;
      const naeste = faktor();
      if (tegn === "/" && naeste === 0) throw new Error("Division med nul");
      vaerdi = tegn === "*" ? vaerdi * naeste : vaerdi / naeste;
    }
    return vaerdi;
  };

  const faktor = (): number => {
    if (erTegn("+")) {
      pos++;
      return faktor();
    }
    if (erTegn("-")) {
      pos++;
      return -faktor();
    }
    if (erTegn("(")) {
      pos++;
      const vaerdi = udtryk();
      if (!erTegn(")")) throw new Error("Manglende parentes");
      pos++;
      return vaerdi;
    }
    const token = tokens[pos];
    if (!token || token.type !== "tal") throw new Error("Forventede et tal");
    pos++;
    return token.vaerdi;
  };

  const resultat = udtryk();
  if (pos !== tokens.length) throw new Error("Ugyldigt udtryk");
  return resultat;
}

function tilOere(vaerdi: number): number {
  // Afrunder til nærmeste øre; toFixed fjerner små kommatalsfejl fra beregningen (f.eks. 0,1 + 0,2).
  return Math.round(Number((vaerdi * 100).toFixed(6)));
}

/**
 * Fortolker en indtastning i en T-konto:
 * - et beløb, f.eks. "12345,67", "12.345,67" eller "12345"
 * - et regneudtryk, der starter med "=", f.eks. "=1000*1,25" eller "=(4.000+250)/2"
 */
export function fortolkBeloeb(indtastet: string): BeloebResultat {
  const tekst = indtastet.trim().replace(/\s/g, "");
  if (tekst === "") return { ok: false, fejl: "Skriv et beløb." };

  let vaerdi: number;
  if (tekst.startsWith("=")) {
    const tokens = delOpITokens(tekst.slice(1));
    if (!tokens || tokens.length === 0) return { ok: false, fejl: FEJL_UDTRYK };
    try {
      vaerdi = beregn(tokens);
    } catch {
      return { ok: false, fejl: FEJL_UDTRYK };
    }
  } else {
    vaerdi = fortolkTal(tekst);
    if (!Number.isFinite(vaerdi)) {
      return {
        ok: false,
        fejl: /[+*/()-]/.test(tekst) ? 'Et regneudtryk skal starte med "=", f.eks. =1000*1,25.' : FEJL_TAL,
      };
    }
  }

  if (!Number.isFinite(vaerdi)) return { ok: false, fejl: FEJL_UDTRYK };
  const oere = tilOere(vaerdi);
  if (oere <= 0) return { ok: false, fejl: "Beløbet skal være større end 0." };
  return { ok: true, oere };
}
