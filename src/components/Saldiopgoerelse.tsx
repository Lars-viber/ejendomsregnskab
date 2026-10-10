import { useMemo, useState } from "react";
import { formaterBeloeb, fortolkBeloeb } from "../domain/beloeb";
import { MOMSSTATUS_KNAP } from "../domain/momsstatus";
import { ANTAL_BILAG, synligeKonti, type Opgave } from "../domain/opgave";
import { kontrollerSaldi, saldiEfterSidsteBilag, type SaldoKontrol, type SaldoSide, type SaldoSvar } from "../domain/saldi";
import type { Session } from "../session/session";
import { medKnapnavne, Statusbar } from "./Bogfoeringsbillede";
import { TKonto, type PosteringsMarkering, type TKontoHandlinger } from "./TKonto";

interface SaldiopgoerelseProps {
  opgave: Opgave;
  session: Session;
  onSessionChange: (session: Session) => void;
  onTilForside: () => void;
}

const LAAST: TKontoHandlinger = { onTilfoej: () => "Bogføringen er låst.", onRet: () => "Bogføringen er låst.", onSlet: () => {} };

const SIDER: [SaldoSide, string][] = [
  ["debet", "Debet"],
  ["kredit", "Kredit"],
  ["ingen", "Ingen saldo"],
];

export const SALDI_VEJLEDNING =
  'Saldiopgørelse: Opgør saldoen på hver T-konto efter sidste bilag. Skriv beløbet (eller et regneudtryk, der starter med "=") og vælg "Debet", "Kredit" eller "Ingen saldo". En konto med saldo 0 angives med beløbet 0 og "Ingen saldo".';

function SaldoFelt({
  nummer,
  navn,
  svar,
  markering,
  onAendr,
}: {
  nummer: number;
  navn: string;
  svar: SaldoSvar;
  markering?: "korrekt" | "forkert";
  onAendr: (svar: SaldoSvar) => void;
}) {
  // Som felterne ved bogføringen (6.4): uden for feltet vises det beregnede beløb formateret;
  // i feltet vises det, der er skrevet (beløb eller regneudtryk), så det kan rettes.
  const [harFokus, setHarFokus] = useState(false);
  const resultat = svar.udtryk.trim() ? fortolkBeloeb(svar.udtryk, { tilladNul: true }) : null;
  const fejl = !harFokus && resultat && !resultat.ok ? resultat.fejl : null;
  const vist = harFokus || !resultat || !resultat.ok ? svar.udtryk : formaterBeloeb(resultat.oere);

  return (
    <fieldset className={`saldofelt${markering ? ` markering-${markering}` : ""}`} data-markering={markering}>
      <legend>Saldo</legend>
      <input
        value={vist}
        inputMode="decimal"
        placeholder="Beløb/=formel"
        title="Skriv et beløb, f.eks. 12345,67, eller et regneudtryk, der starter med =, f.eks. =1000*1,25"
        aria-label={`Saldo for ${nummer} ${navn}`}
        aria-invalid={fejl !== null}
        onChange={(event) => onAendr({ ...svar, udtryk: event.target.value })}
        onFocus={() => setHarFokus(true)}
        onBlur={() => setHarFokus(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {fejl && <small className="feltfejl">{fejl}</small>}
      <div className="saldo-sider" role="radiogroup" aria-label={`Saldoside for ${nummer} ${navn}`}>
        {SIDER.map(([side, tekst]) => (
          <label key={side}>
            <input type="radio" name={`saldoside-${nummer}`} checked={svar.side === side} onChange={() => onAendr({ ...svar, side })} />
            {tekst}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Saldiopgoerelse({ opgave, session, onSessionChange, onTilForside }: SaldiopgoerelseProps) {
  const [kontrol, setKontrol] = useState<SaldoKontrol | null>(null);
  const [vistBilag, setVistBilag] = useState<number | null>(null);
  const konti = useMemo(() => synligeKonti(opgave.variant.momsstatus), [opgave]);
  const bilag = vistBilag !== null ? opgave.bilag.find((b) => b.nummer === vistBilag) : undefined;

  const opdater = (aendring: Partial<Session>) => onSessionChange({ ...session, ...aendring, opdateret: new Date().toISOString() });

  const aendrSvar = (konto: number, svar: SaldoSvar) => {
    opdater({ saldiSvar: { ...session.saldiSvar, [konto]: svar } });
    setKontrol(null);
  };

  const kontroller = () => {
    const resultat = kontrollerSaldi(opgave, session.saldiSvar);
    setKontrol(resultat);
    if (resultat.korrekt) opdater({ fase: "afsluttet" });
  };

  // Et bilag, der vælges i statusbaren, vises kun; dets posteringer fremhæves (7.2).
  const markeringer: Record<string, PosteringsMarkering> = {};
  for (const p of session.posteringer) if (p.bilag === vistBilag) markeringer[p.id] = "fremhaevet";

  const momsTekst =
    MOMSSTATUS_KNAP[opgave.variant.momsstatus] +
    (opgave.momsfradragsprocent !== null ? ` (momsfradragsprocent ${opgave.momsfradragsprocent} %)` : "");

  const kolonne = (id: string, titel: string, liste: typeof konti.resultat) => (
    <section className="kolonne" aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`} className="kolonne-titel">
        {titel}
      </h2>
      <div className="tkonto-gitter">
        {liste.map((konto) => (
          <TKonto
            key={konto.nummer}
            konto={konto}
            saldo={opgave.saldi.find((s) => s.konto === konto.nummer)}
            posteringer={session.posteringer.filter((p) => p.konto === konto.nummer)}
            aktivtBilag={0}
            kanBogfoere={false}
            markeringer={markeringer}
            {...LAAST}
          >
            <SaldoFelt
              nummer={konto.nummer}
              navn={konto.navn}
              svar={session.saldiSvar[konto.nummer] ?? { udtryk: "", side: null }}
              markering={kontrol?.konti[konto.nummer]}
              onAendr={(svar) => aendrSvar(konto.nummer, svar)}
            />
          </TKonto>
        ))}
      </div>
    </section>
  );

  return (
    <div className="bogfoering">
      <section className="boks1" aria-label="Saldiopgørelse og handlinger">
        <div className="boks1-top">
          <h1>
            Bogføring af 4. kvartal {opgave.aar} · Ejendomsselskabet Ejendommen A/S
            <span className="boks1-info">
              {" "}
              · Variant {opgave.variant.nummer} · {momsTekst}
            </span>
          </h1>
          <div className="boks1-knapper">
            <button type="button" className="knap knap-primaer" onClick={kontroller}>
              Kontroller
            </button>
            <button type="button" className="knap knap-sekundaer" onClick={onTilForside}>
              Til forside
            </button>
            {/* Midlertidig testmulighed – findes kun i den lokale udgave (pnpm dev), aldrig på GitHub Pages. */}
            {import.meta.env.DEV && (
              <button
                type="button"
                className="knap knap-test"
                title="Kun lokal test: udfylder de korrekte saldi"
                onClick={() => {
                  const svar: Record<string, SaldoSvar> = {};
                  for (const s of saldiEfterSidsteBilag(opgave)) svar[s.konto] = { udtryk: String(s.oere / 100).replace(".", ","), side: s.side };
                  opdater({ saldiSvar: svar });
                  setKontrol(null);
                }}
              >
                Test: udfyld saldi
              </button>
            )}
          </div>
        </div>
        <p className="bilagstekst" aria-live="polite">
          {bilag ? (
            <>
              <strong>
                Bilag {bilag.nummer} af {ANTAL_BILAG}:
              </strong>{" "}
              {bilag.tekst}
            </>
          ) : (
            SALDI_VEJLEDNING
          )}
        </p>
        <div className="boks1-bund">
          <Statusbar
            opgave={opgave}
            godkendte={session.godkendte}
            vistBilag={vistBilag ?? 0}
            onVaelg={(n) => setVistBilag(n === vistBilag ? null : n)}
          />
          <p className="instruktion">
            {bilag ? `Bilag ${bilag.nummer} – kun visning. Klik igen for at skjule.` : medKnapnavne("Opgør saldiene og tryk [Kontroller]")}
          </p>
        </div>
      </section>

      <div className="kolonner">
        {kolonne("resultat", "Resultatopgørelse", konti.resultat)}
        {kolonne("balance", "Balance", konti.balance)}
      </div>

      {kontrol && !kontrol.korrekt && kontrol.hjaelpetekster.length > 0 && (
        <div className="besked besked-forkert" role="alert">
          <div>
            <strong>Saldiopgørelsen er ikke korrekt endnu.</strong>
            <ul>
              {kontrol.hjaelpetekster.map((linje) => (
                <li key={linje}>{linje}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="knap knap-sekundaer knap-lille" onClick={() => setKontrol({ ...kontrol, hjaelpetekster: [] })}>
            Luk
          </button>
        </div>
      )}
    </div>
  );
}
