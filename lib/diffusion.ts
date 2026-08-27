import "server-only";
import { q } from "./db";

/**
 * Qui voit une demande — la règle, écrite une seule fois.
 *
 * Deux modes, au choix du client :
 *
 *   • Depuis la fiche d'une entreprise, la demande lui est adressée. Elle seule
 *     la reçoit. Personne d'autre ne la voit, même un concurrent qui
 *     correspondrait mieux.
 *
 *   • Depuis « Demander un devis », la demande part à tous les transporteurs
 *     vérifiés du pays de départ qui proposent le service demandé. Si le trajet
 *     franchit une frontière, seuls ceux dont la couverture déclarée dépasse
 *     leur pays la reçoivent : inutile de proposer un Alger → Marseille à une
 *     entreprise qui ne sort pas de sa wilaya. Si le client a coché des
 *     entreprises précises avant d'envoyer, seules celles-là la voient.
 *
 * Cette condition sert à la fois à la liste du transporteur, au compteur de
 * l'en-tête et au choix des destinataires de l'e-mail : les trois doivent dire
 * la même chose, sinon un transporteur reçoit un message pour une demande qu'il
 * ne trouvera pas en se connectant.
 *
 * Paramètres attendus, dans cet ordre :
 *   $1 identifiant du transporteur
 *   $2 ses services, en tableau de texte
 *   $3 son pays
 *   $4 sa couverture déclarée
 */

declare global {
  // eslint-disable-next-line no-var
  var __routisDestinatairesPrets: boolean | undefined;
}

/**
 * La table des destinataires choisis, créée si elle manque.
 *
 * Le site n'a pas de système de migrations : l'installation ne se joue qu'une
 * fois. Cette table est arrivée après, d'où cette vérification, faite une seule
 * fois par instance et sans effet si tout est déjà en place.
 */
export async function assurerDestinataires(): Promise<void> {
  if (global.__routisDestinatairesPrets) return;
  await q(`CREATE TABLE IF NOT EXISTS demande_destinataires (
     demande_id      INTEGER NOT NULL REFERENCES demandes(id) ON DELETE CASCADE,
     transporteur_id INTEGER NOT NULL REFERENCES transporteurs(id) ON DELETE CASCADE,
     PRIMARY KEY (demande_id, transporteur_id)
   )`);
  global.__routisDestinatairesPrets = true;
}

/** Les couvertures qui autorisent à sortir du pays. */
export const COUVERTURES_HORS_PAYS = ["maghreb", "europe", "mondiale"];

export const DEMANDE_VISIBLE = `(
    d.transporteur_cible = $1
    OR (
      d.transporteur_cible IS NULL
      AND (
        NOT EXISTS (SELECT 1 FROM demande_destinataires dd WHERE dd.demande_id = d.id)
        OR EXISTS (SELECT 1 FROM demande_destinataires dd
                   WHERE dd.demande_id = d.id AND dd.transporteur_id = $1)
      )
      AND d.type = ANY($2::text[])
      AND (SELECT v.pays FROM villes v WHERE v.id = d.ville_depart) = $3
      AND (
        (SELECT v.pays FROM villes v WHERE v.id = d.ville_arrivee) = $3
        OR $4 = ANY(ARRAY['maghreb','europe','mondiale'])
      )
    )
  )`;

/**
 * Combien d'entreprises verront la demande, avant même qu'elle soit écrite.
 *
 * Le client remplissait le formulaire sans savoir s'il s'adressait à une
 * entreprise ou à trente. La même condition que ci-dessus, comptée à l'avance.
 */
export type Destinataire = {
  id: number; raison_sociale: string; ville: string | null;
  note: string; nb_missions: number; couverture: string;
};

/**
 * Les entreprises qui recevront la demande, nommées avant l'envoi.
 *
 * Le client remplissait le formulaire sans savoir s'il s'adressait à une
 * entreprise ou à trente. Il les voit maintenant, et décoche celles qu'il
 * écarte.
 */
export async function listerDestinataires(
  type: string, paysDepart: string, international: boolean
): Promise<Destinataire[]> {
  try {
    return await q<Destinataire>(
      /* Une entreprise qui n'a déclaré aucun service est réputée faire les deux —
         c'est déjà la règle appliquée à sa propre liste de demandes. Sans cette
         tolérance, elle recevrait des demandes sans jamais figurer ici. */
      `SELECT t.id, t.raison_sociale, v.nom AS ville, t.note, t.couverture,
              (SELECT COUNT(*) FROM demandes d2
                JOIN devis q2 ON q2.demande_id=d2.id AND q2.transporteur_id=t.id
               WHERE d2.statut='terminee' AND q2.statut='accepte')::int AS nb_missions
         FROM transporteurs t
         LEFT JOIN villes v ON v.id=t.ville_id
        WHERE t.statut='verifie' AND t.pays=$2
          AND (
            EXISTS (SELECT 1 FROM transporteur_services ts
                     WHERE ts.transporteur_id=t.id AND ts.service=$1)
            OR NOT EXISTS (SELECT 1 FROM transporteur_services ts
                            WHERE ts.transporteur_id=t.id)
          )
          AND ($3::boolean = false OR t.couverture = ANY(ARRAY['maghreb','europe','mondiale']))
        ORDER BY t.note DESC, t.raison_sociale
        LIMIT 60`,
      [type, paysDepart, international]
    );
  } catch (e) {
    // Une liste indisponible ne doit pas empêcher de demander un devis, mais
    // elle ne doit pas non plus disparaître sans laisser de trace.
    console.error("listerDestinataires:", e);
    return [];
  }
}
