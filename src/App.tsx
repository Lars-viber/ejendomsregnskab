import { useEffect, useMemo, useState } from "react";
import { Bekraeftelse } from "./components/Bekraeftelse";
import { Bogfoeringsbillede } from "./components/Bogfoeringsbillede";
import { Forside } from "./components/Forside";
import { fortolkVariantnummer, type Variant } from "./domain/variant";
import { danOpgave } from "./generator/generator";
import {
  gemSession,
  huskVariant,
  indlaesSession,
  nySession,
  senesteVarianter,
  type Session,
} from "./session/session";

function variantFra(nummer: string): Variant {
  const resultat = fortolkVariantnummer(nummer);
  if (!resultat.ok) throw new Error(resultat.fejl);
  return resultat.variant;
}

export default function App() {
  // Fremskridt gemmes i browseren og indlæses igen, når siden åbnes (Reference.docx afsnit 4).
  const [session, setSession] = useState<Session | null>(() => indlaesSession());
  const [visning, setVisning] = useState<"forside" | "opgave">("forside");
  const [afventer, setAfventer] = useState<Variant | null>(null);

  // Opgaven dannes igen ud fra variantnummer og det låste årstal (8.1).
  const opgave = useMemo(
    () => (session ? danOpgave(variantFra(session.variant), session.aar) : null),
    [session?.variant, session?.aar],
  );

  useEffect(() => {
    if (session) gemSession(session);
  }, [session]);

  const startNy = (variant: Variant) => {
    huskVariant(variant.nummer);
    setSession(nySession(variant, new Date().getFullYear()));
    setAfventer(null);
    setVisning("opgave");
  };

  const start = (variant: Variant) => {
    if (session && session.variant === variant.nummer) {
      setVisning("opgave"); // samme variant: fortsæt den igangværende opgave
    } else if (session) {
      setAfventer(variant); // spørg først, om den igangværende opgave må slettes
    } else {
      startNy(variant);
    }
  };

  if (visning === "opgave" && session && opgave) {
    return (
      <Bogfoeringsbillede
        key={`${session.variant}-${session.aar}`}
        opgave={opgave}
        session={session}
        onSessionChange={setSession}
        onTilForside={() => setVisning("forside")}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Bogføring af ejendomsregnskaber</h1>
        <span className="topbar-info">Ejendomsselskabet Ejendommen A/S</span>
      </header>
      <Forside
        onStart={start}
        senesteVarianter={senesteVarianter()}
        igangvaerende={
          session
            ? { variant: session.variant, momsstatus: variantFra(session.variant).momsstatus, godkendte: session.godkendte.length }
            : null
        }
        onFortsaet={() => setVisning("opgave")}
      />
      {afventer && session && (
        <Bekraeftelse
          titel="Slet den igangværende opgave?"
          tekst={`Du har en igangværende opgave (variant ${session.variant}, ${session.godkendte.length} af 20 bilag godkendt). Hvis du starter en ny opgave (variant ${afventer.nummer}), slettes al bogføring i den igangværende opgave. Variantnummeret kan bruges til at hente opgaven igen fra start.`}
          bekraeftTekst="Slet og start ny opgave"
          annullerTekst="Behold den igangværende opgave"
          onBekraeft={() => startNy(afventer)}
          onAnnuller={() => setAfventer(null)}
        />
      )}
    </div>
  );
}
