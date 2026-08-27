"use client";

import { useState, type ReactNode } from "react";

/**
 * Le choix « marchandises » ou « personnes », et la partie du formulaire qui
 * lui correspond.
 *
 * Les deux transports ne se décrivent pas de la même manière : un poids et des
 * palettes d'un côté, un nombre de passagers de l'autre. Afficher les deux
 * sections en même temps revenait à ne faire aucune différence entre une
 * cargaison et des voyageurs. Le choix est tenu ici, côté navigateur, pour que
 * la bascule soit immédiate : cocher change la section sans recharger la page.
 */
export default function ChoixTransport({
  defaut,
  commun,
  marchandises,
  personnes,
}: {
  defaut: "fret" | "pax";
  commun: ReactNode;
  marchandises: ReactNode;
  personnes: ReactNode;
}) {
  const [type, setType] = useState<"fret" | "pax">(defaut);

  return (
    <>
      <div className="champ">
        <label className="ch">Type de transport</label>
        <label className="coche">
          <input
            type="radio"
            name="type"
            value="fret"
            checked={type === "fret"}
            onChange={() => setType("fret")}
          />
          <span>Marchandises</span>
        </label>
        <label className="coche">
          <input
            type="radio"
            name="type"
            value="pax"
            checked={type === "pax"}
            onChange={() => setType("pax")}
          />
          <span>Personnes</span>
        </label>
      </div>

      {commun}
      {type === "fret" ? marchandises : personnes}
    </>
  );
}
