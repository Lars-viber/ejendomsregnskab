import { useState } from "react";
import { Bogfoeringsbillede } from "./components/Bogfoeringsbillede";
import { Forside } from "./components/Forside";
import type { Opgave } from "./domain/opgave";
import { danOpgave } from "./generator/generator";
import type { Variant } from "./domain/variant";

export default function App() {
  const [opgave, setOpgave] = useState<Opgave | null>(null);

  // Årstallet er indeværende år og låses, når opgaven dannes (8.1).
  const start = (variant: Variant) => setOpgave(danOpgave(variant, new Date().getFullYear()));

  if (opgave) {
    return <Bogfoeringsbillede key={opgave.variant.nummer} opgave={opgave} onTilForside={() => setOpgave(null)} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Bogføring af ejendomsregnskaber</h1>
        <span className="topbar-info">Ejendomsselskabet Ejendommen A/S</span>
      </header>
      <Forside onStart={start} />
    </div>
  );
}
