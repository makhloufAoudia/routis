"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Sur petit écran, les liens de l'en-tête se replient derrière un bouton.
 * Au-dessus de 760 px, le bouton disparaît et les liens reprennent leur place :
 * c'est la feuille de style qui décide, pas ce composant.
 *
 * Sans JavaScript, une règle <noscript> rouvre les liens en permanence — mieux
 * vaut un en-tête un peu haut qu'un menu qui ne s'ouvre pas.
 */
export default function MenuCompact({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();

  // Refermer après une navigation, sinon le menu reste ouvert sur la page suivante.
  useEffect(() => { setOuvert(false); }, [chemin]);

  return (
    <>
      <button
        type="button"
        className="menu-b"
        aria-expanded={ouvert}
        aria-controls="menu-principal"
        aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOuvert((o) => !o)}
      >
        <span aria-hidden="true">{ouvert ? "✕" : "☰"}</span>
      </button>
      <nav className={"gnav" + (ouvert ? " ouvert" : "")} id="menu-principal">
        {children}
      </nav>
    </>
  );
}
