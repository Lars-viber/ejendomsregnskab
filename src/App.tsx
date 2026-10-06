import { useState } from "react";
import { Forside } from "./components/Forside";
import { MOMSSTATUS_BESKRIVELSE } from "./domain/momsstatus";
import type { Variant } from "./domain/variant";

export default function App() {
  const [valgtVariant, setValgtVariant] = useState<Variant | null>(null);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Bogføring af ejendomsregnskaber</h1>
        <span className="topbar-info">Ejendomsselskabet Ejendommen A/S</span>
      </header>
      <Forside onStart={setValgtVariant} />
      {valgtVariant && (
        <div className="besked" role="status">
          <span>
            Opgave med variantnummer <strong>{valgtVariant.nummer}</strong> (
            {MOMSSTATUS_BESKRIVELSE[valgtVariant.momsstatus]}) er valgt. Bogføringsbilledet kommer i
            næste fase.
          </span>
          <button type="button" className="knap knap-sekundaer knap-lille" onClick={() => setValgtVariant(null)}>
            Luk
          </button>
        </div>
      )}
    </div>
  );
}
