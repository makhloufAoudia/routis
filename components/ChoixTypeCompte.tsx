"use client";

import { useState } from "react";

/**
 * Choix visible du type de compte, en tête du formulaire d'inscription.
 *
 * Le type venait jusqu'ici de l'adresse seule : quelqu'un qui arrivait
 * directement sur /inscription obtenait un compte client sans savoir qu'un
 * compte professionnel existait — et le rôle ne peut plus changer ensuite.
 *
 * Sans JavaScript, les deux boutons radio fonctionnent quand même et le champ
 * « raison sociale » reste affiché : il n'est obligatoire que côté client, et
 * le serveur l'ignore pour un compte particulier.
 */
export default function ChoixTypeCompte({ defaut }: { defaut: "client" | "transporteur" }) {
  const [type, setType] = useState<"client" | "transporteur">(defaut);
  const pro = type === "transporteur";

  return (
    <>
      <fieldset className="choix-role">
        <legend>Quel compte voulez-vous créer ?</legend>
        <label>
          <input type="radio" name="type" value="client"
                 checked={!pro} onChange={() => setType("client")} />
          <span className="t">
            <b>J&apos;ai besoin d&apos;un transport</b>
            <span>Décrivez votre besoin, comparez les devis, choisissez.</span>
          </span>
        </label>
        <label>
          <input type="radio" name="type" value="transporteur"
                 checked={pro} onChange={() => setType("transporteur")} />
          <span className="t">
            <b>Je suis transporteur</b>
            <span>Publiez votre entreprise et répondez aux demandes.</span>
          </span>
        </label>
      </fieldset>

      <div className={"champ" + (pro ? "" : " si-pro")}>
        <label className="ch" htmlFor="raison_sociale">Raison sociale</label>
        <input id="raison_sociale" name="raison_sociale" required={pro}
               autoComplete="organization" placeholder=" " />
        <div className="aide">Le nom exact figurant sur votre registre de commerce.</div>
      </div>
    </>
  );
}
