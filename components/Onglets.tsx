"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Les onglets, avec celui de la page en cours mis en évidence.
 *
 * « Marchandises » et « Personnes » mènent à la même adresse et ne se
 * distinguent que par le paramètre : impossible de savoir lequel est actif sans
 * lire aussi la requête, d'où ce composant côté navigateur.
 */
export default function Onglets() {
  const chemin = usePathname();
  const requete = useSearchParams();
  const type = requete.get("type") === "pax" ? "pax" : "fret";

  const onglets = [
    { href: "/annuaire", texte: "Annuaire", actif: chemin.startsWith("/annuaire") },
    { href: "/devis?type=fret", texte: "Marchandises", actif: chemin === "/devis" && type === "fret" },
    { href: "/devis?type=pax", texte: "Personnes", actif: chemin === "/devis" && type === "pax" },
  ];

  return (
    <nav className="tabs" aria-label="Sections principales">
      <div className="tabs-in">
        {onglets.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className={o.actif ? "on" : undefined}
            aria-current={o.actif ? "page" : undefined}
          >
            {o.texte}
          </Link>
        ))}
      </div>
    </nav>
  );
}
