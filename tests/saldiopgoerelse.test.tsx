import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Afslutning } from "../src/components/Afslutning";
import { Saldiopgoerelse } from "../src/components/Saldiopgoerelse";
import { formaterBeloeb } from "../src/domain/beloeb";
import { KONTOPLAN } from "../src/domain/kontoplan";
import { ANTAL_BILAG, type Opgave } from "../src/domain/opgave";
import { saldiEfterSidsteBilag } from "../src/domain/saldi";
import { danVariant } from "../src/domain/variant";
import { danOpgave } from "../src/generator/generator";
import { nySession, type Session } from "../src/session/session";

const opgave = danOpgave(danVariant("delvis", 104729), 2026);
const NAVN = new Map(KONTOPLAN.map((k) => [k.nummer, k.navn]));

/** En session, hvor alle 20 bilag er bogført med facit. */
function bogfoertSession(o: Opgave): Session {
  const session = nySession(o);
  let id = 0;
  for (const b of o.bilag) {
    for (const l of b.facit) {
      session.posteringer.push({ id: `p${++id}`, bilag: b.nummer, konto: l.konto, side: l.side, udtryk: formaterBeloeb(l.oere), oere: l.oere });
    }
  }
  session.godkendte = Array.from({ length: ANTAL_BILAG }, (_, i) => i + 1);
  session.vistBilag = ANTAL_BILAG;
  return session;
}

function Vaert() {
  const [session, setSession] = useState<Session>(() => ({ ...bogfoertSession(opgave), fase: "saldi" }));
  return <Saldiopgoerelse opgave={opgave} session={session} onSessionChange={setSession} onTilForside={() => {}} />;
}

const felt = (konto: number) => screen.getByLabelText(`Saldo for ${konto} ${NAVN.get(konto)}`) as HTMLInputElement;

describe("saldofeltet opfører sig som felterne ved bogføringen (6.4)", () => {
  const [a, b] = saldiEfterSidsteBilag(opgave).map((s) => s.konto);

  it("har overskriften \"Saldo\"", () => {
    render(<Vaert />);
    expect(screen.getAllByText("Saldo", { selector: "legend" }).length).toBeGreaterThan(0);
  });

  it("viser et regneudtryk som formateret beløb uden for feltet og som regneudtryk i feltet", async () => {
    const bruger = userEvent.setup();
    render(<Vaert />);
    await bruger.click(felt(a));
    await bruger.paste("=552875,77+167700-2950");
    expect(felt(a).value).toBe("=552875,77+167700-2950");
    await bruger.keyboard("{Enter}");
    expect(felt(a).value).toBe("717.625,77");
    await bruger.click(felt(a));
    expect(felt(a).value).toBe("=552875,77+167700-2950");
    await bruger.tab();
    expect(felt(a).value).toBe("717.625,77");
  });

  it("formaterer også et beløb skrevet uden \"=\" – ved Tab og ved klik uden for feltet", async () => {
    const bruger = userEvent.setup();
    render(<Vaert />);
    await bruger.click(felt(a));
    await bruger.paste("670800");
    await bruger.tab();
    expect(felt(a).value).toBe("670.800,00");
    await bruger.click(felt(b));
    await bruger.paste("0");
    await bruger.click(document.body);
    expect(felt(b).value).toBe("0,00");
    await bruger.click(felt(a));
    expect(felt(a).value).toBe("670800");
  });

  it("viser en fejl under feltet, hvis beløbet ikke kan læses", async () => {
    const bruger = userEvent.setup();
    render(<Vaert />);
    await bruger.click(felt(a));
    await bruger.paste("tolv");
    expect(screen.queryByText(/Skriv et beløb/)).not.toBeInTheDocument();
    await bruger.tab();
    expect(felt(a).value).toBe("tolv");
    expect(felt(a)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Skriv et beløb/)).toBeInTheDocument();
  });
});

describe("den afsluttende oversigt (7.3)", () => {
  it("viser T-kontiene som under bogføringen og saldoen på én linje under hver konto", () => {
    const session = { ...bogfoertSession(opgave), fase: "afsluttet" as const };
    render(<Afslutning opgave={opgave} session={session} onTilForside={() => {}} />);
    const saldi = saldiEfterSidsteBilag(opgave);
    const linjer = [...document.querySelectorAll(".tkonto-saldo")].map((p) => p.textContent);
    expect(linjer).toHaveLength(saldi.length);
    const SIDE = { debet: "Debet", kredit: "Kredit", ingen: "Ingen saldo" };
    for (const s of saldi) expect(linjer).toContain(`Saldo: ${formaterBeloeb(s.oere)} ${SIDE[s.side]}`);
    expect(linjer).toContain("Saldo: 0,00 Ingen saldo");
    // Ingen balancerende saldolinje i T-kontoen og ingen totaler.
    expect(document.querySelectorAll(".tkonto-sum, .er-afslutning").length).toBe(0);
    // Saldo ved start og alle posteringer står i T-kontiene.
    expect(document.querySelectorAll(".postering.er-laast").length).toBe(session.posteringer.length);
    expect(document.querySelectorAll(".postering.er-saldo").length).toBe(opgave.saldi.length);
  });
});
