import { useMemo, useState } from "react";
import { fortolkBeloeb } from "../domain/beloeb";
import { aktueltBilag, kanBogfoerePaa, kanVaelgeBilag, naesteBilag } from "../domain/fremdrift";
import type { Konto } from "../domain/kontoplan";
import { kontrollerBilag, type Kontrolresultat } from "../domain/kontrol";
import { MOMSSTATUS_KNAP } from "../domain/momsstatus";
import { ANTAL_BILAG, synligeKonti, type Opgave, type Postering, type Side } from "../domain/opgave";
import type { Session } from "../session/session";
import { TKonto, type PosteringsMarkering, type TKontoHandlinger } from "./TKonto";

interface BogfoeringsbilledeProps {
  opgave: Opgave;
  session: Session;
  onSessionChange: (session: Session) => void;
  onTilForside: () => void;
}

type Besked = { slags: "korrekt" | "forkert" | "info"; titel: string; linjer: string[] };

export function Statusbar({
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
        const kanVaelges = kanVaelgeBilag(opgave, godkendte, nummer);
        const godkendt = godkendte.includes(nummer);
        const vist = nummer === vistBilag;
        const status = godkendt ? "godkendt" : nummer === aktuelt ? "aktuelt bilag" : "ikke tilgængeligt endnu";
        return (
          <button
            key={nummer}
            type="button"
            className={[godkendt && "er-godkendt", nummer === aktuelt && "er-aktuelt", vist && "er-vist"].filter(Boolean).join(" ")}
            disabled={!kanVaelges}
            aria-current={vist ? "step" : undefined}
            aria-label={`Bilag ${nummer}, ${status}${vist ? ", vises" : ""}`}
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
  markeringer,
  handlinger,
}: {
  id: string;
  titel: string;
  konti: Konto[];
  opgave: Opgave;
  posteringer: Postering[];
  vistBilag: number;
  kanBogfoere: boolean;
  markeringer: Record<string, PosteringsMarkering>;
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
            markeringer={markeringer}
            {...handlinger}
          />
        ))}
      </div>
    </section>
  );
}

/** Nyt, entydigt id til en postering. */
function nytId(posteringer: Postering[]): string {
  const hoejeste = posteringer.reduce((maks, p) => Math.max(maks, Number(p.id.replace(/\D/g, "")) || 0), 0);
  return `p${hoejeste + 1}`;
}

export function Bogfoeringsbillede({ opgave, session, onSessionChange, onTilForside }: BogfoeringsbilledeProps) {
  const { posteringer, godkendte, vistBilag, nyligtGodkendt } = session;
  const [kontrol, setKontrol] = useState<{ bilag: number; resultat: Kontrolresultat } | null>(null);
  const [besked, setBesked] = useState<Besked | null>(null);
  const konti = useMemo(() => synligeKonti(opgave.variant.momsstatus), [opgave]);
  const bilag = opgave.bilag.find((b) => b.nummer === vistBilag) ?? opgave.bilag[0];
  const aktuelt = aktueltBilag(opgave, godkendte);
  const kanBogfoere = kanBogfoerePaa(opgave, godkendte, vistBilag);
  const naeste = naesteBilag(opgave, godkendte, vistBilag);
  const vistGodkendt = godkendte.includes(vistBilag);
  const alleGodkendt = godkendte.length === ANTAL_BILAG;

  const opdater = (aendring: Partial<Session>) =>
    onSessionChange({ ...session, ...aendring, opdateret: new Date().toISOString() });

  // Enhver ændring på bilaget fjerner den gamle kontrol (farver og hjælpetekst).
  const nulstilKontrol = () => {
    setKontrol(null);
    setBesked(null);
  };

  const handlinger: TKontoHandlinger = {
    onTilfoej: (konto: number, side: Side, udtryk: string) => {
      if (!kanBogfoere) return "Bilaget er låst.";
      const resultat = fortolkBeloeb(udtryk);
      if (!resultat.ok) return resultat.fejl;
      const ny: Postering = { id: nytId(posteringer), bilag: vistBilag, konto, side, udtryk: udtryk.trim(), oere: resultat.oere };
      opdater({ posteringer: [...posteringer, ny] });
      nulstilKontrol();
      return null;
    },
    onRet: (id: string, udtryk: string) => {
      if (!kanBogfoere) return "Bilaget er låst.";
      const resultat = fortolkBeloeb(udtryk);
      if (!resultat.ok) return resultat.fejl;
      opdater({ posteringer: posteringer.map((p) => (p.id === id ? { ...p, udtryk: udtryk.trim(), oere: resultat.oere } : p)) });
      nulstilKontrol();
      return null;
    },
    onSlet: (id: string) => {
      if (!kanBogfoere) return;
      opdater({ posteringer: posteringer.filter((p) => p.id !== id) });
      nulstilKontrol();
    },
  };

  const kontroller = () => {
    if (!kanBogfoere) return;
    const resultat = kontrollerBilag(bilag.facit, posteringer.filter((p) => p.bilag === bilag.nummer));
    setKontrol({ bilag: bilag.nummer, resultat });
    if (resultat.korrekt) {
      // 7.2: et korrekt bilag godkendes og låses; der går først videre ved [Næste bilag].
      opdater({ godkendte: [...godkendte, bilag.nummer], nyligtGodkendt: bilag.nummer });
      const sidste = bilag.nummer === ANTAL_BILAG;
      setBesked({
        slags: "korrekt",
        titel: `Bilag ${bilag.nummer} er korrekt bogført.`,
        linjer: [sidste ? "Alle 20 bilag er bogført. Tryk [Til saldiopgørelse]." : "Tryk [Næste bilag] for at fortsætte."],
      });
    } else {
      setBesked({ slags: "forkert", titel: `Bilag ${bilag.nummer} er ikke korrekt bogført endnu.`, linjer: resultat.hjaelpetekster });
    }
  };

  const gaaTil = (nummer: number, aendring: Partial<Session> = {}) => {
    if (!kanVaelgeBilag(opgave, godkendte, nummer)) return;
    opdater({ vistBilag: nummer, ...aendring });
    setBesked(null);
  };

  // Markeringer: grøn/rød efter kontrol, grøn for det netop godkendte bilag, fremhævet ved visning.
  const markeringer: Record<string, PosteringsMarkering> = {};
  for (const p of posteringer) {
    if (p.bilag !== vistBilag) continue;
    if (kontrol?.bilag === vistBilag && !vistGodkendt) markeringer[p.id] = kontrol.resultat.posteringer[p.id];
    else if (vistBilag === nyligtGodkendt) markeringer[p.id] = "korrekt";
    else if (vistGodkendt) markeringer[p.id] = "fremhaevet";
  }

  const instruktion =
    vistBilag === nyligtGodkendt
      ? naeste !== null
        ? "Bilaget er korrekt bogført. Tryk [Næste bilag]"
        : "Alle bilag er korrekt bogført. Tryk [Til saldiopgørelse]"
      : alleGodkendt
        ? "Alle bilag er bogført. Tryk [Til saldiopgørelse]"
      : vistGodkendt
        ? `Tidligere bilag – kun visning. Aktuelt bilag: ${aktuelt ?? ANTAL_BILAG}`
        : "Bogfør bilaget og tryk [Kontroller]";

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
            <button type="button" className="knap knap-primaer" disabled={!kanBogfoere} onClick={kontroller}>
              Kontroller
            </button>
            {alleGodkendt ? (
              <button type="button" className="knap knap-primaer" onClick={() => opdater({ fase: "saldi", nyligtGodkendt: null })}>
                Til saldiopgørelse
              </button>
            ) : (
              <button
                type="button"
                className="knap knap-sekundaer"
                disabled={naeste === null}
                title={naeste === null ? "Bilaget skal være korrekt bogført og kontrolleret, før du kan gå videre." : undefined}
                onClick={() => naeste !== null && gaaTil(naeste, { nyligtGodkendt: null })}
              >
                Næste bilag
              </button>
            )}
            <button type="button" className="knap knap-sekundaer" onClick={onTilForside}>
              Til forside
            </button>
            {/* Midlertidig testmulighed – findes kun i den lokale udgave (pnpm dev), aldrig på GitHub Pages. */}
            {import.meta.env.DEV && (
              <button
                type="button"
                className="knap knap-test"
                title="Kun lokal test: bogfører alle 20 bilag med facit og går til saldiopgørelsen"
                onClick={() =>
                  opdater({
                    posteringer: opgave.bilag.flatMap((b) =>
                      b.facit.map((l, i) => ({ id: `t${b.nummer}-${i}`, bilag: b.nummer, konto: l.konto, side: l.side, udtryk: String(l.oere / 100).replace(".", ","), oere: l.oere })),
                    ),
                    godkendte: opgave.bilag.map((b) => b.nummer),
                    vistBilag: ANTAL_BILAG,
                    nyligtGodkendt: null,
                    fase: "saldi",
                  })
                }
              >
                Test: til saldiopgørelse
              </button>
            )}
          </div>
        </div>
        <p className={`bilagstekst${vistGodkendt ? " er-godkendt" : ""}`} aria-live="polite">
          <strong>
            Bilag {bilag.nummer} af {ANTAL_BILAG}:
          </strong>{" "}
          {bilag.tekst}
        </p>
        <div className="boks1-bund">
          <Statusbar opgave={opgave} godkendte={godkendte} vistBilag={vistBilag} onVaelg={(n) => gaaTil(n)} />
          <p className="instruktion">{medKnapnavne(instruktion)}</p>
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
          markeringer={markeringer}
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
          markeringer={markeringer}
          handlinger={handlinger}
        />
      </div>

      {besked && (
        <div className={`besked besked-${besked.slags}`} role={besked.slags === "forkert" ? "alert" : "status"}>
          <div>
            <strong>{besked.titel}</strong>
            {besked.linjer.length === 1 ? (
              <span> {medKnapnavne(besked.linjer[0])}</span>
            ) : (
              <ul>
                {besked.linjer.map((linje) => (
                  <li key={linje}>{linje}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="knap knap-sekundaer knap-lille" onClick={() => setBesked(null)}>
            Luk
          </button>
        </div>
      )}
    </div>
  );
}

/** Fremhæver knapnavne som [Næste bilag]. */
export function medKnapnavne(tekst: string) {
  return tekst.split(/(\[[^\]]+\])/g).map((del, i) =>
    /^\[[^\]]+\]$/.test(del) ? (
      <span key={i} className="knapnavn">
        {del}
      </span>
    ) : (
      del
    ),
  );
}
