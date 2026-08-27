import "server-only";
import { ligne } from "./db";
import { envoyerMail, gabarit, urlSite } from "./mail";
import { montant, dateFr } from "./metier";

type Demande = {
  id: number; reference: string; client_id: number; type: string;
  depart: string; arrivee: string; distance_km: number; date_souhaitee: string | null;
};

export async function mailDevisRecu(d: Demande, raisonSociale: string, prix: number, devise: string) {
  const c = await ligne<{ nom: string; email: string }>(
    `SELECT nom, email FROM utilisateurs WHERE id=$1`, [d.client_id]);
  if (!c) return;
  await envoyerMail(c.email, `Nouveau devis pour votre demande ${d.reference}`,
    gabarit("Vous avez reçu un devis",
      `<p>Bonjour ${c.nom},</p><p><b>${raisonSociale}</b> vous propose <b>${montant(prix, devise)}</b>
       pour votre demande <span style="font-family:monospace">${d.reference}</span>.</p>
       <p>Connectez-vous pour comparer les offres et accepter celle qui vous convient.</p>`,
      { texte: "Voir le devis", url: `${urlSite()}/demande/${d.id}` }));
}

export async function mailDevisAccepte(d: Demande, transporteurId: number, prix: number, devise: string) {
  const t = await ligne<{ email: string; nom: string; raison_sociale: string }>(
    `SELECT u.email, u.nom, t.raison_sociale FROM transporteurs t
     JOIN utilisateurs u ON u.id=t.utilisateur_id WHERE t.id=$1`, [transporteurId]);
  const c = await ligne<{ nom: string; telephone: string }>(
    `SELECT nom, telephone FROM utilisateurs WHERE id=$1`, [d.client_id]);
  if (!t) return;
  await envoyerMail(t.email, `Mission gagnée — ${d.reference}`,
    gabarit("Votre devis a été accepté",
      `<p>Bonjour ${t.nom},</p><p>Votre devis de <b>${montant(prix, devise)}</b> vient d'être accepté
       pour la demande <span style="font-family:monospace">${d.reference}</span>.</p>
       <p><b>Client :</b> ${c?.nom ?? "—"}${c?.telephone ? " — " + c.telephone : ""}<br>
       <b>Trajet :</b> ${d.depart} → ${d.arrivee}</p>
       <p>Prenez contact avec le client pour organiser l'enlèvement.</p>`,
      { texte: "Voir la mission", url: `${urlSite()}/espace/demandes` }));
}

export async function mailTransporteurVerifie(transporteurId: number) {
  const t = await ligne<{ email: string; nom: string; raison_sociale: string }>(
    `SELECT u.email, u.nom, t.raison_sociale FROM transporteurs t
     JOIN utilisateurs u ON u.id=t.utilisateur_id WHERE t.id=$1`, [transporteurId]);
  if (!t) return;
  await envoyerMail(t.email, "Votre entreprise est vérifiée",
    gabarit("Bienvenue sur ROUTIS",
      `<p>Bonjour ${t.nom},</p><p>Vos documents ont été contrôlés. <b>${t.raison_sociale}</b> est
       maintenant publiée dans l'annuaire et peut répondre aux demandes.</p>
       <p>Pensez à déclarer vos véhicules : les demandes qui vous seront proposées en dépendent.</p>`,
      { texte: "Voir les demandes", url: `${urlSite()}/espace/demandes` }));
}

export async function mailTransporteurRefuse(transporteurId: number, motif: string, suspendu = false) {
  const t = await ligne<{ email: string; nom: string }>(
    `SELECT u.email, u.nom FROM transporteurs t JOIN utilisateurs u ON u.id=t.utilisateur_id
     WHERE t.id=$1`, [transporteurId]);
  if (!t) return;
  await envoyerMail(t.email,
    suspendu ? "Votre entreprise a été suspendue" : "Votre dossier doit être complété",
    gabarit(suspendu ? "Entreprise suspendue" : "Dossier à compléter",
      `<p>Bonjour ${t.nom},</p>
       <p>${suspendu
          ? "Votre entreprise a été <b>suspendue</b> et retirée de l'annuaire."
          : "Votre dossier n'a pas pu être validé."}</p>
       ${motif ? `<p><b>Motif :</b> ${motif}</p>` : ""}
       <p>Corrigez les points signalés depuis votre espace, puis renvoyez votre dossier.</p>`,
      { texte: "Ouvrir mon espace", url: `${urlSite()}/espace/documents` }));
}

export async function mailDocumentRefuse(transporteurId: number, typeLisible: string, motif: string) {
  const t = await ligne<{ email: string; nom: string }>(
    `SELECT u.email, u.nom FROM transporteurs t JOIN utilisateurs u ON u.id=t.utilisateur_id
     WHERE t.id=$1`, [transporteurId]);
  if (!t) return;
  await envoyerMail(t.email, `Document refusé : ${typeLisible}`,
    gabarit("Un document doit être remplacé",
      `<p>Bonjour ${t.nom},</p><p>Le document « <b>${typeLisible}</b> » n'a pas été validé.</p>
       ${motif ? `<p><b>Motif :</b> ${motif}</p>` : ""}
       <p>Déposez une nouvelle version depuis votre espace.</p>`,
      { texte: "Déposer un document", url: `${urlSite()}/espace/documents` }));
}

export async function mailNouvelleDemande(
  d: Demande, villeDepart: number, villeArrivee: number,
  cible: number | null = null, limite = 25
) {
  /* Demande adressée : une seule entreprise est prévenue, celle que le client a
     choisie. Sinon, tous les transporteurs vérifiés du pays de départ qui
     proposent ce service. La règle est la même que celle de leur liste — sans
     quoi on annoncerait par e-mail une demande introuvable sur le site. */
  const cibles = cible
    ? await ligne<{ liste: { email: string }[] }>(
        `SELECT json_agg(json_build_object('email', u.email)) AS liste
         FROM transporteurs t JOIN utilisateurs u ON u.id=t.utilisateur_id
         WHERE t.id=$1 AND t.statut='verifie'`, [cible])
    : await ligne<{ liste: { email: string }[] }>(
        `SELECT json_agg(json_build_object('email', u.email)) AS liste FROM (
           SELECT DISTINCT u.email FROM transporteurs t
           JOIN utilisateurs u ON u.id=t.utilisateur_id
           WHERE t.statut='verifie'
             AND ( EXISTS (SELECT 1 FROM transporteur_services ts
                            WHERE ts.transporteur_id=t.id AND ts.service=$1)
                   OR NOT EXISTS (SELECT 1 FROM transporteur_services ts
                                   WHERE ts.transporteur_id=t.id) )
             AND t.pays = (SELECT pays FROM villes WHERE id=$2)
             AND ( (SELECT pays FROM villes WHERE id=$3) = t.pays
                   OR t.couverture = ANY(ARRAY['maghreb','europe','mondiale']) )
             AND ( NOT EXISTS (SELECT 1 FROM demande_destinataires dd WHERE dd.demande_id=$4)
                   OR EXISTS (SELECT 1 FROM demande_destinataires dd
                              WHERE dd.demande_id=$4 AND dd.transporteur_id=t.id) )
           LIMIT ${limite}
         ) u`, [d.type, villeDepart, villeArrivee, d.id]);
  const liste = cibles?.liste ?? [];
  const html = gabarit("Nouvelle demande à traiter",
    `<p>Une nouvelle demande vient d'être déposée :</p>
     <p><b>${d.depart} → ${d.arrivee}</b><br>${d.distance_km} km ·
     ${d.type === "fret" ? "Marchandises" : "Personnes"}
     ${d.date_souhaitee ? " · souhaitée le " + dateFr(d.date_souhaitee) : ""}</p>
     <p>${cible
        ? "Cette demande vous est adressée : le client vous a choisi dans l'annuaire."
        : "Le premier à proposer un prix a le plus de chances d'être retenu."}</p>`,
    { texte: "Répondre à la demande", url: `${urlSite()}/espace/demandes` });
  for (const c of liste) {
    await envoyerMail(c.email, `Nouvelle demande : ${d.depart} → ${d.arrivee}`, html);
  }
  return liste.length;
}
