import { useEffect, useMemo, useRef, useState } from "react";
import { fortolkBeloeb } from "../domain/beloeb";
import { aktueltBilag, kanBogfoerePaa, kanVaelgeBilag, naesteBilag } from "../domain/fremdrift";
import type { Konto } from "../domain/kontoplan";
import { MOMSSTATUS_KNAP } from "../domain/momsstatus";
import { ANTAL_BILAG, synligeKonti, type Opgave, type Postering, type Side } from "../domain/opgave";
import { TKonto, type TKontoHandlinger } from "./TKonto";

interface BogfoeringsbilledeProps {
  opgave: Opgave;
  onTilForside: () => void;
}

function Statusbar({
  opgave,
  godkendte,
  vistBilag,
  onVaelg,
}: {
  opgave: Opgave;
  godkendte: number[];
  vistBilag: number;
  onVaelg: (nummer: number) => void;
}) {
  const aktuelt = aktueltBilag(opgave, godkendte);
  return (
    <nav className="statusbar" aria-label="Bilagenes status">
      {Array.from({ length: ANTAL_BILAG }, (_, i) => i + 1).map((nummer) => {
        const findes = opgave.bilag.some((bilag) => bilag.nummer === nummer);
        const kanVaelges = kanVaelgeBilag(opgave, godkendte, nummer);
        const godkendt = godkendte.includes(nummer);
        const vist = nummer === vistBilag;
        const status = !findes
          ? "findes ikke"
          : godkendt
            ? "godkendt"
            : nummer === aktuelt
              ? "aktuelt bilag"
              : "ikke tilgængeligt endnu";
        return (
          <button
            key={nummer}
            type="button"
            className={[godkendt && "er-godkendt", vist && "er-vist"].filter(Boolean).join(" ")}
            disabled={!kanVaelges}
            aria-current={vist ? "step" : undefined}
            aria-label={`Bilag ${nummer}, ${status}`}
            title={`Bilag ${nummer}, ${status}`}
            onClick={() => onVaelg(nummer)}
          >
            {nummer}
          </button>
        );
      })}
      <span className="statusbar-tekst">
        {godkendte.length}/{ANTAL_BILAG} godkendt
      </span>
    </nav>
  );
}

function Kolonne({
  id,
  titel,
  konti,
  opgave,
  posteringer,
  vistBilag,
  kanBogfoere,
  handlinger,
}: {
  id: string;
  titel: string;
  konti: Konto[];
  opgave: Opgave;
  posteringer: Postering[];
  vistBilag: number;
  kanBogfoere: boolean;
  handlinger: TKontoHandlinger;
}) {
  return (
    <section className="kolonne" aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`} className="kolonne-titel">
        {titel}
      </h2>
      <div className="tkonto-gitter">
        {konti.map((konto) => (
          <TKonto
            key={konto.nummer}
            konto={konto}
            saldo={opgave.saldi.find((saldo) => saldo.konto === konto.nummer)}
            posteringer={posteringer.filter((postering) => postering.konto === konto.nummer)}
            aktivtBilag={vistBilag}
            kanBogfoere={kanBogfoere}
            {...handlinger}
          />
        ))}
      </div>
    </section>
  );
}

export function Bogfoeringsbillede({ opgave, onTilForside }: BogfoeringsbilledeProps) {
  const [posteringer, setPosteringer] = useState<Postering[]>([]);
  // Godkendte bilag udfyldes af [Kontroller] i fase 4; indtil da er listen tom.
  const [godkendte] = useState<number[]>([]);
  const [vistBilag, setVistBilag] = useState(opgave.bilag[0].nummer);
  const [besked, setBesked] = useState<string | null>(null);
  const naesteId = useRef(1);
  const konti = useMemo(() => synligeKonti(opgave.variant.momsstatus), [opgave]);
  const bilag = opgave.bilag.find((b) => b.nummer === vistBilag) ?? opgave.bilag[0];
  const kanBogfoere = kanBogfoerePaa(opgave, godkendte, vistBilag);
  const naeste = naesteBilag(opgave, godkendte, vistBilag);

  useEffect(() => {
    if (!besked) return;
    const timer = window.setTimeout(() => setBesked(null), 6000);
    return () => window.clearTimeout(timer);
  }, [besked]);

  const vaelgBilag = (nummer: number) => {
    if (kanVaelgeBilag(opgave, godkendte, nummer)) setVistBilag(nummer);
  };

  const handlinger: TKontoHandlinger = {
    onTilfoej: (konto: number, side: Side, udtryk: string) => {
      if (!kanBogfoere) return "Bilaget er låst.";
      const resultat = fortolkBeloeb(udtryk);
      if (!resultat.ok) return resultat.fejl;
      const id = `p${naesteId.current++}`;
      setPosteringer((liste) => [...liste, { id, bilag: vistBilag, konto, side, udtryk: udtryk.trim(), oere: resultat.oere }]);
      return null;
    },
    onRet: (id: string, udtryk: string) => {
      if (!kanBogfoere) return "Bilaget er låst.";
      const resultat = fortolkBeloeb(udtryk);
      if (!resultat.ok) return resultat.fejl;
      setPosteringer((liste) =>
        liste.map((p) => (p.id === id ? { ...p, udtryk: udtryk.trim(), oere: resultat.oere } : p)),
      );
      return null;
    },
    onSlet: (id: string) => {
      if (kanBogfoere) setPosteringer((liste) => liste.filter((p) => p.id !== id));
    },
  };

  const momsTekst =
    MOMSSTATUS_KNAP[opgave.variant.momsstatus] +
    (opgave.momsfradragsprocent !== null ? ` (momsfradragsprocent ${opgave.momsfradragsprocent} %)` : "");

  return (
    <div className="bogfoering">
      <section className="boks1" aria-label="Bilag og handlinger">
        <div className="boks1-top">
          <h1>
            Bogføring af 4. kvartal {opgave.aar} · Ejendomsselskabet Ejendommen A/S
            <span className="boks1-info">
              {" "}
              · Variant {opgave.variant.nummer} · {momsTekst}
            </span>
          </h1>
          <div className="boks1-knapper">
            <button
              type="button"
              className="knap knap-primaer"
              disabled={!kanBogfoere}
              onClick={() =>
                setBesked("[Kontroller] kommer i fase 4. Indtil da kan bilaget ikke godkendes, og du kan ikke gå videre fra bilaget.")
              }
            >
              Kontroller
            </button>
            <button
              type="button"
              className="knap knap-sekundaer"
              disabled={naeste === null}
              title={naeste === null ? "Bilaget skal være korrekt bogført og kontrolleret, før du kan gå videre." : undefined}
              onClick={() => naeste !== null && setVistBilag(naeste)}
            >
              Næste bilag
            </button>
            <button type="button" className="knap knap-sekundaer" onClick={onTilForside}>
              Til forside
            </button>
          </div>
        </div>
        <p className="bilagstekst" aria-live="polite">
          <strong>
            Bilag {bilag.nummer} af {ANTAL_BILAG}:
          </strong>{" "}
          {bilag.tekst}
        </p>
        <div className="boks1-bund">
          <Statusbar opgave={opgave} godkendte={godkendte} vistBilag={vistBilag} onVaelg={vaelgBilag} />
          <p className="instruktion">
            Bogfør bilaget og tryk <span className="knapnavn">[Kontroller]</span>
          </p>
        </div>
      </section>

      <div className="kolonner">
        <Kolonne
          id="resultat"
          titel="Resultatopgørelse"
          konti={konti.resultat}
          opgave={opgave}
          posteringer={posteringer}
          vistBilag={vistBilag}
          kanBogfoere={kanBogfoere}
          handlinger={handlinger}
        />
        <Kolonne
          id="balance"
          titel="Balance"
          konti={konti.balance}
          opgave={opgave}
          posteringer={posteringer}
          vistBilag={vistBilag}
          kanBogfoere={kanBogfoere}
          handlinger={handlinger}
        />
      </div>

      {besked && (
        <div className="besked besked-info" role="status">
          <span>{besked}</span>
          <button type="button" className="knap knap-sekundaer knap-lille" onClick={() => setBesked(null)}>
            Luk
          </button>
        </div>
      )}
    </div>
  );
}
