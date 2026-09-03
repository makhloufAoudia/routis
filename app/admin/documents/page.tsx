import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerRole } from "@/lib/auth";
import { q, ligne, journal } from "@/lib/db";
import { DOCUMENTS_REQUIS, dateFr } from "@/lib/metier";
import { mailDocumentRefuse } from "@/lib/notifications";
import Soumettre from "@/components/Soumettre";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents à contrôler" };

async function controler(formData: FormData) {
  "use server";
  const admin = await exigerRole("admin");

  const id = parseInt(String(formData.get("id") ?? ""), 10) || 0;
  const action = String(formData.get("action") ?? "");
  const motif = String(formData.get("motif") ?? "").slice(0, 255);
  const tidRetour = parseInt(String(formData.get("retour") ?? ""), 10) || 0;
  const suite = "/admin/documents" + (tidRetour ? `?transporteur=${tidRetour}` : "");

  const d = await ligne<{ id: number; transporteur_id: number; type: string }>(
    `SELECT id, transporteur_id, type FROM documents WHERE id=$1`, [id]);
  if (!d) redirect(suite);

  if (action === "valider") {
    await q(
      `UPDATE documents SET statut='valide', motif_refus='', controle_par=$1, controle_le=now()
       WHERE id=$2`, [admin.id, d.id]);
    await journal("document_valide", "document#" + d.id);
    redirect(suite + (suite.includes("?") ? "&" : "?") + "ok=valide");
  }

  if (action === "refuser") {
    if (!motif) redirect(suite + (suite.includes("?") ? "&" : "?") + "erreur=motif");
    await q(
      `UPDATE documents SET statut='refuse', motif_refus=$1, controle_par=$2, controle_le=now()
       WHERE id=$3`, [motif, admin.id, d.id]);
    await journal("document_refuse", "document#" + d.id, motif);
    await mailDocumentRefuse(d.transporteur_id, DOCUMENTS_REQUIS[d.type] ?? d.type, motif);
    redirect(suite + (suite.includes("?") ? "&" : "?") + "ok=refuse");
  }

  redirect(suite);
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ transporteur?: string; ok?: string; erreur?: string }> }) {
  await exigerRole("admin", "/admin/documents");
  const sp = await searchParams;
  const tid = parseInt(sp.transporteur ?? "", 10) || 0;

  const docs = await q<{
    id: number; type: string; nom_origine: string; taille: number; statut: string;
    motif_refus: string; expire_le: string | null; cree_le: string;
    raison_sociale: string; tid: number;
  }>(
    `SELECT d.id, d.type, d.nom_origine, d.taille, d.statut, d.motif_refus, d.expire_le, d.cree_le,
            t.raison_sociale, t.id AS tid
     FROM documents d JOIN transporteurs t ON t.id=d.transporteur_id
     ${tid ? "WHERE d.transporteur_id=$1" : "WHERE d.statut='en_attente'"}
     ORDER BY d.cree_le DESC LIMIT 200`,
    tid ? [tid] : []
  );

  const messages: Record<string, string> = {
    valide: "Document validé.",
    refuse: "Document refusé, le transporteur en est informé.",
  };

  return (
    <>
      <nav className="crumb"><Link href="/admin">Administration</Link> › <span>Documents</span></nav>
      <h1>{tid ? "Documents du transporteur" : "Documents à contrôler"}</h1>
      {sp.ok && <div className="msg ok">{messages[sp.ok] ?? "Opération effectuée."}</div>}
      {sp.erreur === "motif" && <div className="msg err">Indiquez un motif de refus.</div>}

      {tid > 0 && (
        <p><Link className="btn sec sm" href="/admin/documents">Voir toute la file</Link></p>
      )}

      {docs.length === 0 && <div className="carte vide">Aucun document dans cette liste.</div>}

      {docs.map((d) => (
        <article className="carte" key={d.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{DOCUMENTS_REQUIS[d.type] ?? d.type}</h3>
            <Link className="small" href={`/admin/documents?transporteur=${d.tid}`}>
              {d.raison_sociale}
            </Link>
            <span style={{ flex: 1 }} />
            <span className={
              "tag " + (d.statut === "valide" ? "ok" : d.statut === "refuse" ? "err" : "att")
            }>
              {d.statut.replace("_", " ")}
            </span>
          </div>

          <p className="small muted" style={{ margin: "8px 0" }}>
            {d.nom_origine} · {Math.round(d.taille / 1024).toLocaleString("fr-FR")} Ko · déposé le{" "}
            {dateFr(d.cree_le, true)}
            {d.expire_le ? " · expire le " + dateFr(d.expire_le) : " · sans date d'expiration"}
          </p>
          {d.motif_refus && (
            <p className="small" style={{ color: "var(--warn)" }}>Motif : {d.motif_refus}</p>
          )}

          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
            <a className="btn sec sm" href={`/api/fichier/${d.id}`} target="_blank" rel="noopener">
              Ouvrir le fichier
            </a>
            <form action={controler} style={{ display: "inline" }}>
              <input type="hidden" name="action" value="valider" />
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="retour" value={tid || ""} />
              <Soumettre className="btn sm">Valider</Soumettre>
            </form>
            <form action={controler} style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 260px", minWidth: 0 }}>
              <input type="hidden" name="action" value="refuser" />
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="retour" value={tid || ""} />
              <input name="motif" placeholder="Motif du refus" style={{ flex: 1, minWidth: 150 }} required />
              <Soumettre className="btn sec sm">Refuser</Soumettre>
            </form>
          </div>
        </article>
      ))}
    </>
  );
}
