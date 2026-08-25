import Link from "next/link";
import { exigerRole, monTransporteur } from "@/lib/auth";
import { q, compter } from "@/lib/db";
import { DOCUMENTS_REQUIS } from "@/lib/metier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon espace transporteur" };

export default async function Page() {
  await exigerRole("transporteur", "/espace");
  const t = await monTransporteur();
  if (!t) return <div className="msg err">Fiche entreprise introuvable.</div>;

  const docs = await q<{ type: string; statut: string }>(
    `SELECT type, statut FROM documents WHERE transporteur_id=$1`, [t.id]);
  const valides = new Set(docs.filter((d) => d.statut === "valide").map((d) => d.type));
  const manquants = Object.keys(DOCUMENTS_REQUIS).filter((k) => !valides.has(k));

  const [nbVeh, nbDem, nbDev, nbAcc] = await Promise.all([
    compter(`SELECT COUNT(*) FROM vehicules WHERE transporteur_id=$1`, [t.id]),
    compter(`SELECT COUNT(*) FROM demandes d WHERE d.statut IN ('ouverte','devis')
             AND NOT EXISTS (SELECT 1 FROM devis q WHERE q.demande_id=d.id AND q.transporteur_id=$1)`, [t.id]),
    compter(`SELECT COUNT(*) FROM devis WHERE transporteur_id=$1`, [t.id]),
    compter(`SELECT COUNT(*) FROM devis WHERE transporteur_id=$1 AND statut='accepte'`, [t.id]),
  ]);

  return (
    <>
      <h1>Bonjour, {t.raison_sociale}</h1>

      {t.statut === "verifie" && (
        <div className="msg ok">
          Votre entreprise est <b>vérifiée</b> et visible dans l&apos;annuaire public.{" "}
          <Link href={`/transporteur/${t.id}`}>Voir ma fiche</Link>
        </div>
      )}
      {t.statut === "en_attente" && (
        <div className="msg att">
          Dossier <b>en cours de vérification</b>. Vous recevrez une réponse après contrôle des pièces.
        </div>
      )}
      {t.statut === "refuse" && (
        <div className="msg err">
          Dossier <b>refusé</b>{t.motif_refus ? " : " + t.motif_refus : ""}. Corrigez les points
          signalés puis renvoyez votre dossier.
        </div>
      )}
      {t.statut === "suspendu" && (
        <div className="msg err">Compte <b>suspendu</b>. Contactez l&apos;administration.</div>
      )}
      {t.statut === "brouillon" && (
        <div className="msg info">
          Votre fiche est en <b>brouillon</b>. Complétez-la et déposez vos documents pour être publié.
        </div>
      )}

      <div className="stat">
        <div><span className="k">Demandes à traiter</span><span className="v">{nbDem}</span></div>
        <div><span className="k">Devis envoyés</span><span className="v">{nbDev}</span></div>
        <div><span className="k">Devis acceptés</span><span className="v">{nbAcc}</span></div>
        <div><span className="k">Véhicules</span><span className="v">{nbVeh}</span></div>
      </div>

      <div className="grille g3">
        <div className="carte">
          <h3>1. Fiche entreprise</h3>
          <p className="small muted">Raison sociale, ville, services, description publique.</p>
          <Link className="btn sec sm" href="/espace/profil">Compléter</Link>
        </div>
        <div className="carte">
          <h3>2. Documents{" "}
            {manquants.length > 0
              ? <span className="tag att">{manquants.length} manquant(s)</span>
              : <span className="tag ok">complet</span>}
          </h3>
          <p className="small muted">Registre, licence, assurance, contrôle technique.</p>
          <Link className="btn sec sm" href="/espace/documents">Déposer</Link>
        </div>
        <div className="carte">
          <h3>3. Véhicules</h3>
          <p className="small muted">Déclarez votre flotte pour recevoir les bonnes demandes.</p>
          <Link className="btn sec sm" href="/espace/vehicules">Gérer</Link>
        </div>
        <div className="carte">
          <h3>4. Demandes</h3>
          <p className="small muted">Consultez les demandes et envoyez vos prix.</p>
          <Link className="btn sm" href="/espace/demandes">Voir les demandes</Link>
        </div>
      </div>
    </>
  );
}
