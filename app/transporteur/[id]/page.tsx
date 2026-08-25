import Link from "next/link";
import { notFound } from "next/navigation";
import { q, ligne } from "@/lib/db";
import { utilisateur, monTransporteur } from "@/lib/auth";
import { SERVICES, EQUIPEMENTS, COUVERTURES, CATEGORIES, DOCUMENTS_REQUIS,
         initiales, noteAffichee, dateFr, extrait } from "@/lib/metier";

export const dynamic = "force-dynamic";

type Fiche = {
  id: number; raison_sociale: string; description: string | null; pays: string;
  annee_creation: number | null; effectif: string; couverture: string; statut: string;
  note: string; nb_missions: number; ville: string | null; pays_nom: string | null;
};

async function charger(id: number) {
  return await ligne<Fiche>(
    `SELECT t.id, t.raison_sociale, t.description, t.pays, t.annee_creation, t.effectif,
            t.couverture, t.statut, t.note, t.nb_missions, v.nom AS ville, p.nom AS pays_nom
     FROM transporteurs t
     LEFT JOIN villes v ON v.id=t.ville_id
     LEFT JOIN pays p ON p.code=t.pays
     WHERE t.id=$1`, [id]);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const t = await charger(parseInt(id, 10) || 0);
    if (!t) return { title: "Fiche introuvable" };
    return {
      title: t.raison_sociale,
      description: extrait(t.description ?? `Transporteur vérifié à ${t.ville}, ${t.pays_nom}`, 155),
    };
  } catch { return { title: "Fiche transporteur" }; }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: brut } = await params;
  const id = parseInt(brut, 10) || 0;
  const t = await charger(id);
  const u = await utilisateur();
  const mien = await monTransporteur();
  const autorise = t && (t.statut === "verifie" || u?.role === "admin" || mien?.id === id);
  if (!autorise || !t) notFound();

  const [services, equips, vehicules, docs, avis] = await Promise.all([
    q<{ service: string }>(`SELECT service FROM transporteur_services WHERE transporteur_id=$1`, [id]),
    q<{ equipement: string }>(`SELECT equipement FROM transporteur_equipements WHERE transporteur_id=$1`, [id]),
    q<{ categorie: string; marque: string; modele: string; annee: number | null;
        charge_kg: number | null; volume_m3: string | null; places: number | null }>(
      `SELECT * FROM vehicules WHERE transporteur_id=$1 AND actif ORDER BY categorie`, [id]),
    q<{ type: string }>(`SELECT type FROM documents WHERE transporteur_id=$1 AND statut='valide'`, [id]),
    q<{ note: number; commentaire: string | null; cree_le: string; client: string }>(
      `SELECT a.note, a.commentaire, a.cree_le, u.nom AS client
       FROM avis a JOIN utilisateurs u ON u.id=a.client_id
       WHERE a.transporteur_id=$1 ORDER BY a.cree_le DESC LIMIT 20`, [id]),
  ]);
  const valides = new Set(docs.map((d) => d.type));

  return (
    <>
      <nav className="crumb">
        <Link href="/">Accueil</Link> ›{" "}
        <Link href={`/annuaire?pays=${t.pays}`}>Annuaire — {t.pays_nom}</Link> ›{" "}
        <span>{t.raison_sociale}</span>
      </nav>

      {t.statut !== "verifie" && (
        <div className="msg att">
          Aperçu privé : cette fiche n&apos;est pas encore publique (statut « {t.statut} »).
        </div>
      )}

      <div className="cols droite">
        <div>
          <div className="carte">
            <div className="sup-h" style={{ marginBottom: 16 }}>
              <span className="logo-e big">{initiales(t.raison_sociale)}</span>
              <div>
                <h1 style={{ margin: "0 0 4px" }}>{t.raison_sociale}</h1>
                <div className="muted">{t.ville ? t.ville + ", " : ""}{t.pays_nom}</div>
              </div>
              <span className="tag ok">✔ documents vérifiés</span>
            </div>

            <div className="stat">
              <div><span className="k">Note</span><span className="v" style={{ fontSize: parseFloat(t.note) > 0 ? 23 : 17 }}>
                {noteAffichee(t.note, t.nb_missions)}</span></div>
              <div><span className="k">Missions</span><span className="v">{t.nb_missions}</span></div>
              <div><span className="k">Véhicules</span><span className="v">{vehicules.length}</span></div>
              {t.annee_creation && <div><span className="k">Depuis</span><span className="v">{t.annee_creation}</span></div>}
              {t.effectif && <div><span className="k">Effectif</span><span className="v">{t.effectif}</span></div>}
            </div>

            <h2>Présentation</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{t.description || "Aucune présentation renseignée."}</p>
            <div className="tags">
              {services.map((s) => <span className="tag pri" key={s.service}>{SERVICES[s.service] ?? s.service}</span>)}
              {equips.map((e) => <span className="tag" key={e.equipement}>{EQUIPEMENTS[e.equipement] ?? e.equipement}</span>)}
              <span className="tag">Couverture : {COUVERTURES[t.couverture] ?? t.couverture}</span>
            </div>

            <h2>Flotte déclarée</h2>
            {vehicules.length === 0 ? (
              <p className="muted small">Aucun véhicule déclaré pour le moment.</p>
            ) : (
              <div className="tw"><table>
                <thead><tr><th>Catégorie</th><th>Marque et modèle</th><th>Année</th><th>Capacité</th></tr></thead>
                <tbody>
                  {vehicules.map((v, i) => {
                    const bits: string[] = [];
                    if (v.charge_kg) bits.push(v.charge_kg.toLocaleString("fr-FR") + " kg");
                    if (v.volume_m3) bits.push(parseFloat(v.volume_m3).toString().replace(".", ",") + " m³");
                    if (v.places) bits.push(v.places + " places");
                    return (
                      <tr key={i}>
                        <td>{CATEGORIES[v.categorie]?.nom ?? v.categorie}</td>
                        <td>{[v.marque, v.modele].filter(Boolean).join(" ") || "—"}</td>
                        <td>{v.annee ?? "—"}</td>
                        <td>{bits.join(" · ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}

            <h2>Avis des clients {avis.length > 0 && `(${avis.length})`}</h2>
            {avis.length === 0 ? (
              <p className="muted small">
                Aucun avis pour le moment. Les avis sont déposés par les clients après une mission
                effectuée via la plateforme.
              </p>
            ) : avis.map((a, i) => (
              <div className="carte" style={{ marginBottom: 10 }} key={i}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 17 }}>{a.note} / 5</b>
                  <span className="small muted">
                    {a.client.replace(/\s+\S+$/, "")} · {dateFr(a.cree_le)}
                  </span>
                </div>
                {a.commentaire && <p className="small" style={{ margin: "8px 0 0" }}>{a.commentaire}</p>}
              </div>
            ))}

            <h2>Documents et conformité</h2>
            <div className="liste-doc">
              {Object.entries(DOCUMENTS_REQUIS).map(([k, lab]) => (
                <div className="doc" key={k}>
                  <span>{lab}</span><span className="sp" />
                  <span className={valides.has(k) ? "tag ok" : "tag"}>
                    {valides.has(k) ? "validé" : "non fourni"}
                  </span>
                </div>
              ))}
            </div>
            <p className="aide">
              Contrôlés par l&apos;équipe ROUTIS. À l&apos;expiration d&apos;une pièce, la fiche
              est retirée de l&apos;annuaire.
            </p>
          </div>
        </div>

        <aside>
          <div className="carte">
            <h3>Travailler avec ce transporteur</h3>
            <p className="small muted">
              Décrivez votre besoin : {t.raison_sociale} recevra votre demande en priorité, aux
              côtés des autres transporteurs éligibles.
            </p>
            <Link className="btn pleine" href={`/devis?transporteur=${t.id}`}>Demander un devis</Link>
            <p style={{ margin: "10px 0 0" }}>
              <Link className="btn sec pleine" href={`/annuaire?pays=${t.pays}`}>Retour à l&apos;annuaire</Link>
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
