/**
 * Bankdage (Reference.docx afsnit 8.1): ikke weekender, ikke helligdage og ikke 24. og 31. december.
 * Datoer skrives som ÅÅÅÅ-MM-DD og beregnes i UTC, så tidszoner ikke kan flytte en dato.
 */

function iso(aar: number, maaned: number, dag: number): string {
  return `${aar}-${String(maaned).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

function plusDage(aar: number, maaned: number, dag: number, antal: number): string {
  const d = new Date(Date.UTC(aar, maaned - 1, dag + antal));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Påskedag efter den gregorianske kalender (Gauss/Meeus). */
function paaskedag(aar: number): { maaned: number; dag: number } {
  const a = aar % 19;
  const b = Math.floor(aar / 100);
  const c = aar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maaned = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return { maaned, dag };
}

/** Danske helligdage og bankernes lukkedage i året. */
export function lukkedage(aar: number): Set<string> {
  const p = paaskedag(aar);
  const fraPaaske = (antal: number) => plusDage(aar, p.maaned, p.dag, antal);
  const dage = [
    iso(aar, 1, 1), // nytårsdag
    fraPaaske(-3), // skærtorsdag
    fraPaaske(-2), // langfredag
    fraPaaske(0), // påskedag
    fraPaaske(1), // 2. påskedag
    fraPaaske(39), // Kristi himmelfartsdag
    fraPaaske(40), // dagen efter Kristi himmelfartsdag (bankerne holder lukket)
    fraPaaske(49), // pinsedag
    fraPaaske(50), // 2. pinsedag
    iso(aar, 6, 5), // grundlovsdag
    iso(aar, 12, 24), // juleaftensdag (Reference.docx 8.1)
    iso(aar, 12, 25), // juledag
    iso(aar, 12, 26), // 2. juledag
    iso(aar, 12, 31), // nytårsaftensdag (Reference.docx 8.1)
  ];
  if (aar < 2024) dage.push(fraPaaske(26)); // store bededag (afskaffet fra 2024)
  return new Set(dage);
}

export function erBankdag(dato: string): boolean {
  const [aar, maaned, dag] = dato.split("-").map(Number);
  const ugedag = new Date(Date.UTC(aar, maaned - 1, dag)).getUTCDay();
  if (ugedag === 0 || ugedag === 6) return false;
  return !lukkedage(aar).has(dato);
}

/** Alle bankdage i en måned i stigende orden. */
export function bankdageIMaaned(aar: number, maaned: number): string[] {
  const antalDage = new Date(Date.UTC(aar, maaned, 0)).getUTCDate();
  const dage: string[] = [];
  for (let dag = 1; dag <= antalDage; dag++) {
    const dato = iso(aar, maaned, dag);
    if (erBankdag(dato)) dage.push(dato);
  }
  return dage;
}

export function sidsteBankdagIDecember(aar: number): string {
  const dage = bankdageIMaaned(aar, 12);
  return dage[dage.length - 1];
}

export function foersteBankdagIOktober(aar: number): string {
  return bankdageIMaaned(aar, 10)[0];
}
