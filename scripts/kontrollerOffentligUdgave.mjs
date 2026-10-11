/**
 * Kontrollerer den byggede, offentlige udgave (mappen dist) – kørsel: pnpm kontroller-offentlig
 *
 * Den offentlige udgave må ikke indeholde de midlertidige testknapper eller anden testkode,
 * og den må kun bestå af selve applikationen. Programmet stopper med en fejl, hvis noget
 * forkert findes, så GitHub ikke offentliggør udgaven.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Mappen kan angives som argument (bruges til en modprøve); ellers kontrolleres dist.
const DIST = process.argv[2] ?? fileURLToPath(new URL("../dist/", import.meta.url));

/** Tekster, der kun findes i testknapperne og testkoden. */
const FORBUDT = [
  "Test: til saldiopgørelse",
  "Test: udfyld saldi",
  "Kun lokal test",
  "knap-test",
  "#ffe7a8", // testknappernes gule farve
  "vitest",
  "testing-library",
  "laesBilag", // den uafhængige "læser" bruges kun i testene
  "import.meta.env",
  "sourceMappingURL",
];

/** Filtyper, som applikationen består af. */
const TILLADT = /\.(html|js|css|svg|png|ico|woff2?)$/;

function filer(mappe) {
  return readdirSync(mappe).flatMap((navn) => {
    const sti = join(mappe, navn);
    return statSync(sti).isDirectory() ? filer(sti) : [sti];
  });
}

const fund = [];
const alle = filer(DIST);
for (const fil of alle) {
  const navn = relative(DIST, fil).replace(/\\/g, "/");
  if (!TILLADT.test(navn)) fund.push(`${navn}: filen hører ikke til applikationen`);
  // Kildetekst kan være skrevet med \uXXXX-koder i den byggede fil; de afkodes før søgningen.
  const indhold = readFileSync(fil, "utf8").replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  for (const tekst of FORBUDT) if (indhold.includes(tekst)) fund.push(`${navn}: indeholder "${tekst}"`);
}

console.log(`Kontrolleret ${alle.length} filer i den offentlige udgave:`);
for (const fil of alle) console.log(`  ${relative(DIST, fil).replace(/\\/g, "/")}`);
if (fund.length > 0) {
  console.error(`\nFEJL – den offentlige udgave indeholder testkode:\n  ${fund.join("\n  ")}`);
  process.exit(1);
}
console.log(`\nOK – ingen testknapper eller testkode fundet (søgt efter ${FORBUDT.length} kendetegn).`);
