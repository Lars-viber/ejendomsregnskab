import { render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import App from "../src/App";
import { formaterBeloeb } from "../src/domain/beloeb";
import { KONTOPLAN } from "../src/domain/kontoplan";
import type { Bilag } from "../src/domain/opgave";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";
import { SESSION_NOEGLE } from "../src/session/session";

const AAR = new Date().getFullYear();
const VARIANT = "2104729";
const opgave = danOpgave(danVariant("delvis", 104729), AAR);
const NAVN = new Map(KONTOPLAN.map((k) => [k.nummer, k.navn]));

const tkonto = (nummer: number) => screen.getByRole("article", { name: (navn) => navn.startsWith(`${nummer} `) });
const statusknap = (nummer: number) =>
  within(screen.getByRole("navigation", { name: "Bilagenes status" })).getByRole("button", { name: new RegExp(`^Bilag ${nummer},`) });

async function hentVariant(bruger: UserEvent, nummer = VARIANT) {
  await bruger.type(screen.getByLabelText("Variantnummer"), `${nummer}{Enter}`);
}

/** Bogfører bilagets facit gennem T-kontienes indtastningsfelter. */
async function bogfoer(bruger: UserEvent, bilag: Bilag, aendr: (oere: number, i: number) => number = (x) => x) {
  for (const [i, linje] of bilag.facit.entries()) {
    const side = linje.side === "debet" ? "Debet" : "Kredit";
    const felt = screen.getByLabelText(`${side} beløb for ${linje.konto} ${NAVN.get(linje.konto)}`);
    await bruger.type(felt, `${formaterBeloeb(aendr(linje.oere, i))}{Enter}`);
  }
}

const markeringerPaa = (bilagsnummer: number) =>
  [...document.querySelectorAll("[data-markering]")]
    .filter((el) => el.textContent?.includes(`B${bilagsnummer}`))
    .map((el) => el.getAttribute("data-markering"));

describe("kontrol og fremdrift i applikationen (7.1 og 7.2)", () => {
  it("godkender et korrekt bilag, viser det grønt, låser det og åbner [Næste bilag]", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await hentVariant(bruger);
    await bogfoer(bruger, opgave.bilag[0]);
    expect(screen.getByRole("button", { name: "Næste bilag" })).toBeDisabled();

    await bruger.click(screen.getByRole("button", { name: "Kontroller" }));
    expect(screen.getByRole("status")).toHaveTextContent("Bilag 1 er korrekt bogført.");
    expect(markeringerPaa(1).length).toBe(opgave.bilag[0].facit.length);
    expect(markeringerPaa(1).every((m) => m === "korrekt")).toBe(true);
    expect(screen.queryByLabelText(/Ret beløb/)).not.toBeInTheDocument(); // låst
    expect(screen.getByRole("button", { name: "Kontroller" })).toBeDisabled();
    expect(statusknap(1)).toHaveAccessibleName(/godkendt/);

    // [Næste bilag]: bilag 2 vises, bilag 1 vises nu i neutral farve.
    await bruger.click(screen.getByRole("button", { name: "Næste bilag" }));
    expect(screen.getByText(opgave.bilag[1].tekst, { exact: false })).toBeInTheDocument();
    expect(markeringerPaa(1)).toEqual([]);
    expect(statusknap(2)).toBeEnabled();
    expect(statusknap(3)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Næste bilag" })).toBeDisabled();
  });

  it("markerer forkerte beløb røde og viser en hjælpetekst uden at godkende", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await hentVariant(bruger);
    // Første linje 100 kr. for meget: forkert beløb og ubalance.
    await bogfoer(bruger, opgave.bilag[0], (x, i) => (i === 0 ? x + 10_000 : x));
    await bruger.click(screen.getByRole("button", { name: "Kontroller" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bilag 1 er ikke korrekt bogført endnu.");
    expect(alert).toHaveTextContent("Bilagets debiteringer og krediteringer balancerer ikke.");
    expect(alert).toHaveTextContent("Et eller flere af de indtastede beløb er forkerte.");
    expect(markeringerPaa(1)).toContain("forkert");
    expect(screen.getByRole("button", { name: "Næste bilag" })).toBeDisabled();
    expect(screen.getAllByLabelText(/Ret beløb/).length).toBeGreaterThan(0); // stadig redigerbart
  });

  it("viser et tidligere bilag som ren visning med fremhævede posteringer", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await hentVariant(bruger);
    await bogfoer(bruger, opgave.bilag[0]);
    await bruger.click(screen.getByRole("button", { name: "Kontroller" }));
    await bruger.click(screen.getByRole("button", { name: "Næste bilag" }));

    await bruger.click(statusknap(1));
    expect(screen.getByText(opgave.bilag[0].tekst, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Tidligere bilag – kun visning/)).toBeInTheDocument();
    expect(markeringerPaa(1).every((m) => m === "fremhaevet")).toBe(true);
    expect(screen.getByRole("button", { name: "Kontroller" })).toBeDisabled();
    expect(screen.queryByLabelText(/^Debet beløb for/)).not.toBeInTheDocument();
    // Man kan ikke gå frem forbi det aktuelle bilag.
    expect(statusknap(3)).toBeDisabled();
    await bruger.click(statusknap(2));
    expect(screen.getByText(opgave.bilag[1].tekst, { exact: false })).toBeInTheDocument();
  });

  it("gemmer fremskridtet, så opgaven kan fortsættes, når siden åbnes igen", async () => {
    const bruger = userEvent.setup();
    const { unmount } = render(<App />);
    await hentVariant(bruger);
    await bogfoer(bruger, opgave.bilag[0]);
    await bruger.click(screen.getByRole("button", { name: "Kontroller" }));
    await bruger.click(screen.getByRole("button", { name: "Næste bilag" }));
    const linje = opgave.bilag[1].facit[0];
    await bruger.type(
      screen.getByLabelText(`${linje.side === "debet" ? "Debet" : "Kredit"} beløb for ${linje.konto} ${NAVN.get(linje.konto)}`),
      "1234{Enter}",
    );
    expect(localStorage.getItem(SESSION_NOEGLE)).toContain(VARIANT);
    unmount();

    render(<App />);
    expect(screen.getByRole("region", { name: /Igangværende opgave/ })).toHaveTextContent(`variant ${VARIANT}`);
    expect(screen.getByText(/1 af 20 bilag godkendt/)).toBeInTheDocument();
    await bruger.click(screen.getByRole("button", { name: "Fortsæt opgaven" }));
    expect(screen.getByText(opgave.bilag[1].tekst, { exact: false })).toBeInTheDocument();
    expect(within(tkonto(linje.konto)).getByLabelText(/Ret beløb/)).toHaveValue("1.234,00");
    expect(statusknap(1)).toHaveAccessibleName(/godkendt/);
  });

  it("spørger, før en igangværende opgave slettes, når en ny opgave startes", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await hentVariant(bruger);
    await bogfoer(bruger, opgave.bilag[0]);
    await bruger.click(screen.getByRole("button", { name: "Til forside" }));

    // Annuller: den igangværende opgave beholdes.
    await hentVariant(bruger, "1000042");
    expect(screen.getByRole("dialog", { name: "Slet den igangværende opgave?" })).toBeInTheDocument();
    await bruger.click(screen.getByRole("button", { name: "Behold den igangværende opgave" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Igangværende opgave/ })).toHaveTextContent(`variant ${VARIANT}`);

    // Bekræft: en ny, tom opgave startes.
    await bruger.click(screen.getByRole("button", { name: "Hent variant" }));
    await bruger.click(screen.getByRole("button", { name: "Slet og start ny opgave" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Variant 1000042");
    expect(screen.queryByLabelText(/Ret beløb/)).not.toBeInTheDocument();
    expect(localStorage.getItem(SESSION_NOEGLE)).toContain("1000042");
  });

  it("fortsætter uden at spørge, når samme variant hentes igen", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await hentVariant(bruger);
    await bogfoer(bruger, opgave.bilag[0]);
    await bruger.click(screen.getByRole("button", { name: "Til forside" }));
    await hentVariant(bruger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Ret beløb/).length).toBe(opgave.bilag[0].facit.length);
  });
});
