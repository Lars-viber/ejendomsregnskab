/**
 * Skriver lokalt/klassifikation.html ud fra scripts/klassifikation.ts.
 * Køres med:  pnpm klassifikation
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { KONTOPLAN } from "../src/domain/kontoplan";
import { KLASSIFIKATION, type Klassifikation } from "./klassifikation";

const esc = (tekst: string) => tekst.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const NAVN = new Map(KONTOPLAN.map((k) => [k.nummer, k.navn]));

const momsbelagte = KONTOPLAN.flatMap((k) =>
  k.indhold.filter((l) => l.inklusiveMoms === true).map((l) => ({ konto: k.nummer, indhold: l.tekst })),
);

function statusser(k: Klassifikation): string {
  const s: string[] = [];
  if (k.momsfri) s.push("Momsfri");
  if (k.bolig || k.erhverv || k.hele) s.push("Delvis moms");
  if (k.momspligtig) s.push("Momspligtig");
  return s.map((x) => `<span class="maerke">${x}</span>`).join(" ");
}

const ja = (x: string | null) => (x ? `<span class="ja">✓</span>` : `<span class="nej">–</span>`);

function eksempler(k: Klassifikation): string {
  const linjer: [string, string | null][] = [
    ["Momsfri (boligejendom)", k.momsfri],
    ["Momspligtig (erhvervsejendom)", k.momspligtig],
    ["Delvis – boligdelen", k.bolig],
    ["Delvis – erhvervsdelen", k.erhverv],
    ["Delvis – hele ejendommen", k.hele],
  ];
  return `<dl>${linjer
    .map(([etiket, tekst]) => `<dt>${etiket}</dt><dd>${tekst ? `“${esc(tekst)}”` : `<span class="nej">bruges ikke</span>`}</dd>`)
    .join("")}</dl>`;
}

function raekke(k: Klassifikation, nr: number): string {
  return `
  <tr class="${k.tvivl ? "tvivl" : ""}">
    <td class="nr">${nr}</td>
    <td><strong>${k.konto}</strong> ${esc(NAVN.get(k.konto) ?? "")}<div class="indhold">${esc(k.indhold)}</div>${k.tvivl ? `<div class="tvivlmaerke">Tvivl</div>` : ""}</td>
    <td>${statusser(k)}</td>
    <td class="del">${ja(k.bolig)}</td>
    <td class="del">${ja(k.erhverv)}</td>
    <td class="del">${ja(k.hele)}</td>
    <td>${eksempler(k)}${k.tvivl ? `<p class="tvivltekst"><strong>Tvivl:</strong> ${esc(k.tvivl)}</p>` : ""}${k.note ? `<p class="note">${esc(k.note)}</p>` : ""}</td>
  </tr>`;
}

it("danner lokalt/klassifikation.html", () => {
  // Listen skal dække præcis kontoplanens momsbelagte indholdslinjer.
  const iListen = KLASSIFIKATION.map((k) => `${k.konto}|${k.indhold}`).sort();
  expect(iListen).toEqual(momsbelagte.map((l) => `${l.konto}|${l.indhold}`).sort());
  // Ved delvis moms skal hver omkostningslinje kunne vedrøre mindst én del, og ved hele ejendommen
  // må den ikke samtidig kunne opdeles (Reference.docx 9.2 – markeres som tvivl, hvis det sker).
  for (const k of KLASSIFIKATION) expect(Boolean(k.bolig || k.erhverv || k.hele)).toBe(true);

  const antalTvivl = KLASSIFIKATION.filter((k) => k.tvivl).length;
  const taelle = (felt: "bolig" | "erhverv" | "hele") => KLASSIFIKATION.filter((k) => k[felt]).length;
  const html = `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Klassifikationsliste – delvis moms</title>
<style>
  :root { --blaa: #0050a4; --lysblaa: #dcebfa; --baggrund: #f4f8fd; --tekst: #172b3a; --daempet: #526b7f; --kant: #c9d9ea;
          --groen: #278369; --gul: #fff6d6; --gulkant: #e0b84a; }
  body { margin: 0; padding: 24px; font: 14px/1.45 "Segoe UI", system-ui, sans-serif; color: var(--tekst); background: var(--baggrund); }
  main { max-width: 1280px; margin: 0 auto; }
  h1 { margin: 0 0 4px; color: var(--blaa); font-size: 1.5rem; }
  h2 { color: var(--blaa); font-size: 1.1rem; margin: 18px 0 6px; }
  .info { color: var(--daempet); margin: 0 0 12px; }
  .boks { background: #fff; border: 1px solid var(--kant); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
  .boks ul { margin: 6px 0 0; padding-left: 20px; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  thead th { position: sticky; top: 0; background: var(--lysblaa); text-align: left; padding: 6px 8px; border-bottom: 2px solid var(--blaa); }
  td { padding: 8px; border-bottom: 1px solid #e3ebf3; vertical-align: top; }
  td.nr { color: var(--daempet); width: 28px; }
  td.del { text-align: center; width: 70px; font-size: 1.1rem; }
  .indhold { font-style: italic; margin-top: 2px; }
  .maerke { display: inline-block; margin: 0 4px 4px 0; padding: 1px 8px; border-radius: 999px; background: var(--lysblaa); color: var(--blaa); font-size: 12px; font-weight: 600; white-space: nowrap; }
  .ja { color: var(--groen); font-weight: 700; }
  .nej { color: #9aa8b4; }
  dl { display: grid; grid-template-columns: 190px 1fr; gap: 2px 10px; margin: 0; }
  dt { color: var(--daempet); }
  dd { margin: 0; }
  tr.tvivl td { background: var(--gul); }
  .tvivlmaerke { display: inline-block; margin-top: 6px; padding: 1px 8px; border-radius: 4px; background: var(--gulkant); color: #4a3700; font-weight: 700; font-size: 12px; }
  .tvivltekst { margin: 8px 0 0; padding: 6px 8px; border-left: 4px solid var(--gulkant); background: #fffbea; }
  .note { margin: 6px 0 0; color: var(--daempet); }
  table.formuleringer td, table.formuleringer th { border-bottom: 1px solid #e3ebf3; padding: 4px 8px; }
  @media print { body { background: #fff; padding: 0; } thead th { position: static; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<main>
  <h1>Klassifikationsliste for momsbelagte indholdslinjer</h1>
  <p class="info">Forslag til projektejerens godkendelse efter Reference.docx version 1.3, afsnit 9.1 og 9.2. Dannet ${esc(
    new Date().toLocaleString("da-DK", { dateStyle: "long", timeStyle: "short" }),
  )}. Filen ligger kun på denne computer.</p>

  <div class="boks">
    <strong>Sådan læses listen</strong>
    <ul>
      <li>Listen indeholder alle ${KLASSIFIKATION.length} momsbelagte indholdslinjer i kontoplanen (kolonnen "Inklusive moms" = ja).</li>
      <li><strong>Må bruges ved</strong> viser de momsstatusser, hvor linjen kan indgå i et bilag. Reference.docx 8.2 tillader alle linjer ved alle momsstatusser; ved momspligtig ejendom må teksten dog aldrig nævne eller antyde beboelse (9.1).</li>
      <li><strong>Boligdel, Erhvervsdel og Hele ejendommen</strong> gælder kun delvis moms og viser, hvilke dele en faktura med linjen kan vedrøre (✓ = kan, – = kan ikke). Hele ejendommen bruges kun, når udgiften ikke naturligt kan opdeles (9.2).</li>
      <li><strong>Eksempler</strong> viser, hvordan bilagsteksten vil beskrive ydelsen. Indholdsteksten fra kontoplanen indgår ordret (8.3).</li>
      <li><span class="tvivlmaerke">Tvivl</span> Gule rækker er linjer, jeg er i tvivl om (${antalTvivl} i alt). Spørgsmålet står under eksemplerne.</li>
    </ul>
  </div>

  <div class="boks">
    <strong>Formuleringer ved delvis moms (Reference.docx 8.3)</strong>
    <table class="formuleringer">
      <tr><th>Boligdelen (${taelle("bolig")} linjer)</th><td>“Fakturaen vedrører ejendommens boliglejemål, som er momsfritaget. Der kan ikke afløftes moms.”</td></tr>
      <tr><th>Erhvervsdelen (${taelle("erhverv")} linjer)</th><td>“Fakturaen vedrører ejendommens momsregistrerede erhvervslejemål. Der kan afløftes fuld moms.”</td></tr>
      <tr><th>Hele ejendommen (${taelle("hele")} linjer)</th><td>“Fakturaen vedrører hele ejendommen. Der kan afløftes delvis moms med momsfradragsprocenten (xx %).”</td></tr>
    </table>
  </div>

  <h2>Indholdslinjerne</h2>
  <table>
    <thead><tr><th>#</th><th>Konto og indhold</th><th>Må bruges ved</th><th>Boligdel</th><th>Erhvervsdel</th><th>Hele ejendommen</th><th>Eksempler på bilagstekstens beskrivelse</th></tr></thead>
    <tbody>${KLASSIFIKATION.map((k, i) => raekke(k, i + 1)).join("")}</tbody>
  </table>
</main>
</body>
</html>
`;
  mkdirSync("lokalt", { recursive: true });
  writeFileSync("lokalt/klassifikation.html", html, "utf8");
});
