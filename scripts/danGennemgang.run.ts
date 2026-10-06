/**
 * Skriver lokalt/gennemgang.html med 3 opgaver for hver momsstatus.
 * Køres med:  pnpm gennemgang
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { MOMSSTATUSSER } from "../src/domain/momsstatus";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";
import { kontrollerOpgave } from "../src/regler/regelkontrol";
import { danGennemgangHtml } from "./gennemgang";

const LOEBENUMRE = [104729, 482911, 777001];

it("danner lokalt/gennemgang.html", () => {
  const aar = new Date().getFullYear();
  const opgaver = MOMSSTATUSSER.flatMap((status) => LOEBENUMRE.map((n) => danOpgave(danVariant(status, n), aar)));
  for (const opgave of opgaver) expect(kontrollerOpgave(opgave)).toEqual([]);
  mkdirSync("lokalt", { recursive: true });
  const dannet = new Date().toLocaleString("da-DK", { dateStyle: "long", timeStyle: "short" });
  writeFileSync("lokalt/gennemgang.html", danGennemgangHtml(opgaver, dannet), "utf8");
});
