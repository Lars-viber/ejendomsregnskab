import { useState } from "react";
import { Bogfoeringsbillede } from "./components/Bogfoeringsbillede";
import { Forside } from "./components/Forside";
import type { Opgave } from "./domain/opgave";
import { danProeveopgave } from "./domain/proeveopgave";
import type { Variant } from "./domain/variant";

export default function App() {
  const [opgave, setOpgave] = useState<Opgave | null>(null);

  // Indtil opgavegeneratoren findes (fase 3), åbnes den faste prøveopgave for momsstatus.
  const start = (variant: Variant) => setOpgave(danProeveopgave(variant));

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
