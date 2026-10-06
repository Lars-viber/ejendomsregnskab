import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { KONTEKST, MOMSVALG_TEKST } from "../src/components/Forside";

describe("forsiden", () => {
  it("viser konteksten og momsvalget ordret fra Reference.docx", () => {
    render(<App />);
    expect(KONTEKST).toContain("Ejendomsselskabet Ejendommen A/S");
    expect(
      screen.getByText((_, element) => element?.tagName === "P" && element.textContent === KONTEKST),
    ).toBeInTheDocument();
    expect(screen.getByText(MOMSVALG_TEKST)).toBeInTheDocument();
  });

  it("har de tre valgknapper og de to startknapper", () => {
    render(<App />);
    expect(screen.getAllByRole("radio").map((knap) => knap.textContent)).toEqual([
      "Momsfri",
      "Delvis moms",
      "Momspligtig",
    ]);
    expect(screen.getByRole("button", { name: "Ny opgave" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hent variant" })).toBeInTheDocument();
  });

  it("kræver valg af momsstatus før en ny opgave", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    const nyOpgave = screen.getByRole("button", { name: "Ny opgave" });
    expect(nyOpgave).toBeDisabled();

    await bruger.click(screen.getByRole("radio", { name: "Momspligtig" }));
    expect(screen.getByRole("radio", { name: "Momspligtig" })).toHaveAttribute("aria-checked", "true");
    expect(nyOpgave).toBeEnabled();

    await bruger.click(nyOpgave);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Variant 3\d{6} · Momspligtig/);
  });

  it("henter en variant og flytter momsvalget efter variantnummeret", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await bruger.click(screen.getByRole("radio", { name: "Momsfri" }));
    await bruger.type(screen.getByLabelText("Variantnummer"), "2-483915");
    expect(screen.getByRole("radio", { name: "Delvis moms" })).toHaveAttribute("aria-checked", "true");

    await bruger.click(screen.getByRole("button", { name: "Hent variant" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Variant 2483915 · Delvis moms");
  });

  it("viser en fejl ved et ugyldigt variantnummer og starter ingen opgave", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await bruger.type(screen.getByLabelText("Variantnummer"), "12345");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await bruger.click(screen.getByRole("button", { name: "Hent variant" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Variantnummeret skal have 7 cifre.");
    expect(screen.queryByText("Resultatopgørelse")).not.toBeInTheDocument();
  });

  it("kan hente en variant med Enter-tasten", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await bruger.type(screen.getByLabelText("Variantnummer"), "1000042{Enter}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Variant 1000042 · Momsfri");
  });
});
