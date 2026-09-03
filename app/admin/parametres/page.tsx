import Link from "next/link";
import { exigerRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { dateFr } from "@/lib/metier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres" };

export default async function Page() {
  await exigerRole("admin", "/admin/parametres");

  /* Deux cents lignes suffisent : au-delà, on ne relit plus un journal, on
     l'interroge — et cette page n'est pas faite pour ça. */
  const recent = await q<{
    id: number; action: string; cible: string; details: string;
    cree_le: string; nom: string | null;
  }>(
    `SELECT j.id, j.action, j.cible, j.details, j.cree_le, u.nom
     FROM journal j LEFT JOIN utilisateurs u ON u.id=j.utilisateur_id
     ORDER BY j.id DESC LIMIT 200`
  );

  return (
    <>
      <nav className="crumb"><Link href="/admin">Administration</Link> › <span>Paramètres</span></nav>
      <h1>Paramètres</h1>
      <p className="lede">
        Le journal d&apos;activité conserve la trace de ce qui a été fait sur le site :
        connexions, demandes créées, dossiers traités. Il sert à retrouver quand et par qui,
        pas à piloter l&apos;activité au quotidien.
      </p>

      <h2>Journal d&apos;activité</h2>
      {recent.length === 0 ? (
        <div className="carte vide">Aucune activité enregistrée.</div>
      ) : (
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
      )}
    </>
  );
}
