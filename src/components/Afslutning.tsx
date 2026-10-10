import { useEffect, useMemo, useRef, useState } from "react";
import { danExcel, excelFilnavn } from "../domain/excel";
import { MOMSSTATUS_KNAP } from "../domain/momsstatus";
import { ANTAL_BILAG, formaterDato, synligeKonti, type Opgave, type Postering } from "../domain/opgave";
import type { Session } from "../session/session";
import { TKonto, type TKontoHandlinger } from "./TKonto";

interface AfslutningProps {
  opgave: Opgave;
  session: Session;
  onTilForside: () => void;
}

const LAAST: TKontoHandlinger = { onTilfoej: () => "Opgaven er afsluttet.", onRet: () => "Opgaven er afsluttet.", onSlet: () => {} };

/** Pop op-vindue med alle 20 bilag (7.3). Kun tilgængeligt i den afsluttende oversigt. */
function BilagsVindue({ opgave, onLuk }: { opgave: Opgave; onLuk: () => void }) {
  const lukRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    lukRef.current?.focus();
    const tast = (event: KeyboardEvent) => {
      if (event.key === "Escape") onLuk();
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [onLuk]);

  return (
    <div className="dialog-baggrund" onClick={onLuk}>
      <div className="dialog bilagsvindue" role="dialog" aria-modal="true" aria-labelledby="bilagsvindue-titel" onClick={(e) => e.stopPropagation()}>
        <div className="bilagsvindue-top">
          <h2 id="bilagsvindue-titel">Alle {ANTAL_BILAG} bilag</h2>
          <button ref={lukRef} type="button" className="knap knap-sekundaer knap-lille" onClick={onLuk}>
            Luk
          </button>
        </div>
        <ol className="bilagsliste">
          {opgave.bilag.map((b) => (
            <li key={b.nummer}>
              <strong>
                Bilag {b.nummer} · {formaterDato(b.dato)}
              </strong>
              <p>{b.tekst}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Henter Excel-filen i browseren (ingen server). */
function hentExcel(opgave: Opgave) {
  const data = danExcel(opgave);
  const blob = new Blob([data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = excelFilnavn(opgave);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Summer for en afsluttet T-konto ud fra saldo ved start og den studerendes posteringer. */
function afslutningFor(opgave: Opgave, konto: number, posteringer: Postering[]) {
  let debet = 0;
  let kredit = 0;
  const start = opgave.saldi.find((s) => s.konto === konto);
  if (start) start.side === "debet" ? (debet += start.oere) : (kredit += start.oere);
  for (const p of posteringer) p.side === "debet" ? (debet += p.oere) : (kredit += p.oere);
  const netto = debet - kredit;
  return { side: netto > 0 ? ("debet" as const) : netto < 0 ? ("kredit" as const) : ("ingen" as const), oere: Math.abs(netto), sum: Math.max(debet, kredit) };
}

export function Afslutning({ opgave, session, onTilForside }: AfslutningProps) {
  const [visBilag, setVisBilag] = useState(false);
  const konti = useMemo(() => synligeKonti(opgave.variant.momsstatus), [opgave]);
  const momsTekst =
    MOMSSTATUS_KNAP[opgave.variant.momsstatus] +
    (opgave.momsfradragsprocent !== null ? ` (momsfradragsprocent ${opgave.momsfradragsprocent} %)` : "");

  const kolonne = (id: string, titel: string, liste: typeof konti.resultat) => (
    <section className="kolonne" aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`} className="kolonne-titel">
        {titel}
      </h2>
      <div className="tkonto-gitter">
        {liste.map((konto) => {
          const posteringer = session.posteringer.filter((p) => p.konto === konto.nummer);
          return (
            <TKonto
              key={konto.nummer}
              konto={konto}
              saldo={opgave.saldi.find((s) => s.konto === konto.nummer)}
              posteringer={posteringer}
              aktivtBilag={0}
              kanBogfoere={false}
              afslutning={afslutningFor(opgave, konto.nummer, posteringer)}
              {...LAAST}
            />
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="bogfoering">
      <section className="boks1" aria-label="Afsluttende oversigt">
        <div className="boks1-top">
          <h1>
            Bogføring af 4. kvartal {opgave.aar} · Ejendomsselskabet Ejendommen A/S
            <span className="boks1-info">
              {" "}
              · Variant {opgave.variant.nummer} · {momsTekst}
            </span>
          </h1>
          <div className="boks1-knapper">
            <button type="button" className="knap knap-primaer" onClick={() => setVisBilag(true)}>
              Vis bilag
            </button>
            <button type="button" className="knap knap-sekundaer" onClick={() => hentExcel(opgave)}>
              Hent i Excel
            </button>
            <button type="button" className="knap knap-sekundaer" onClick={onTilForside}>
              Til forside
            </button>
          </div>
        </div>
        <p className="bilagstekst er-godkendt">
          <strong>Opgaven er gennemført.</strong> Alle {ANTAL_BILAG} bilag er korrekt bogført, og saldiopgørelsen er korrekt. Herunder ses
          de afsluttede T-konti med saldoen efter sidste bilag. Med [Vis bilag] kan du se alle bilag, og med [Hent i Excel] kan du gemme
          opgaven med facit.
        </p>
      </section>

      <div className="kolonner">
        {kolonne("resultat", "Resultatopgørelse", konti.resultat)}
        {kolonne("balance", "Balance", konti.balance)}
      </div>

      {visBilag && <BilagsVindue opgave={opgave} onLuk={() => setVisBilag(false)} />}
    </div>
  );
}
