import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerRole, monTransporteur } from "@/lib/auth";
import { q, ligne, journal } from "@/lib/db";
import { DOCUMENTS_REQUIS, dateFr } from "@/lib/metier";
import { enregistrerFichier, supprimerFichier, extensionReelle, TAILLE_MAX } from "@/lib/stockage";
import Soumettre from "@/components/Soumettre";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes documents" };

const MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png" };

async function deposer(formData: FormData) {
  "use server";
  await exigerRole("transporteur");
  const t = await monTransporteur();
  if (!t) redirect("/espace");

  const type = String(formData.get("type") ?? "");
  if (!(type in DOCUMENTS_REQUIS)) redirect("/espace/documents?erreur=type");

  const f = formData.get("fichier");
  if (!(f instanceof File) || f.size === 0) redirect("/espace/documents?erreur=vide");
  if (f.size > TAILLE_MAX) redirect("/espace/documents?erreur=taille");

  const octets = Buffer.from(await f.arrayBuffer());
  const ext = extensionReelle(octets, f.type);
  if (!ext) redirect("/espace/documents?erreur=format");

  const expire = String(formData.get("expire_le") ?? "");
  if (expire && !/^\d{4}-\d{2}-\d{2}$/.test(expire)) redirect("/espace/documents?erreur=date");

  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  const cle = `t${t.id}_${type}_${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}.${ext}`;

  const ancien = await ligne<{ id: number; cle_fichier: string }>(
    `SELECT id, cle_fichier FROM documents WHERE transporteur_id=$1 AND type=$2`, [t.id, type]);

  await enregistrerFichier(cle, octets);
  if (ancien) {
    await supprimerFichier(ancien.cle_fichier);
    await q(`DELETE FROM documents WHERE id=$1`, [ancien.id]);
  }
  await q(
    `INSERT INTO documents (transporteur_id, type, cle_fichier, nom_origine, type_mime, taille, expire_le, statut)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'en_attente')`,
    [t.id, type, cle, f.name.slice(0, 180), MIME[ext], f.size, expire || null]
  );
  await journal("document_depose", "transporteur#" + t.id, type);
  redirect("/espace/documents?ok=depose");
}

async function supprimer(formData: FormData) {
  "use server";
  await exigerRole("transporteur");
  const t = await monTransporteur();
  if (!t) redirect("/espace");
  const id = parseInt(String(formData.get("doc_id") ?? ""), 10) || 0;
  const doc = await ligne<{ id: number; cle_fichier: string }>(
    `SELECT id, cle_fichier FROM documents WHERE id=$1 AND transporteur_id=$2`, [id, t.id]);
  if (doc) {
    await supprimerFichier(doc.cle_fichier);
    await q(`DELETE FROM documents WHERE id=$1`, [doc.id]);
    await journal("document_supprime", "document#" + doc.id);
  }
  redirect("/espace/documents?ok=supprime");
}

async function envoyerDossier() {
  "use server";
  await exigerRole("transporteur");
  const t = await monTransporteur();
  if (!t) redirect("/espace");
  const n = await ligne<{ n: string }>(
    `SELECT COUNT(DISTINCT type) AS n FROM documents WHERE transporteur_id=$1`, [t.id]);
  if (parseInt(n?.n ?? "0", 10) < 3) redirect("/espace/documents?erreur=incomplet");
  await q(`UPDATE transporteurs SET statut='en_attente', motif_refus='' WHERE id=$1`, [t.id]);
  await journal("dossier_envoye", "transporteur#" + t.id);
  redirect("/espace/documents?ok=envoye");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerRole("transporteur", "/espace/documents");
  const t = await monTransporteur();
  if (!t) redirect("/espace");
  const sp = await searchParams;

  const rows = await q<{
    id: number; type: string; nom_origine: string; taille: number;
    expire_le: string | null; statut: string; motif_refus: string; cree_le: string;
  }>(`SELECT * FROM documents WHERE transporteur_id=$1`, [t.id]);
  const parType = new Map(rows.map((r) => [r.type, r]));

  const erreurs: Record<string, string> = {
    type: "Type de document inconnu.",
    vide: "Aucun fichier reçu.",
    taille: "Le fichier dépasse 5 Mo.",
    format: "Formats acceptés : PDF, JPG ou PNG. Le contenu du fichier est vérifié, pas seulement son nom.",
    date: "La date d'expiration n'est pas valide.",
    incomplet: "Déposez au moins le registre, la licence et l'assurance avant d'envoyer votre dossier.",
  };
  const succes: Record<string, string> = {
    depose: "Document déposé. Il sera contrôlé par un administrateur.",
    supprime: "Document supprimé.",
    envoye: "Dossier envoyé. Un administrateur va contrôler vos pièces.",
  };
  const libelle: Record<string, string> = {
    en_attente: "en cours de contrôle", valide: "validé", refuse: "refusé",
  };

  return (
    <>
      <nav className="crumb"><Link href="/espace">Mon espace</Link> › <span>Documents</span></nav>
      <h1>Mes documents</h1>
      <p className="lede">
        Formats acceptés : PDF, JPG, PNG — 5 Mo maximum. Vos fichiers ne sont visibles que par
        vous et par l&apos;administration.
      </p>
      {sp.ok && <div className="msg ok">{succes[sp.ok]}</div>}
      {sp.erreur && <div className="msg err">{erreurs[sp.erreur] ?? "Une erreur est survenue."}</div>}

      <div style={{ maxWidth: 820 }}>
        {Object.entries(DOCUMENTS_REQUIS).map(([k, lab]) => {
          const d = parType.get(k);
          return (
            <div className="carte" key={k}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>{lab}</h3>
                {d ? (
                  <span className={"tag " + (d.statut === "valide" ? "ok" : d.statut === "refuse" ? "err" : "att")}>
                    {libelle[d.statut] ?? d.statut}
                  </span>
                ) : <span className="tag">non fourni</span>}
                <span style={{ flex: 1 }} />
                {d && (
                  <>
                    <a className="btn sec sm" href={`/api/fichier/${d.id}`} target="_blank" rel="noopener">
                      Voir le fichier
                    </a>
                    <form action={supprimer} style={{ display: "inline" }}>
                      <input type="hidden" name="doc_id" value={d.id} />
                      <Soumettre className="btn sec sm">Supprimer</Soumettre>
                    </form>
                  </>
                )}
              </div>
              {d && (
                <p className="small muted" style={{ margin: "8px 0 0" }}>
                  {d.nom_origine} · {Math.round(d.taille / 1024).toLocaleString("fr-FR")} Ko ·
                  déposé le {dateFr(d.cree_le)}
                  {d.expire_le ? ` · expire le ${dateFr(d.expire_le)}` : ""}
                </p>
              )}
              {d?.statut === "refuse" && d.motif_refus && (
                <div className="msg err" style={{ margin: "10px 0 0" }}>
                  Motif du refus : {d.motif_refus}
                </div>
              )}
              <form action={deposer} style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <input type="hidden" name="type" value={k} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <label className="ch">Fichier {d ? "(remplace le précédent)" : ""}</label>
                  <input type="file" name="fichier" accept=".pdf,.jpg,.jpeg,.png" required />
                </div>
                <div style={{ width: 190 }}>
                  <label className="ch">Date d&apos;expiration</label>
                  <input type="date" name="expire_le" defaultValue={d?.expire_le ?? ""} />
                </div>
                <Soumettre className="btn sm">Déposer</Soumettre>
              </form>
            </div>
          );
        })}

        {(t.statut === "brouillon" || t.statut === "refuse") && (
          <form action={envoyerDossier} className="carte">
            <h3 style={{ marginTop: 0 }}>Envoyer mon dossier à la vérification</h3>
            <p className="small muted">
              Une fois vos pièces déposées, envoyez le dossier. Un administrateur le contrôle,
              puis votre entreprise apparaît dans l&apos;annuaire public.
            </p>
            <Soumettre className="btn">Envoyer mon dossier</Soumettre>
          </form>
        )}
      </div>
    </>
  );
}
