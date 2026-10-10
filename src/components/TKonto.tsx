import { useState, type FormEvent, type ReactNode } from "react";
import { formaterBeloeb } from "../domain/beloeb";
import type { Konto } from "../domain/kontoplan";
import type { Postering, Saldo, Side } from "../domain/opgave";

const SIDENAVN: Record<Side, string> = { debet: "Debet", kredit: "Kredit" };

/** Grøn/rød efter [Kontroller] (7.1) eller fremhævet ved visning af et tidligere bilag (7.2). */
export type PosteringsMarkering = "korrekt" | "forkert" | "fremhaevet";

const MARKERINGSTEKST: Record<PosteringsMarkering, string> = {
  korrekt: "korrekt",
  forkert: "forkert",
  fremhaevet: "fra det viste bilag",
};

const markeringsklasse = (m?: PosteringsMarkering) => (m ? ` markering-${m}` : "");

export interface TKontoHandlinger {
  /** Returnerer en fejltekst, hvis beløbet ikke kan bruges. */
  onTilfoej: (konto: number, side: Side, udtryk: string) => string | null;
  onRet: (id: string, udtryk: string) => string | null;
  onSlet: (id: string) => void;
}

interface TKontoProps extends TKontoHandlinger {
  konto: Konto;
  saldo?: Saldo;
  posteringer: Postering[];
  aktivtBilag: number;
  /** Om der kan bogføres på det aktive bilag. */
  kanBogfoere: boolean;
  /** Markering pr. postering (postering.id). */
  markeringer?: Readonly<Record<string, PosteringsMarkering>>;
  /** Vises under T-kontoen, f.eks. feltet til saldiopgørelsen (7.3). */
  children?: ReactNode;
  /** Afslutning af T-kontoen i den afsluttende oversigt: saldo efter sidste bilag og summer (7.3). */
  afslutning?: { side: "debet" | "kredit" | "ingen"; oere: number; sum: number };
  /** Ekstra CSS-klasse på hele T-kontoen (f.eks. grøn/rød saldo). */
  klasse?: string;
}

/** En postering på det aktive bilag: vises formateret, redigeres ved klik (som i reference-applikationen). */
function RedigerbarPostering({
  postering,
  markering,
  onRet,
  onSlet,
}: { postering: Postering; markering?: PosteringsMarkering } & Pick<TKontoHandlinger, "onRet" | "onSlet">) {
  const [udtryk, setUdtryk] = useState(postering.udtryk);
  const [fejl, setFejl] = useState<string | null>(null);
  const [harFokus, setHarFokus] = useState(false);
  const beskrivelse = `${SIDENAVN[postering.side]} på konto ${postering.konto} fra bilag ${postering.bilag}`;

  const gem = () => {
    setHarFokus(false);
    if (udtryk === postering.udtryk) {
      setFejl(null);
      return;
    }
    setFejl(onRet(postering.id, udtryk));
  };

  return (
    <div className="postering-wrap">
      <div className={`postering er-aktiv${markeringsklasse(markering)}`} data-markering={markering}>
        <span className="bilagsmaerke">B{postering.bilag}</span>
        <input
          value={harFokus || fejl ? udtryk : formaterBeloeb(postering.oere)}
          aria-label={`Ret beløb: ${beskrivelse}${markering ? ` (${MARKERINGSTEKST[markering]})` : ""}`}
          aria-invalid={fejl !== null}
          inputMode="decimal"
          onChange={(event) => setUdtryk(event.target.value)}
          onFocus={() => {
            setUdtryk(fejl ? udtryk : postering.udtryk);
            setHarFokus(true);
          }}
          onBlur={gem}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setUdtryk(postering.udtryk);
              setFejl(null);
              setHarFokus(false);
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="slet-postering"
          aria-label={`Slet ${beskrivelse.charAt(0).toLowerCase()}${beskrivelse.slice(1)}`}
          title="Slet posteringen"
          onClick={() => onSlet(postering.id)}
        >
          ×
        </button>
      </div>
      {fejl && <small className="feltfejl">{fejl}</small>}
    </div>
  );
}

function NyPostering({ konto, side, onTilfoej }: { konto: Konto; side: Side } & Pick<TKontoHandlinger, "onTilfoej">) {
  const [udtryk, setUdtryk] = useState("");
  const [fejl, setFejl] = useState<string | null>(null);

  const tilfoej = (event: FormEvent) => {
    event.preventDefault();
    if (!udtryk.trim()) return;
    const resultat = onTilfoej(konto.nummer, side, udtryk);
    setFejl(resultat);
    if (!resultat) setUdtryk("");
  };

  return (
    <form className="ny-postering" onSubmit={tilfoej}>
      <div className="ny-postering-felt">
        <input
          value={udtryk}
          inputMode="decimal"
          placeholder="Beløb/=formel"
          title="Skriv et beløb, f.eks. 12345,67, eller et regneudtryk, der starter med =, f.eks. =1000*1,25"
          aria-label={`${SIDENAVN[side]} beløb for ${konto.nummer} ${konto.navn}`}
          aria-invalid={fejl !== null}
          onChange={(event) => {
            setUdtryk(event.target.value);
            setFejl(null);
          }}
        />
        <button
          type="submit"
          className="tilfoej-postering"
          disabled={!udtryk.trim()}
          aria-label={`Bogfør i ${SIDENAVN[side].toLowerCase()} på ${konto.nummer} ${konto.navn}`}
          title="Bogfør beløbet"
        >
          +
        </button>
      </div>
      {fejl && <small className="feltfejl">{fejl}</small>}
    </form>
  );
}

export function TKonto({
  konto,
  saldo,
  posteringer,
  aktivtBilag,
  kanBogfoere,
  markeringer = {},
  children,
  afslutning,
  klasse,
  onTilfoej,
  onRet,
  onSlet,
}: TKontoProps) {
  // Saldoen efter sidste bilag står på den side, der gør summerne lige store (afsluttet T-konto).
  const afslutningsside = afslutning?.side === "debet" ? "kredit" : afslutning?.side === "kredit" ? "debet" : null;
  return (
    <article className={`tkonto${klasse ? ` ${klasse}` : ""}`} aria-label={`${konto.nummer} ${konto.navn}`}>
      {/* Kontonavnet står i direkte forlængelse af kontonummeret og ombrydes ved behov. */}
      <h3 className="tkonto-hoved">
        <span className="kontonummer">{konto.nummer}</span> {konto.navn}
      </h3>
      <div className="tkonto-sider" aria-hidden="true">
        <span>Debet</span>
        <span>Kredit</span>
      </div>
      <div className="tkonto-krop">
        {(["debet", "kredit"] as const).map((side) => (
          <div className={`tkonto-side ${side}`} key={side} data-side={side}>
            {saldo?.side === side && (
              <div className="postering er-saldo">
                <span>Saldo</span>
                <span className="beloeb">{formaterBeloeb(saldo.oere)}</span>
              </div>
            )}
            {posteringer
              .filter((postering) => postering.side === side)
              .sort((a, b) => a.bilag - b.bilag)
              .map((postering) =>
                postering.bilag === aktivtBilag && kanBogfoere ? (
                  <RedigerbarPostering
                    key={postering.id}
                    postering={postering}
                    markering={markeringer[postering.id]}
                    onRet={onRet}
                    onSlet={onSlet}
                  />
                ) : (
                  <div
                    key={postering.id}
                    className={`postering er-laast${markeringsklasse(markeringer[postering.id])}`}
                    data-markering={markeringer[postering.id]}
                    aria-label={`${SIDENAVN[postering.side]} ${formaterBeloeb(postering.oere)} fra bilag ${postering.bilag}${
                      markeringer[postering.id] ? ` (${MARKERINGSTEKST[markeringer[postering.id]]})` : ""
                    }`}
                  >
                    <span className="bilagsmaerke">B{postering.bilag}</span>
                    <span className="beloeb">{formaterBeloeb(postering.oere)}</span>
                  </div>
                ),
              )}
            {kanBogfoere && <NyPostering konto={konto} side={side} onTilfoej={onTilfoej} />}
            {afslutning && afslutningsside === side && (
              <div className="postering er-afslutning">
                <span>Saldo efter sidste bilag</span>
                <span className="beloeb">{formaterBeloeb(afslutning.oere)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {afslutning && (
        <div className="tkonto-sum" aria-label={`I alt ${formaterBeloeb(afslutning.sum)} på begge sider`}>
          <span className="beloeb">{formaterBeloeb(afslutning.sum)}</span>
          <span className="beloeb">{formaterBeloeb(afslutning.sum)}</span>
        </div>
      )}
      {children}
    </article>
  );
}
