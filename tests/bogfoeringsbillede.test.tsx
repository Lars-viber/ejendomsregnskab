import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { Bogfoeringsbillede } from "../src/components/Bogfoeringsbillede";
import type { Momsstatus } from "../src/domain/momsstatus";
import { danProeveopgave } from "../src/domain/proeveopgave";
import { danVariant } from "../src/domain/variant";

function visOpgave(momsstatus: Momsstatus = "delvis", onTilForside = () => {}) {
  const opgave = danProeveopgave(danVariant(momsstatus, 483915), 2026);
  render(<Bogfoeringsbillede opgave={opgave} onTilForside={onTilForside} />);
  return opgave;
}

const tkonto = (nummer: number) =>
  screen.getByRole("article", { name: (navn) => navn.startsWith(`${nummer} `) });

describe("Boks 1 (6.2)", () => {
  it("viser overskrift, instruktion, bilagstekst, statusbar og knapper", () => {
    const opgave = visOpgave();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bogføring af 4. kvartal 2026");
    expect(screen.getByText((_, el) => el?.className === "instruktion" && el.textContent === "Bogfør bilaget og tryk [Kontroller]")).toBeInTheDocument();
    expect(screen.getByText(opgave.bilag[0].tekst, { exact: false })).toBeInTheDocument();
    for (const navn of ["Kontroller", "Næste bilag", "Til forside"]) {
      expect(screen.getByRole("button", { name: navn })).toBeInTheDocument();
    }
  });

  it("viser 20 bilag i statusbaren med det aktuelle bilag markeret", () => {
    visOpgave();
    const statusbar = screen.getByRole("navigation", { name: "Bilagenes status" });
    const knapper = within(statusbar).getAllByRole("button");
    expect(knapper.map((k) => k.textContent)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
    expect(knapper[0]).toHaveAttribute("aria-current", "step");
  });

  it("skifter bilagstekst, når et andet bilag vælges i statusbaren", async () => {
    const bruger = userEvent.setup();
    const opgave = visOpgave();
    await bruger.click(screen.getByRole("button", { name: /^Bilag 3,/ }));
    expect(screen.getByText(opgave.bilag[2].tekst, { exact: false })).toBeInTheDocument();
  });

  it("viser en besked om, at [Kontroller] og [Næste bilag] kommer i fase 4", async () => {
    const bruger = userEvent.setup();
    visOpgave();
    await bruger.click(screen.getByRole("button", { name: "Kontroller" }));
    expect(screen.getByRole("status")).toHaveTextContent("kommer i fase 4");
    await bruger.click(screen.getByRole("button", { name: "Næste bilag" }));
    expect(screen.getByRole("status")).toHaveTextContent("kommer i fase 4");
  });

  it("går tilbage til forsiden med [Til forside]", async () => {
    const bruger = userEvent.setup();
    render(<App />);
    await bruger.type(screen.getByLabelText("Variantnummer"), "3000001{Enter}");
    expect(screen.getByText("Resultatopgørelse")).toBeInTheDocument();
    await bruger.click(screen.getByRole("button", { name: "Til forside" }));
    expect(screen.getByRole("button", { name: "Ny opgave" })).toBeInTheDocument();
  });
});

describe("kolonner med T-konti (6.3)", () => {
  it("har kolonnerne Resultatopgørelse og Balance med konti i stigende orden", () => {
    visOpgave("delvis");
    const resultat = screen.getByRole("region", { name: "Resultatopgørelse" });
    const balance = screen.getByRole("region", { name: "Balance" });
    const numre = (kolonne: HTMLElement) =>
      within(kolonne).getAllByRole("article").map((a) => Number(a.getAttribute("aria-label")!.split(" ")[0]));
    expect(numre(resultat).slice(0, 4)).toEqual([1000, 1001, 2000, 2001]);
    expect(numre(resultat)).toEqual([...numre(resultat)].sort((a, b) => a - b));
    expect(numre(balance)).toEqual([20000, 20001, 20002, 20003, 20004, 30000, 30001, 30002, 30003, 30004, 30005, 30006, 30007]);
  });

  it.each([
    ["momsfri", [1000, 30005, 30006, 30007], [1001]],
    ["momspligtig", [1001], [1000, 30005, 30006, 30007]],
    ["delvis", [], [1000, 1001, 30005, 30006, 30007]],
  ] as const)("skjuler konti efter momsstatus: %s", (status, skjult, synlig) => {
    visOpgave(status);
    const vist = screen.getAllByRole("article").map((a) => Number(a.getAttribute("aria-label")!.split(" ")[0]));
    for (const nummer of skjult) expect(vist).not.toContain(nummer);
    for (const nummer of [...synlig, 8000]) expect(vist).toContain(nummer);
  });

  it("viser saldo ved opgavens start på den rigtige side", () => {
    visOpgave("delvis");
    const bank = tkonto(20004);
    expect(within(bank).getByText("Saldo").closest("[data-side]")).toHaveAttribute("data-side", "debet");
    expect(within(bank).getByText("384.215,60")).toBeInTheDocument();
    const leje = tkonto(1000);
    expect(within(leje).getByText("Saldo").closest("[data-side]")).toHaveAttribute("data-side", "kredit");
    expect(within(tkonto(8000)).queryByText("Saldo")).not.toBeInTheDocument();
  });
});

describe("indtastning (6.4)", () => {
  it("bogfører et beløb med Enter og viser det formateret med bilagsnummer", async () => {
    const bruger = userEvent.setup();
    visOpgave();
    await bruger.type(screen.getByLabelText("Debet beløb for 20004 Bankkonto"), "204000{Enter}");
    const bank = tkonto(20004);
    expect(within(bank).getByText("B1")).toBeInTheDocument();
    expect(within(bank).getByLabelText(/Ret beløb: Debet på konto 20004/)).toHaveValue("204.000,00");
    expect(screen.getByLabelText("Debet beløb for 20004 Bankkonto")).toHaveValue("");
  });

  it("bogfører med +-knappen og beregner regneudtryk med decimalkomma", async () => {
    const bruger = userEvent.setup();
    visOpgave();
    await bruger.type(screen.getByLabelText(/^Kredit beløb for 1000 /), "=120000/1,25");
    await bruger.click(screen.getByRole("button", { name: /^Bogfør i kredit på 1000 / }));
    expect(within(tkonto(1000)).getByLabelText(/Ret beløb/)).toHaveValue("96.000,00");
  });

  it("viser udtrykket ved redigering og gemmer et rettet beløb", async () => {
    const bruger = userEvent.setup();
    visOpgave();
    await bruger.type(screen.getByLabelText("Debet beløb for 4001 Vedligeholdelse af bygning"), "=1000*1,25{Enter}");
    const felt = within(tkonto(4001)).getByLabelText(/Ret beløb/);
    expect(felt).toHaveValue("1.250,00");
    await bruger.click(felt);
    expect(felt).toHaveValue("=1000*1,25");
    await bruger.clear(felt);
    await bruger.type(felt, "=(4000+250)/2{Enter}");
    expect(felt).toHaveValue("2.125,00");
  });

  it("tillader både debet og kredit på samme konto i samme bilag", async () => {
    const bruger = userEvent.setup();
    visOpgave();
    await bruger.type(screen.getByLabelText("Debet beløb for 20002 Tilgodehavende leje"), "1000{Enter}");
    await bruger.type(screen.getByLabelText("Kredit beløb for 20002 Tilgodehavende leje"), "1000{Enter}");
    expect(within(tkonto(20002)).getAllByText("B1")).toHaveLength(2);
  });

  it("viser en fejl ved et ugyldigt beløb og bogfører ikke", async () => {
    const bruger = userEvent.setup();
    visOpgave();
    const felt = screen.getByLabelText("Debet beløb for 20004 Bankkonto");
    await bruger.type(felt, "1000*2{Enter}");
    expect(within(tkonto(20004)).getByText('Et regneudtryk skal starte med "=", f.eks. =1000*1,25.')).toBeInTheDocument();
    expect(within(tkonto(20004)).queryByText("B1")).not.toBeInTheDocument();
    expect(felt).toHaveValue("1000*2");
  });

  it("kan slette en postering", async () => {
    const bruger = userEvent.setup();
    visOpgave();
    await bruger.type(screen.getByLabelText("Debet beløb for 20004 Bankkonto"), "500{Enter}");
    await bruger.click(screen.getByRole("button", { name: /^Slet debet på konto 20004/ }));
    expect(within(tkonto(20004)).queryByText("B1")).not.toBeInTheDocument();
  });

  it("låser posteringer fra andre bilag og viser dem med bilagsnummer", async () => {
    const bruger = userEvent.setup();
    visOpgave();
    await bruger.type(screen.getByLabelText("Debet beløb for 20004 Bankkonto"), "500{Enter}");
    await bruger.click(screen.getByRole("button", { name: /^Bilag 2,/ }));
    const bank = tkonto(20004);
    expect(within(bank).getByText("B1")).toBeInTheDocument();
    expect(within(bank).getByText("500,00")).toBeInTheDocument();
    expect(within(bank).queryByLabelText(/Ret beløb/)).not.toBeInTheDocument();
  });
});
