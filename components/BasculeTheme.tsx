"use client";

import { useEffect, useState } from "react";

type Choix = "clair" | "sombre" | null;

/**
 * Bouton clair / sombre.
 *
 * Sans choix explicite, le site suit le réglage du système : quelqu'un dont le
 * téléphone passe en sombre le soir voit le site suivre, sans rien demander.
 * Le bouton n'existe que pour ceux qui veulent contredire ce réglage, et son
 * choix est retenu d'une visite à l'autre.
 */
export default function BasculeTheme() {
  const [choix, setChoix] = useState<Choix>(null);
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    setMonte(true);
    try {
      const v = localStorage.getItem("routis-theme");
      if (v === "clair" || v === "sombre") setChoix(v);
    } catch { /* navigation privée : on suit le système */ }
  }, []);

  function basculer() {
    const systemeSombre =
      typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
    const actuel = choix ?? (systemeSombre ? "sombre" : "clair");
    const suivant: Choix = actuel === "sombre" ? "clair" : "sombre";
    setChoix(suivant);
    document.documentElement.dataset.theme = suivant;
    try { localStorage.setItem("routis-theme", suivant); } catch { /* sans effet */ }
  }

  // Avant l'activation de la page, on ne sait pas quel thème est appliqué :
  // on réserve la place sans rien affirmer, pour éviter un libellé faux.
  const sombre = monte && (choix === "sombre" ||
    (choix === null && typeof matchMedia === "function" &&
     matchMedia("(prefers-color-scheme: dark)").matches));

  return (
    <button
      type="button"
      className="bascule"
      onClick={basculer}
      aria-label={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
      title={sombre ? "Mode clair" : "Mode sombre"}
    >
      <span aria-hidden="true">{monte ? (sombre ? "☀" : "☾") : "☾"}</span>
    </button>
  );
}
