import { render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import App from "../src/App";
import { formaterBeloeb } from "../src/domain/beloeb";
import { KONTOPLAN } from "../src/domain/kontoplan";
import type { Momsstatus } from "../src/domain/momsstatus";
import { saldiEfterSidsteBilag } from "../src/domain/saldi";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";
import { SESSION_NOEGLE } from "../src/session/session";

/**
 * Gennemfører hele opgaver i applikationen – fra bilag 1 over saldiopgørelsen til den afsluttende
 * oversigt – med facit, for alle tre momsstatusser (Reference.docx afsnit 5, 7.2 og 7.3).
 */
const AAR = new Date().getFullYear();
const NAVN = new Map(KONTOPLAN.map((k) => [k.nummer, k.navn]));

async function skriv(bruger: UserEvent, felt: HTMLElement, tekst: string) {
  await bruger.click(felt);
  await bruger.paste(tekst);
  await bruger.keyboard("{Enter}");
}

async function gennemfoer(momsstatus: Momsstatus, loebenummer: number) {
  const variant = danVariant(momsstatus, loebenummer);
  const opgave = danOpgave(variant, AAR);
  const bruger = userEvent.setup();
  render(<App />);
  await skriv(bruger, screen.getByLabelText("Variantnummer"), variant.nummer);

  // Bilag 1–20: bogfør facit, kontrollér og gå videre.
  for (const bilag of opgave.bilag) {
    expect(screen.getByText(bilag.tekst, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vis bilag" })).not.toBeInTheDocument(); // 7.3: kun i oversigten
    for (const linje of bilag.facit) {
      const side = linje.side === "debet" ? "Debet" : "Kredit";
      await skriv(bruger, screen.getByLabelText(`${side} beløb for ${linje.konto} ${NAVN.get(linje.konto)}`), formaterBeloeb(linje.oere));
    }
    await bruger.click(screen.getByRole("button", { name: "Kontroller" }));
    expect(screen.getByRole("status")).toHaveTextContent(`Bilag ${bilag.nummer} er korrekt bogført.`);
    if (bilag.nummer < 20) await bruger.click(screen.getByRole("button", { name: "Næste bilag" }));
  }

  // Saldiopgørelsen: beløb og side for hver synlig T-konto.
  await bruger.click(screen.getByRole("button", { name: "Til saldiopgørelse" }));
  expect(screen.getByText(/Saldiopgørelse: Opgør saldoen/)).toBeInTheDocument();
  const saldi = saldiEfterSidsteBilag(opgave);
  // Først én forkert saldo: rød markering og hjælpetekst.
  const forkert = saldi.find((s) => s.side === "debet")!;
  for (const s of saldi) {
    const navn = `${s.konto} ${NAVN.get(s.konto)}`;
    const beloeb = s === forkert ? formaterBeloeb(s.oere + 100) : formaterBeloeb(s.oere);
    await bruger.click(screen.getByLabelText(`Saldo for ${navn}`));
    await bruger.paste(beloeb);
    const valg = { debet: "Debet", kredit: "Kredit", ingen: "Ingen saldo" }[s.side];
    await bruger.click(within(screen.getByRole("radiogroup", { name: `Saldoside for ${navn}` })).getByLabelText(valg));
  }
  await bruger.click(screen.getByRole("button", { name: "Kontroller" }));
  expect(screen.getByRole("alert")).toHaveTextContent("En eller flere saldi er forkerte.");
  expect(document.querySelectorAll('.saldofelt[data-markering="forkert"]').length).toBe(1);
  expect(document.querySelectorAll('.saldofelt[data-markering="korrekt"]').length).toBe(saldi.length - 1);

  // Ret den forkerte saldo: opgaven afsluttes.
  const felt = screen.getByLabelText(`Saldo for ${forkert.konto} ${NAVN.get(forkert.konto)}`);
  await bruger.clear(felt);
  await bruger.click(felt);
  await bruger.paste(formaterBeloeb(forkert.oere));
  await bruger.click(screen.getByRole("button", { name: "Kontroller" }));

  // Den afsluttende oversigt.
  expect(screen.getByText("Opgaven er gennemført.")).toBeInTheDocument();
  // T-kontiene som under bogføringen – uden afslutningslinje og totaler – og saldoen på én linje under kontoen.
  const SIDE = { debet: "Debet", kredit: "Kredit", ingen: "Ingen saldo" };
  expect([...document.querySelectorAll(".tkonto-saldo")].map((p) => p.textContent)).toEqual(
    expect.arrayContaining(saldi.map((s) => `Saldo: ${formaterBeloeb(s.oere)} ${SIDE[s.side]}`)),
  );
  expect(document.querySelectorAll(".tkonto-saldo").length).toBe(saldi.length);
  expect(document.querySelectorAll(".tkonto-sum, .er-afslutning").length).toBe(0);
  expect(JSON.parse(localStorage.getItem(SESSION_NOEGLE)!).fase).toBe("afsluttet");
  return { bruger, opgave };
}

describe("hele opgaven fra bilag 1 til den afsluttende oversigt", () => {
  it.each([
    ["momsfri", 104729],
    ["delvis", 482911],
    ["momspligtig", 777001],
  ] as const)("%s", async (status, loebenummer) => {
    const { bruger, opgave } = await gennemfoer(status, loebenummer);

    // [Vis bilag]: alle 20 bilag i et pop op-vindue.
    await bruger.click(screen.getByRole("button", { name: "Vis bilag" }));
    const vindue = screen.getByRole("dialog", { name: "Alle 20 bilag" });
    expect(within(vindue).getAllByRole("listitem")).toHaveLength(20);
    for (const b of opgave.bilag) expect(within(vindue).getByText(b.tekst)).toBeInTheDocument();
    await bruger.click(within(vindue).getByRole("button", { name: "Luk" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // [Hent i Excel]: en fil med variantnummeret i navnet.
    let filnavn = "";
    const opret = vi.fn(() => "blob:test");
    URL.createObjectURL = opret;
    URL.revokeObjectURL = vi.fn();
    const klik = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      filnavn = this.download;
    });
    await bruger.click(screen.getByRole("button", { name: "Hent i Excel" }));
    expect(opret).toHaveBeenCalledTimes(1);
    expect(filnavn).toBe(`Ejendomsregnskab_variant_${opgave.variant.nummer}.xlsx`);
    klik.mockRestore();

    // [Til forside] og tilbage til oversigten; fremskridtet er gemt.
    await bruger.click(screen.getByRole("button", { name: "Til forside" }));
    expect(screen.getByRole("region", { name: /Seneste opgave/ })).toHaveTextContent("opgaven er gennemført");
    await bruger.click(screen.getByRole("button", { name: "Se oversigten" }));
    expect(screen.getByText("Opgaven er gennemført.")).toBeInTheDocument();
  }, 180_000);
});
