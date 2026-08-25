import Link from "next/link";
import { exigerRole } from "@/lib/auth";
import { q, compter } from "@/lib/db";
import { dateFr } from "@/lib/metier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration" };

export default async function Page() {
  await exigerRole("admin", "/admin");

  const [
    transporteurs, attente, verifies, docsAttente, demandes, devis, acceptes, clients,
  ] = await Promise.all([
    compter(`SELECT COUNT(*) FROM transporteurs`),
    compter(`SELECT COUNT(*) FROM transporteurs WHERE statut='en_attente'`),
    compter(`SELECT COUNT(*) FROM transporteurs WHERE statut='verifie'`),
    compter(`SELECT COUNT(*) FROM documents WHERE statut='en_attente'`),
    compter(`SELECT COUNT(*) FROM demandes`),
    compter(`SELECT COUNT(*) FROM devis`),
    compter(`SELECT COUNT(*) FROM devis WHERE statut='accepte'`),
    compter(`SELECT COUNT(*) FROM utilisateurs WHERE role='client'`),
  ]);

  const recent = await q<{
    id: number; action: string; cible: string; details: string;
    cree_le: string; nom: string | null;
  }>(
    `SELECT j.id, j.action, j.cible, j.details, j.cree_le, u.nom
     FROM journal j LEFT JOIN utilisateurs u ON u.id=j.utilisateur_id
     ORDER BY j.id DESC LIMIT 15`
  );

  const stats: [string, number][] = [
    ["Transporteurs", transporteurs],
    ["Vérifiés", verifies],
    ["En attente", attente],
    ["Clients", clients],
    ["Demandes", demandes],
    ["Devis", devis],
    ["Devis acceptés", acceptes],
  ];

  return (
    <>
      <h1>Administration</h1>
      <nav className="crumb">
        <Link href="/admin/transporteurs">Transporteurs</Link> ·{" "}
        <Link href="/admin/documents">Documents</Link> ·{" "}
        <Link href="/admin/demandes">Demandes</Link> ·{" "}
        <Link href="/admin/emails">E-mails</Link>
      </nav>

      {(attente > 0 || docsAttente > 0) && (
        <div className="msg att">
          <b>À traiter :</b> {attente} dossier(s) transporteur en attente, {docsAttente}{" "}
          document(s) à contrôler.{" "}
          <Link href="/admin/transporteurs?statut=en_attente">Ouvrir la file</Link>
        </div>
      )}

      <div className="stat">
        {stats.map(([k, v]) => (
          <div key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>

      <h2>Journal d&apos;activité</h2>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Utilisateur</th><th>Action</th><th>Cible</th><th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="small">{dateFr(r.cree_le, true)}</td>
                <td className="small">{r.nom ?? "—"}</td>
                <td className="small">{r.action}</td>
                <td className="small mono">{r.cible}</td>
                <td className="small">{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {recent.length === 0 && <div className="carte vide">Aucune activité enregistrée.</div>}
    </>
  );
}
