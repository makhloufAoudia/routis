import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerConnexion, utilisateur } from "@/lib/auth";
import { q, ligne, journal } from "@/lib/db";
import { STATUTS_DEMANDE, EQUIPEMENTS, montant, dateFr, noteAffichee, initiales } from "@/lib/metier";
import { mailDevisAccepte } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type Demande = {
  id: number; reference: string; client_id: number; type: string;
  ville_depart: number; distance_km: number; date_souhaitee: string | null;
  nature: string; poids_kg: number | null; volume_m3: string | null;
  palettes: number | null; passagers: number | null; equipements: string;
  precisions: string | null; statut: string; cree_le: string;
  depart: string; arrivee: string;
};

async function charger(id: number) {
  return await ligne<Demande>(
    /* Le pays n'apparaît que lorsque le trajet en franchit un : « Alger →
       Marseille (France) » se lit mieux que « Alger (Algérie) → Oran (Algérie) ». */
    `SELECT d.*, CASE WHEN vd.pays <> va.pays THEN vd.nom || ' (' || ppd.nom || ')' ELSE vd.nom END AS depart,
            CASE WHEN vd.pays <> va.pays THEN va.nom || ' (' || ppa.nom || ')' ELSE va.nom END AS arrivee
     FROM demandes d
     JOIN villes vd ON vd.id=d.ville_depart
     JOIN villes va ON va.id=d.ville_arrivee
     JOIN pays ppd ON ppd.code=vd.pays
     JOIN pays ppa ON ppa.code=va.pays
     WHERE d.id=$1`, [id]);
}

/** Contrôle systématique : l'action ne fait rien sans propriété vérifiée côté serveur. */
async function demandeDuClient(id: number) {
  const u = await utilisateur();
  if (!u) redirect("/connexion");
  const d = await charger(id);
  if (!d || d.client_id !== u.id) throw new Error("Action non autorisée.");
  return { u, d };
}

async function accepter(formData: FormData) {
  "use server";
  const id = parseInt(String(formData.get("demande_id") ?? ""), 10) || 0;
  const devisId = parseInt(String(formData.get("devis_id") ?? ""), 10) || 0;
  const { u, d } = await demandeDuClient(id);

  const dv = await ligne<{ id: number; transporteur_id: number; prix: string; devise: string }>(
    `SELECT * FROM devis WHERE id=$1 AND demande_id=$2`, [devisId, id]);
  if (dv && d.statut !== "acceptee" && d.statut !== "terminee") {
    await q(`UPDATE devis SET statut='refuse' WHERE demande_id=$1`, [id]);
    await q(`UPDATE devis SET statut='accepte' WHERE id=$1`, [devisId]);
    await q(`UPDATE demandes SET statut='acceptee' WHERE id=$1`, [id]);
    await q(`UPDATE transporteurs SET nb_missions = nb_missions + 1 WHERE id=$1`, [dv.transporteur_id]);
    await journal("devis_accepte", "devis#" + devisId, d.reference, u.id);
    await mailDevisAccepte(d, dv.transporteur_id, parseFloat(dv.prix), dv.devise);
  }
  revalidatePath(`/demande/${id}`);
  redirect(`/demande/${id}`);
}

async function terminer(formData: FormData) {
  "use server";
  const id = parseInt(String(formData.get("demande_id") ?? ""), 10) || 0;
  const { u, d } = await demandeDuClient(id);
  if (d.statut === "acceptee") {
    await q(`UPDATE demandes SET statut='terminee' WHERE id=$1`, [id]);
    await journal("mission_terminee", "demande#" + id, d.reference, u.id);
  }
  revalidatePath(`/demande/${id}`);
  redirect(`/demande/${id}`);
}

async function annuler(formData: FormData) {
  "use server";
  const id = parseInt(String(formData.get("demande_id") ?? ""), 10) || 0;
  const { u, d } = await demandeDuClient(id);
  if (d.statut === "ouverte" || d.statut === "devis") {
    await q(`UPDATE demandes SET statut='annulee' WHERE id=$1`, [id]);
    await q(`UPDATE devis SET statut='refuse' WHERE demande_id=$1 AND statut='envoye'`, [id]);
    await journal("demande_annulee", "demande#" + id, d.reference, u.id);
  }
  revalidatePath(`/demande/${id}`);
  redirect(`/demande/${id}`);
}

async function noter(formData: FormData) {
  "use server";
  const id = parseInt(String(formData.get("demande_id") ?? ""), 10) || 0;
  const note = parseInt(String(formData.get("note") ?? ""), 10) || 0;
  const { u, d } = await demandeDuClient(id);

  const gagnant = await ligne<{ transporteur_id: number }>(
    `SELECT transporteur_id FROM devis WHERE demande_id=$1 AND statut='accepte'`, [id]);
  const deja = await ligne(`SELECT id FROM avis WHERE demande_id=$1`, [id]);

  if (d.statut === "terminee" && gagnant && !deja && note >= 1 && note <= 5) {
    await q(
      `INSERT INTO avis (demande_id, transporteur_id, client_id, note, commentaire)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, gagnant.transporteur_id, u.id, note, String(formData.get("commentaire") ?? "")]
    );
    await q(
      `UPDATE transporteurs SET note = COALESCE(
         (SELECT ROUND(AVG(note)::numeric, 2) FROM avis WHERE transporteur_id=$1), 0)
       WHERE id=$1`, [gagnant.transporteur_id]);
    await journal("avis_depose", "transporteur#" + gagnant.transporteur_id, note + "/5", u.id);
  }
  revalidatePath(`/demande/${id}`);
  redirect(`/demande/${id}`);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const d = await charger(parseInt(id, 10) || 0);
    return { title: d ? `Demande ${d.reference}` : "Demande introuvable" };
  } catch { return { title: "Demande" }; }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const { id: brut } = await params;
  const id = parseInt(brut, 10) || 0;
  const d = await charger(id);
  const proprietaire = d && d.client_id === u.id;
  if (!d || (!proprietaire && u.role !== "admin")) notFound();

  const devis = await q<{
    id: number; prix: string; devise: string; delai: string; message: string | null;
    statut: string; tid: number; raison_sociale: string; note: string; nb_missions: number;
    ville: string | null; telephone: string | null; email: string | null; adresse: string | null;
  }>(
    /* Les coordonnées ne sont jointes que pour le devis accepté : tant que le client
       n'a pas choisi, personne ne peut être contacté en dehors de la plateforme. */
    `SELECT q.id, q.prix, q.devise, q.delai, q.message, q.statut,
            t.id AS tid, t.raison_sociale, t.note, t.nb_missions, v.nom AS ville,
            CASE WHEN q.statut='accepte' THEN NULLIF(t.telephone,'') END AS telephone,
            CASE WHEN q.statut='accepte' THEN u.email END AS email,
            CASE WHEN q.statut='accepte' THEN NULLIF(t.adresse,'') END AS adresse
     FROM devis q JOIN transporteurs t ON t.id=q.transporteur_id
     JOIN utilisateurs u ON u.id=t.utilisateur_id
     LEFT JOIN villes v ON v.id=t.ville_id
     WHERE q.demande_id=$1 ORDER BY q.prix ASC`, [id]);

  const monAvis = await ligne<{ note: number; commentaire: string | null; cree_le: string; raison_sociale: string }>(
    `SELECT a.note, a.commentaire, a.cree_le, t.raison_sociale
     FROM avis a JOIN transporteurs t ON t.id=a.transporteur_id
     WHERE a.demande_id=$1`, [id]);

  const gagnant = devis.find((x) => x.statut === "accepte");
  const libelleStatut: Record<string, string> = {
    envoye: "Proposé", accepte: "Accepté", refuse: "Non retenu", expire: "Expiré",
  };

  return (
    <>
      <nav className="crumb">
        <Link href="/mes-demandes">Mes demandes</Link> › <span>{d.reference}</span>
      </nav>
      <h1>Demande <span className="mono">{d.reference}</span></h1>

      <div className="cols droite">
        <div>
          {monAvis ? (
            <div className="carte">
              <h3 style={{ marginTop: 0 }}>Votre avis sur {monAvis.raison_sociale}</h3>
              <p><b style={{ fontSize: 19 }}>{monAvis.note} / 5</b>{" "}
                <span className="muted small">— déposé le {dateFr(monAvis.cree_le)}</span></p>
              {monAvis.commentaire && <p className="small">{monAvis.commentaire}</p>}
            </div>
          ) : proprietaire && d.statut === "terminee" && gagnant ? (
            <div className="carte">
              <h3 style={{ marginTop: 0 }}>Noter {gagnant.raison_sociale}</h3>
              <p className="small muted">
                Votre note apparaîtra sur la fiche publique du transporteur et aidera les
                autres clients.
              </p>
              <form action={noter}>
                <input type="hidden" name="demande_id" value={id} />
                <div className="champ">
                  <label className="ch">Note</label>
                  {[[5, "Excellent"], [4, "Bien"], [3, "Correct"], [2, "Décevant"], [1, "Mauvais"]].map(
                    ([n, lab]) => (
                      <label className="coche" key={String(n)}>
                        <input type="radio" name="note" value={String(n)} defaultChecked={n === 5} />
                        <span>{String(n)} / 5 — {lab}</span>
                      </label>
                    ))}
                </div>
                <div className="champ">
                  <label className="ch" htmlFor="commentaire">Commentaire (facultatif)</label>
                  <textarea id="commentaire" name="commentaire"
                            placeholder="Ponctualité, état du véhicule, communication…" />
                </div>
                <button className="btn" type="submit">Publier mon avis</button>
              </form>
            </div>
          ) : null}

          {proprietaire && gagnant && (
            <div className="carte" style={{ borderLeft: "4px solid var(--ok)" }}>
              <h3 style={{ marginTop: 0 }}>Votre transporteur : {gagnant.raison_sociale}</h3>
              <p className="small muted" style={{ marginTop: 0 }}>
                Prenez contact directement pour convenir de l&apos;heure et de l&apos;adresse
                exacte d&apos;enlèvement.
              </p>
              <table style={{ minWidth: 0, fontSize: 15 }}>
                <tbody>
                  <tr><td>Prix convenu</td><td><b>{montant(gagnant.prix, gagnant.devise)}</b></td></tr>
                  {gagnant.delai && <tr><td>Délai annoncé</td><td>{gagnant.delai}</td></tr>}
                  {gagnant.telephone && (
                    <tr>
                      <td>Téléphone</td>
                      <td><a href={`tel:${gagnant.telephone.replace(/\s/g, "")}`}>{gagnant.telephone}</a></td>
                    </tr>
                  )}
                  {gagnant.email && (
                    <tr><td>E-mail</td><td><a href={`mailto:${gagnant.email}`}>{gagnant.email}</a></td></tr>
                  )}
                  {gagnant.adresse && <tr><td>Adresse</td><td>{gagnant.adresse}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={{ marginTop: 0 }}>{devis.length} devis reçu{devis.length > 1 ? "s" : ""}</h2>

          {devis.length === 0 && (
            <div className="carte vide">
              <p><b>Aucun devis pour l&apos;instant.</b></p>
              <p className="small">
                Les transporteurs éligibles voient votre demande dans leur espace et vous
                répondront sous peu.
              </p>
            </div>
          )}

          {devis.map((qd) => (
            <article className="sup" key={qd.id}>
              <header className="sup-h">
                <span className="logo-e">{initiales(qd.raison_sociale)}</span>
                <h3><Link href={`/transporteur/${qd.tid}`}>{qd.raison_sociale}</Link></h3>
                <span><b style={{ fontSize: 20 }}>{montant(qd.prix, qd.devise)}</b></span>
              </header>
              <p className="small muted" style={{ margin: "0 0 8px" }}>
                {qd.ville} · {noteAffichee(qd.note, qd.nb_missions)} · {qd.nb_missions} missions
                {qd.delai ? " · " + qd.delai : ""}
              </p>
              {qd.message && <p className="small">{qd.message}</p>}
              <div className="sup-act">
                <span className={"tag " + (qd.statut === "accepte" ? "ok" : qd.statut === "refuse" ? "err" : "")}>
                  {libelleStatut[qd.statut] ?? qd.statut}
                </span>
                <span className="sp" />
                {proprietaire && d.statut !== "acceptee" && d.statut !== "terminee" && d.statut !== "annulee" && (
                  <form action={accepter}>
                    <input type="hidden" name="demande_id" value={id} />
                    <input type="hidden" name="devis_id" value={qd.id} />
                    <button className="btn sm" type="submit">Accepter ce devis</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>

        <aside>
          <div className="carte">
            <h3>Votre demande</h3>
            <p className="small">
              <b>{d.depart} → {d.arrivee}</b><br />
              <span className="muted">
                {d.distance_km} km · {d.type === "fret" ? "Marchandises" : "Personnes"}
              </span>
            </p>
            <table style={{ minWidth: 0, fontSize: 14.5 }}>
              <tbody>
                <tr><td>Date souhaitée</td><td>{dateFr(d.date_souhaitee)}</td></tr>
                {d.nature && <tr><td>Nature</td><td>{d.nature}</td></tr>}
                {d.poids_kg && <tr><td>Poids</td><td>{d.poids_kg.toLocaleString("fr-FR")} kg</td></tr>}
                {d.volume_m3 && <tr><td>Volume</td><td>{d.volume_m3} m³</td></tr>}
                {d.palettes && <tr><td>Palettes</td><td>{d.palettes}</td></tr>}
                {d.passagers && <tr><td>Passagers</td><td>{d.passagers}</td></tr>}
                <tr><td>Déposée le</td><td>{dateFr(d.cree_le, true)}</td></tr>
                <tr><td>Statut</td><td>{STATUTS_DEMANDE[d.statut] ?? d.statut}</td></tr>
              </tbody>
            </table>
            {d.equipements && (
              <div className="tags" style={{ marginTop: 8 }}>
                {d.equipements.split(",").filter(Boolean).map((e) => (
                  <span className="tag" key={e}>{EQUIPEMENTS[e] ?? e}</span>
                ))}
              </div>
            )}
            {d.precisions && <p className="small" style={{ marginTop: 10 }}>{d.precisions}</p>}
          </div>

          {proprietaire && (d.statut === "ouverte" || d.statut === "devis") && (
            <div className="carte">
              <h3 style={{ marginTop: 0 }}>Vous n&apos;avez plus besoin de ce transport ?</h3>
              <form action={annuler}>
                <input type="hidden" name="demande_id" value={id} />
                <button className="btn sec pleine" type="submit">Annuler ma demande</button>
              </form>
            </div>
          )}

          {proprietaire && d.statut === "acceptee" && (
            <div className="carte">
              <h3 style={{ marginTop: 0 }}>Le transport a été effectué ?</h3>
              <p className="small muted">Clôturez la mission pour pouvoir noter le transporteur.</p>
              <form action={terminer}>
                <input type="hidden" name="demande_id" value={id} />
                <button className="btn pleine" type="submit">Marquer la mission terminée</button>
              </form>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
