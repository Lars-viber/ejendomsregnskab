/**
 * Danner en selvstændig HTML-fil til faglig gennemgang af genererede opgaver.
 * Filen kan åbnes ved dobbeltklik; den bruger ingen eksterne filer.
 */
import { formaterBeloeb } from "../src/domain/beloeb";
import { KONTOPLAN } from "../src/domain/kontoplan";
import { MOMSSTATUS_BESKRIVELSE } from "../src/domain/momsstatus";
import { bogfoerFacit, formaterDato, nettoSaldi, type FacitLinje, type Opgave } from "../src/domain/opgave";

const NAVN = new Map(KONTOPLAN.map((k) => [k.nummer, k.navn]));

const esc = (tekst: string) =>
  tekst.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kr = (oere: number) => formaterBeloeb(oere);
const pct = (x: number) => `${(x * 100).toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

function kontotabel(raekker: { konto: number; debet: number; kredit: number }[], titel: string): string {
  const sumD = raekker.reduce((s, r) => s + r.debet, 0);
  const sumK = raekker.reduce((s, r) => s + r.kredit, 0);
  return `
    <table class="konti">
      <caption>${esc(titel)}</caption>
      <thead><tr><th>Konto</th><th>Kontonavn</th><th class="tal">Debet</th><th class="tal">Kredit</th></tr></thead>
      <tbody>
        ${raekker
          .map(
            (r) =>
              `<tr><td>${r.konto}</td><td>${esc(NAVN.get(r.konto) ?? "")}</td><td class="tal">${r.debet ? kr(r.debet) : ""}</td><td class="tal">${r.kredit ? kr(r.kredit) : ""}</td></tr>`,
          )
          .join("")}
      </tbody>
      <tfoot><tr><td></td><td>I alt</td><td class="tal">${kr(sumD)}</td><td class="tal">${kr(sumK)}</td></tr></tfoot>
    </table>`;
}

function saldoRaekker(netto: Map<number, number>) {
  return [...netto]
    .filter(([, v]) => v !== 0)
    .sort((a, b) => a[0] - b[0])
    .map(([konto, v]) => ({ konto, debet: v > 0 ? v : 0, kredit: v < 0 ? -v : 0 }));
}

function facitRaekker(facit: FacitLinje[]) {
  return facit.map((l) => ({ konto: l.konto, debet: l.side === "debet" ? l.oere : 0, kredit: l.side === "kredit" ? l.oere : 0 }));
}

function opgaveHtml(opgave: Opgave, nr: number): string {
  const start = nettoSaldi(opgave.saldi);
  const slut = new Map(start);
  for (const b of opgave.bilag) bogfoerFacit(slut, b.facit);
  const g = (m: Map<number, number>, k: number) => m.get(k) ?? 0;

  const leje = -(g(slut, 1000) + g(slut, 1001));
  const resultatFoerSkat = -KONTOPLAN.filter((k) => k.kategori !== "Aktiver" && k.kategori !== "Passiver" && k.nummer !== 9000).reduce(
    (s, k) => s + g(slut, k.nummer),
    0,
  );
  const noegletal: [string, string][] = [
    ["Lejeindtægter ekskl. moms (saldo efter sidste bilag)", `${kr(leje)} kr.`],
    ["Lejeindtægter i % af Investeringsejendomme (20000) – ramme 5–8 %", pct(leje / g(slut, 20000))],
    ["4000 + 4001 + 5000 i % af lejeindtægter – ramme 10–12 %", pct((g(slut, 4000) + g(slut, 4001) + g(slut, 5000)) / leje)],
    ["7000 i % af lejeindtægter – ramme 30–40 %", pct(g(slut, 7000) / leje)],
    ["Årets resultat før skat", `${kr(resultatFoerSkat)} kr.`],
    ["Selskabsskat (9000) – skal være 22 % af resultat før skat", `${kr(g(slut, 9000))} kr. (${pct(g(slut, 9000) / resultatFoerSkat)})`],
    ["Årets resultat efter skat", `${kr(resultatFoerSkat - g(slut, 9000))} kr.`],
  ];
  if (opgave.momsfradragsprocent !== null) {
    const momspligtig = -g(slut, 1000);
    noegletal.push([
      "Momsfradragsprocent: momspligtig leje / samlet leje, rundet op",
      `${pct(momspligtig / leje)} → ${Math.ceil((100 * momspligtig) / leje - 1e-9)} % (opgaven bruger ${opgave.momsfradragsprocent} %)`,
    ]);
  }

  return `
  <section class="opgave" id="opgave${nr}">
    <h2>Opgave ${nr}: ${esc(MOMSSTATUS_BESKRIVELSE[opgave.variant.momsstatus])} – variantnummer ${opgave.variant.nummer}</h2>
    <p class="info">Årstal ${opgave.aar}${opgave.momsfradragsprocent !== null ? ` · momsfradragsprocent ${opgave.momsfradragsprocent} %` : ""} · generatorversion ${opgave.generatorversion}</p>
    <table class="noegletal"><caption>Nøgletal til kontrol</caption><tbody>
      ${noegletal.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="tal">${esc(b)}</td></tr>`).join("")}
    </tbody></table>
    ${kontotabel(saldoRaekker(start), "Saldi ved opgavens start")}
    <h3>Bilag og facit</h3>
    ${opgave.bilag
      .map(
        (b) => `
      <div class="bilag">
        <h4>Bilag ${b.nummer} · ${esc(formaterDato(b.dato))}</h4>
        <p class="bilagstekst">${esc(b.tekst)}</p>
        ${kontotabel(facitRaekker(b.facit), `Facit for bilag ${b.nummer}`)}
      </div>`,
      )
      .join("")}
    ${kontotabel(saldoRaekker(slut), "Saldi efter sidste bilag")}
  </section>`;
}

export function danGennemgangHtml(opgaver: Opgave[], dannet: string): string {
  return `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gennemgang af opgaver</title>
<style>
  :root { --blaa: #0050a4; --lysblaa: #dcebfa; --baggrund: #f4f8fd; --tekst: #172b3a; --daempet: #526b7f; --kant: #c9d9ea; }
  body { margin: 0; padding: 24px; font: 14px/1.45 "Segoe UI", system-ui, sans-serif; color: var(--tekst); background: var(--baggrund); }
  main { max-width: 980px; margin: 0 auto; }
  h1 { margin: 0 0 4px; color: var(--blaa); font-size: 1.5rem; }
  h2 { margin: 0 0 4px; color: var(--blaa); font-size: 1.25rem; }
  h3 { margin: 18px 0 8px; font-size: 1.05rem; }
  h4 { margin: 0 0 4px; font-size: 1rem; }
  .info, .forklaring { color: var(--daempet); margin: 0 0 12px; }
  nav { background: #fff; border: 1px solid var(--kant); border-radius: 8px; padding: 10px 16px; margin: 12px 0 20px; }
  nav ol { margin: 6px 0 0; padding-left: 22px; columns: 3; }
  .opgave { background: #fff; border: 1px solid var(--kant); border-radius: 10px; padding: 18px 20px; margin-bottom: 28px; }
  .bilag { border-top: 1px solid var(--kant); padding: 10px 0 4px; }
  .bilagstekst { margin: 0 0 8px; padding: 6px 10px; background: var(--baggrund); border-left: 4px solid var(--blaa); }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 14px; font-variant-numeric: tabular-nums; }
  caption { text-align: left; font-weight: 700; padding: 4px 0; }
  th, td { padding: 3px 8px; border-bottom: 1px solid #e3ebf3; text-align: left; vertical-align: top; }
  th { background: var(--lysblaa); }
  td.tal, th.tal { text-align: right; white-space: nowrap; }
  td:first-child { width: 70px; }
  .konti td:nth-child(3), .konti td:nth-child(4) { width: 140px; }
  tfoot td { font-weight: 700; border-top: 2px solid var(--tekst); }
  .noegletal td:first-child { width: auto; }
  @media print { body { background: #fff; padding: 0; } .opgave { break-before: page; border: 0; } nav { display: none; } }
</style>
</head>
<body>
<main>
  <h1>Gennemgang af opgaver – faglig kontrol</h1>
  <p class="info">Dannet ${esc(dannet)} med generatorversion ${opgaver[0]?.generatorversion ?? ""}. Filen ligger kun på denne computer og offentliggøres ikke.</p>
  <p class="forklaring">For hver opgave vises variantnummeret, alle saldi ved opgavens start, de 20 bilagstekster præcis som den studerende ser dem, facit for hvert bilag og saldiene efter sidste bilag. Øverst i hver opgave står nøgletal, så reglerne i Reference.docx afsnit 9 og 10 hurtigt kan efterprøves. Alle opgaver har bestået den automatiske regelkontrol.</p>
  <nav><strong>Indhold</strong><ol>
    ${opgaver.map((o, i) => `<li><a href="#opgave${i + 1}">${esc(MOMSSTATUS_BESKRIVELSE[o.variant.momsstatus])} – ${o.variant.nummer}</a></li>`).join("")}
  </ol></nav>
  ${opgaver.map((o, i) => opgaveHtml(o, i + 1)).join("")}
</main>
</body>
</html>
`;
}
