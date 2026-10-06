import { useState, type FormEvent, type ReactNode } from "react";
import { MOMSSTATUSSER, MOMSSTATUS_KNAP, type Momsstatus } from "../domain/momsstatus";
import { fortolkVariantnummer, nytVariantnummer, type Variant } from "../domain/variant";

/** Kontekst-teksten ordret fra Reference.docx afsnit 5. */
export const KONTEKST =
  "Du er ansat som administrativ medarbejder hos en ejendomsadministrator. Din opgave er at bogføre sædvanligt forekommende posteringer for Ejendomsselskabet Ejendommen A/S. Selskabet ejer og udlejer en investeringsejendom og har ingen andre aktiviteter. Du får udleveret en række T-konti og 20 bilag, som du skal bogføre på kontiene. Der er saldi på de fleste konti, da der er tale om et igangværende ejendomsselskab. Efter bogføring af hvert bilag trykker du [Kontroller] for at få kontrolleret, om bilaget er korrekt bogført. Du kan ikke gå videre til næste bilag, før det aktuelle bilag er korrekt bogført. Du kan altid gå tilbage og se tidligere bogførte bilag. Tidligere bogførte og kontrollerede bilag er låste og kan ikke ændres. Når alle bilag er bogført, skal du opgøre saldoen på T-kontiene og angive, om der er tale om en debet- eller kreditsaldo. Herefter er opgaven færdig, og du får en afsluttende oversigt med de afsluttede T-konti. Via [Vis bilag] kan du se alle bilag i et pop op-vindue. Ønsker du herefter en ny opgave, trykker du [Til forside].";

export const MOMSVALG_TEKST =
  "Vælg nedenfor, om ejendommen skal være momsfri, delvis momsregistreret eller fuldt momsregistreret.";

/** Fremhæver knapnavne som [Kontroller] uden at ændre teksten. */
function medKnapnavne(tekst: string): ReactNode[] {
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

interface ForsideProps {
  onStart: (variant: Variant) => void;
  senesteVarianter?: string[];
}

export function Forside({ onStart, senesteVarianter = [] }: ForsideProps) {
  const [momsstatus, setMomsstatus] = useState<Momsstatus | null>(null);
  const [variantTekst, setVariantTekst] = useState("");
  const [variantFejl, setVariantFejl] = useState<string | null>(null);

  const skiftVariantTekst = (tekst: string) => {
    setVariantTekst(tekst);
    setVariantFejl(null);
    const resultat = fortolkVariantnummer(tekst);
    // Variantnummeret bestemmer momsstatus, så valgknappen følger med.
    if (resultat.ok) setMomsstatus(resultat.variant.momsstatus);
  };

  const hentVariant = (event: FormEvent) => {
    event.preventDefault();
    const resultat = fortolkVariantnummer(variantTekst);
    if (!resultat.ok) {
      setVariantFejl(resultat.fejl);
      return;
    }
    setMomsstatus(resultat.variant.momsstatus);
    onStart(resultat.variant);
  };

  return (
    <main className="forside">
      <section className="kontekst" aria-labelledby="kontekst-titel">
        <h2 id="kontekst-titel">Opgaven</h2>
        <p>{medKnapnavne(KONTEKST)}</p>
      </section>

      <section className="momsvalg" aria-labelledby="momsvalg-titel">
        <h2 id="momsvalg-titel">Momsstatus</h2>
        <p>{MOMSVALG_TEKST}</p>
        <div className="momsknapper" role="radiogroup" aria-labelledby="momsvalg-titel">
          {MOMSSTATUSSER.map((status) => (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={momsstatus === status}
              className="momsknap"
              onClick={() => setMomsstatus(status)}
            >
              {MOMSSTATUS_KNAP[status]}
            </button>
          ))}
        </div>
      </section>

      <section className="start" aria-label="Start en opgave">
        <div className="start-ny">
          <button
            type="button"
            className="knap knap-primaer"
            disabled={momsstatus === null}
            onClick={() => momsstatus && onStart(nytVariantnummer(momsstatus, senesteVarianter))}
          >
            Ny opgave
          </button>
          <span className="hjaelpetekst">
            {momsstatus === null
              ? "Vælg momsstatus ovenfor for at danne en ny opgave."
              : `Danner en ny, tilfældig opgave: ${MOMSSTATUS_KNAP[momsstatus].toLowerCase()}.`}
          </span>
        </div>

        <form className="start-variant" onSubmit={hentVariant} noValidate>
          <label htmlFor="variantnummer">Variantnummer</label>
          <div className="variant-felt">
            <input
              id="variantnummer"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="fx 2483915"
              value={variantTekst}
              aria-invalid={variantFejl !== null}
              aria-describedby={variantFejl ? "variant-fejl" : undefined}
              onChange={(event) => skiftVariantTekst(event.target.value)}
            />
            <button type="submit" className="knap knap-sekundaer">
              Hent variant
            </button>
          </div>
          {variantFejl && (
            <small id="variant-fejl" className="feltfejl" role="alert">
              {variantFejl}
            </small>
          )}
        </form>
      </section>
    </main>
  );
}
