import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerRole } from "@/lib/auth";
import { q, ligne, compter, journal } from "@/lib/db";
import { initiales } from "@/lib/metier";
import { mailTransporteurVerifie, mailTransporteurRefuse } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transporteurs" };

const STATUTS = ["brouillon", "en_attente", "verifie", "refuse", "suspendu"];

async function traiter(formData: FormData) {
  "use server";
  const admin = await exigerRole("admin");

  const id = parseInt(String(formData.get("id") ?? ""), 10) || 0;
  const action = String(formData.get("action") ?? "");
  const motif = String(formData.get("motif") ?? "").slice(0, 255);
  const retour = String(formData.get("retour") ?? "");
  const suite = "/admin/transporteurs" + (STATUTS.includes(retour) ? `?statut=${retour}` : "");

  const t = await ligne<{ id: number; raison_sociale: string }>(
    `SELECT id, raison_sociale FROM transporteurs WHERE id=$1`, [id]);
  if (!t) redirect(suite);

  if (action === "verifier") {
    await q(
      `UPDATE transporteurs SET statut='verifie', motif_refus='', verifie_le=now() WHERE id=$1`,
      [id]);
    await q(
      `UPDATE documents SET statut='valide', controle_par=$1, controle_le=now()
       WHERE transporteur_id=$2 AND statut='en_attente'`, [admin.id, id]);
    await journal("transporteur_verifie", "transporteur#" + id);
    await mailTransporteurVerifie(id);
    redirect(suite + (suite.includes("?") ? "&" : "?") + "ok=verifie");
  }

  if (action === "refuser" || action === "suspendre") {
    const suspendu = action === "suspendre";
    await q(`UPDATE transporteurs SET statut=$1, motif_refus=$2 WHERE id=$3`,
      [suspendu ? "suspendu" : "refuse", motif, id]);
    await journal(suspendu ? "transporteur_suspendu" : "transporteur_refuse",
      "transporteur#" + id, motif);
    await mailTransporteurRefuse(id, motif, suspendu);
    redirect(suite + (suite.includes("?") ? "&" : "?") + "ok=" + (suspendu ? "suspendu" : "refuse"));
  }

  redirect(suite);
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ statut?: string; ok?: string }> }) {
  await exigerRole("admin", "/admin/transporteurs");
  const sp = await searchParams;
  const filtre = sp.statut && STATUTS.includes(sp.statut) ? sp.statut : "";

  const liste = await q<{
    id: number; raison_sociale: string; statut: string; motif_refus: string;
    email: string; contact: string; ville: string | null; pays_nom: string | null;
    nb_docs: string;
  }>(
    `SELECT t.id, t.raison_sociale, t.statut, t.motif_refus,
            u.email, u.nom AS contact, v.nom AS ville, p.nom AS pays_nom,
            (SELECT COUNT(*) FROM documents d WHERE d.transporteur_id=t.id) AS nb_docs
     FROM transporteurs t
     JOIN utilisateurs u ON u.id=t.utilisateur_id
     LEFT JOIN villes v ON v.id=t.ville_id
     LEFT JOIN pays p ON p.code=t.pays
     ${filtre ? "WHERE t.statut = $1" : ""}
     ORDER BY array_position(ARRAY['en_attente','brouillon','refuse','verifie','suspendu'], t.statut),
              t.cree_le DESC
     LIMIT 200`,
    filtre ? [filtre] : []
  );

  const compte: Record<string, number> = {};
  for (const st of STATUTS) {
    compte[st] = await compter(`SELECT COUNT(*) FROM transporteurs WHERE statut=$1`, [st]);
  }

  const messages: Record<string, string> = {
    verifie: "Transporteur vérifié et publié dans l'annuaire.",
    refuse: "Dossier refusé. Le transporteur voit le motif dans son espace.",
    suspendu: "Transporteur suspendu et retiré de l'annuaire.",
  };

  return (
    <>
      <nav className="crumb"><Link href="/admin">Administration</Link> › <span>Transporteurs</span></nav>
      <h1>Transporteurs</h1>
      {sp.ok && <div className="msg ok">{messages[sp.ok] ?? "Opération effectuée."}</div>}

      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn sec sm" href="/admin/transporteurs">Tous</Link>
        {STATUTS.map((st) => (
          <Link className="btn sec sm" key={st} href={`/admin/transporteurs?statut=${st}`}>
            {st.replace("_", " ")} ({compte[st]})
          </Link>
        ))}
      </p>

      {liste.length === 0 && <div className="carte vide">Aucun transporteur dans cette catégorie.</div>}

      {liste.map((t) => (
        <article className="carte" key={t.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="logo-e">{initiales(t.raison_sociale)}</span>
            <div>
              <h3 style={{ margin: 0 }}>{t.raison_sociale}</h3>
              <span className="small muted">
                {t.contact} · {t.email} · {t.ville ? t.ville + ", " : ""}{t.pays_nom}
              </span>
            </div>
            <span style={{ flex: 1 }} />
            <span className={
              "tag " + (t.statut === "verifie" ? "ok"
                : t.statut === "en_attente" ? "att"
                : t.statut === "refuse" || t.statut === "suspendu" ? "err" : "")
            }>
              {t.statut.replace("_", " ")}
            </span>
            <span className="tag">{t.nb_docs} document(s)</span>
          </div>

          {t.motif_refus && (
            <p className="small" style={{ color: "var(--warn)" }}>Motif : {t.motif_refus}</p>
          )}

          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <Link className="btn sec sm" href={`/admin/documents?transporteur=${t.id}`}>
              Voir les documents
            </Link>
            <Link className="btn sec sm" href={`/transporteur/${t.id}`}>Aperçu de la fiche</Link>

            {t.statut !== "verifie" ? (
              <form action={traiter} style={{ display: "inline" }}>
                <input type="hidden" name="action" value="verifier" />
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="retour" value={filtre} />
                <button className="btn sm" type="submit">Vérifier et publier</button>
              </form>
            ) : (
              <form action={traiter} style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 260px", minWidth: 0 }}>
                <input type="hidden" name="action" value="suspendre" />
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="retour" value={filtre} />
                <input name="motif" placeholder="Motif de suspension" style={{ flex: 1, minWidth: 150 }} required />
                <button className="btn sec sm" type="submit">Suspendre</button>
              </form>
            )}

            {t.statut !== "refuse" && (
              <form action={traiter} style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 260px", minWidth: 0 }}>
                <input type="hidden" name="action" value="refuser" />
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="retour" value={filtre} />
                <input name="motif" placeholder="Motif du refus" style={{ flex: 1, minWidth: 150 }} required />
                <button className="btn sec sm" type="submit">Refuser</button>
              </form>
            )}
          </div>
        </article>
      ))}
    </>
  );
}
