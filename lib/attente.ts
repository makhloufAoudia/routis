import "server-only";
import { compter, ligne } from "./db";
import { DEMANDE_VISIBLE } from "./diffusion";
import type { Utilisateur } from "./auth";

/**
 * Ce qui attend l'utilisateur, sans qu'il ait à le chercher.
 *
 * Tant que les e-mails ne partent pas, c'est le seul signal : sans ce compteur,
 * un transporteur devrait ouvrir « Demandes à traiter » au hasard pour découvrir
 * qu'une demande l'attend depuis trois jours.
 */
export type Attente = { nombre: number; lien: string; libelle: string } | null;

export async function enAttente(u: Utilisateur | null): Promise<Attente> {
  if (!u) return null;
  try {
    if (u.role === "admin") {
      const n = await compter(
        `SELECT (SELECT COUNT(*) FROM documents WHERE statut='en_attente')
              + (SELECT COUNT(*) FROM transporteurs WHERE statut='en_attente')`
      );
      return n ? { nombre: n, lien: "/admin", libelle: "dossier(s) à contrôler" } : null;
    }

    if (u.role === "transporteur") {
      // Les demandes que ce transporteur peut encore prendre : ouvertes, dans un
      // service qu'il propose, et auxquelles il n'a pas déjà répondu.
      const t = await ligne<{ id: number; pays: string; couverture: string; services: string[] }>(
        `SELECT t.id, t.pays, t.couverture,
                COALESCE(array_agg(ts.service) FILTER (WHERE ts.service IS NOT NULL),
                         ARRAY['fret','pax']) AS services
         FROM transporteurs t
         LEFT JOIN transporteur_services ts ON ts.transporteur_id=t.id
         WHERE t.utilisateur_id=$1 AND t.statut='verifie'
         GROUP BY t.id, t.pays, t.couverture`, [u.id]);
      if (!t) return null;
      const n = await compter(
        `SELECT COUNT(*) FROM demandes d
         WHERE d.statut IN ('ouverte','devis')
           AND ${DEMANDE_VISIBLE}
           AND NOT EXISTS (SELECT 1 FROM devis q WHERE q.demande_id=d.id AND q.transporteur_id=$1)`,
        [t.id, t.services, t.pays, t.couverture]
      );
      return n ? { nombre: n, lien: "/espace/demandes", libelle: "demande(s) à traiter" } : null;
    }

    const n = await compter(
      `SELECT COUNT(*) FROM demandes WHERE client_id=$1 AND statut='devis'`, [u.id]);
    return n ? { nombre: n, lien: "/mes-demandes", libelle: "demande(s) avec des devis à comparer" } : null;
  } catch {
    // Base absente ou site non installé : l'en-tête doit s'afficher quand même.
    return null;
  }
}
