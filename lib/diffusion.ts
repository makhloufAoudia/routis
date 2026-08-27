import "server-only";

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
 *     entreprise qui ne sort pas de sa wilaya.
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

/** Les couvertures qui autorisent à sortir du pays. */
export const COUVERTURES_HORS_PAYS = ["maghreb", "europe", "mondiale"];

export const DEMANDE_VISIBLE = `(
    d.transporteur_cible = $1
    OR (
      d.transporteur_cible IS NULL
      AND d.type = ANY($2::text[])
      AND (SELECT v.pays FROM villes v WHERE v.id = d.ville_depart) = $3
      AND (
        (SELECT v.pays FROM villes v WHERE v.id = d.ville_arrivee) = $3
        OR $4 = ANY(ARRAY['maghreb','europe','mondiale'])
      )
    )
  )`;
