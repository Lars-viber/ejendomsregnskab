import { useEffect, useRef } from "react";

interface BekraeftelseProps {
  titel: string;
  tekst: string;
  bekraeftTekst: string;
  annullerTekst: string;
  onBekraeft: () => void;
  onAnnuller: () => void;
}

/** Enkel dialog, der beder den studerende bekræfte en handling (som i reference-applikationen). */
export function Bekraeftelse({ titel, tekst, bekraeftTekst, annullerTekst, onBekraeft, onAnnuller }: BekraeftelseProps) {
  const annullerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    annullerRef.current?.focus();
    const tast = (event: KeyboardEvent) => {
      if (event.key === "Escape") onAnnuller();
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [onAnnuller]);

  return (
    <div className="dialog-baggrund">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-titel" aria-describedby="dialog-tekst">
        <h2 id="dialog-titel">{titel}</h2>
        <p id="dialog-tekst">{tekst}</p>
        <div className="dialog-knapper">
          <button ref={annullerRef} type="button" className="knap knap-sekundaer" onClick={onAnnuller}>
            {annullerTekst}
          </button>
          <button type="button" className="knap knap-fare" onClick={onBekraeft}>
            {bekraeftTekst}
          </button>
        </div>
      </div>
    </div>
  );
}
