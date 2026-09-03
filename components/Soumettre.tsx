"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/* Un bouton d'envoi qui dit qu'il travaille.
 *
 * Deux sortes de formulaires cohabitent sur le site : ceux qui appellent une
 * action serveur — React connaît leur état par useFormStatus — et ceux qui
 * rechargent la page (les filtres de l'annuaire, par exemple), dont React ne
 * sait rien. On écoute donc aussi l'événement d'envoi du navigateur, sans quoi
 * la moitié des boutons resteraient muets pendant la seconde d'attente.
 */
export default function Soumettre({
  children,
  className,
  compact,
  ...reste
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }) {
  const { pending } = useFormStatus();
  const [envoye, setEnvoye] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const f = ref.current?.form;
    if (!f) return;
    const debut = () => setEnvoye(true);
    /* Revenu par le bouton « précédent », le bouton doit être de nouveau
       cliquable : la page est ressortie du cache telle qu'on l'avait laissée. */
    const fin = () => setEnvoye(false);
    f.addEventListener("submit", debut);
    window.addEventListener("pageshow", fin);
    return () => {
      f.removeEventListener("submit", debut);
      window.removeEventListener("pageshow", fin);
    };
  }, []);

  const occupe = pending || envoye;
  /* Sur un petit bouton, « Veuillez patienter… » ferait sauter toute la ligne :
     la rondelle suffit, le texte reste pour les lecteurs d'écran. */
  const petit = compact ?? /\bsm\b/.test(className ?? "");

  return (
    <button
      {...reste}
      ref={ref}
      type="submit"
      className={className}
      disabled={occupe || reste.disabled}
      aria-busy={occupe || undefined}
    >
      {occupe ? (
        <span className="en-cours">
          <span className="rondelle mini" aria-hidden="true" />
          {petit ? <span className="lu-seul">Veuillez patienter…</span> : "Veuillez patienter…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
