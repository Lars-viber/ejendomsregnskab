import { useEffect, useMemo, useRef, useState } from "react";
import { fortolkBeloeb } from "../domain/beloeb";
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
  aktivtBilag,
  posteringer,
  onVaelg,
}: {
  opgave: Opgave;
  aktivtBilag: number;
  posteringer: Postering[];
  onVaelg: (nummer: number) => void;
}) {
  return (
    <nav className="statusbar" aria-label="Bilagenes status">
      {Array.from({ length: ANTAL_BILAG }, (_, i) => i + 1).map((nummer) => {
        const findes = opgave.bilag.some((bilag) => bilag.nummer === nummer);
        const aktiv = nummer === aktivtBilag;
        const paabegyndt = posteringer.some((postering) => postering.bilag === nummer);
        const status = !findes
          ? "findes ikke i prøveopgaven"
          : aktiv
            ? "aktuelt bilag"
            : paabegyndt
              ? "påbegyndt"
              : "ikke bogført";
        return (
          <button
            key={nummer}
            type="button"
            className={`${aktiv ? "er-aktiv" : ""} ${paabegyndt && !aktiv ? "er-paabegyndt" : ""}`}
            disabled={!findes}
            aria-current={aktiv ? "step" : undefined}
            aria-label={`Bilag ${nummer}, ${status}`}
            title={`Bilag ${nummer}, ${status}`}
            onClick={() => onVaelg(nummer)}
          >
            {nummer}
          </button>
        );
      })}
      <span className="statusbar-tekst">0/{ANTAL_BILAG} godkendt</span>
    </nav>
  );
}

function Kolonne({
  id,
  titel,
  konti,
  opgave,
  posteringer,
  aktivtBilag,
  handlinger,
}: {
  id: string;
  titel: string;
  konti: Konto[];
  opgave: Opgave;
  posteringer: Postering[];
  aktivtBilag: number;
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
            aktivtBilag={aktivtBilag}
            kanBogfoere
            {...handlinger}
          />
        ))}
      </div>
    </section>
  );
}

export function Bogfoeringsbillede({ opgave, onTilForside }: BogfoeringsbilledeProps) {
  const [posteringer, setPosteringer] = useState<Postering[]>([]);
  const [aktivtBilag, setAktivtBilag] = useState(opgave.bilag[0].nummer);
  const [besked, setBesked] = useState<string | null>(null);
  const naesteId = useRef(1);
  const konti = useMemo(() => synligeKonti(opgave.variant.momsstatus), [opgave]);
  const bilag = opgave.bilag.find((b) => b.nummer === aktivtBilag) ?? opgave.bilag[0];

  useEffect(() => {
    if (!besked) return;
    const timer = window.setTimeout(() => setBesked(null), 6000);
    return () => window.clearTimeout(timer);
  }, [besked]);

  const handlinger: TKontoHandlinger = {
    onTilfoej: (konto: number, side: Side, udtryk: string) => {
      const resultat = fortolkBeloeb(udtryk);
      if (!resultat.ok) return resultat.fejl;
      const id = `p${naesteId.current++}`;
      setPosteringer((liste) => [...liste, { id, bilag: aktivtBilag, konto, side, udtryk: udtryk.trim(), oere: resultat.oere }]);
      return null;
    },
    onRet: (id: string, udtryk: string) => {
      const resultat = fortolkBeloeb(udtryk);
      if (!resultat.ok) return resultat.fejl;
      setPosteringer((liste) =>
        liste.map((p) => (p.id === id ? { ...p, udtryk: udtryk.trim(), oere: resultat.oere } : p)),
      );
      return null;
    },
    onSlet: (id: string) => setPosteringer((liste) => liste.filter((p) => p.id !== id)),
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
              {opgave.erProeveopgave && " · prøveopgave"}
            </span>
          </h1>
          <div className="boks1-knapper">
            <button
              type="button"
              className="knap knap-primaer"
              onClick={() => setBesked("[Kontroller] kommer i fase 4. Indtil da kontrolleres bilagene ikke.")}
            >
              Kontroller
            </button>
            <button
              type="button"
              className="knap knap-sekundaer"
              onClick={() => setBesked("[Næste bilag] kommer i fase 4. I prøveopgaven kan du skifte bilag i statusbaren.")}
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
          <Statusbar opgave={opgave} aktivtBilag={aktivtBilag} posteringer={posteringer} onVaelg={setAktivtBilag} />
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
          aktivtBilag={aktivtBilag}
          handlinger={handlinger}
        />
        <Kolonne
          id="balance"
          titel="Balance"
          konti={konti.balance}
          opgave={opgave}
          posteringer={posteringer}
          aktivtBilag={aktivtBilag}
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
