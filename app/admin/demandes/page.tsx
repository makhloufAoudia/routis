import Link from "next/link";
import { exigerRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { dateFr, STATUTS_DEMANDE } from "@/lib/metier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demandes" };

export default async function Page() {
  await exigerRole("admin", "/admin/demandes");

  const liste = await q<{
    id: number; reference: string; client: string; depart: string; arrivee: string;
    distance_km: number; type: string; nb_devis: string; statut: string; cree_le: string;
  }>(
    `SELECT d.id, d.reference, d.type, d.distance_km, d.statut, d.cree_le,
            vd.nom AS depart, va.nom AS arrivee, u.nom AS client,
            (SELECT COUNT(*) FROM devis x WHERE x.demande_id=d.id) AS nb_devis
     FROM demandes d
     JOIN villes vd ON vd.id=d.ville_depart
     JOIN villes va ON va.id=d.ville_arrivee
     JOIN utilisateurs u ON u.id=d.client_id
     ORDER BY d.cree_le DESC LIMIT 200`
  );

  return (
    <>
      <nav className="crumb"><Link href="/admin">Administration</Link> › <span>Demandes</span></nav>
      <h1>Demandes</h1>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Référence</th><th>Client</th><th>Trajet</th><th>Type</th>
              <th>Devis</th><th>Statut</th><th>Déposée</th><th></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((d) => (
              <tr key={d.id}>
                <td className="mono small">{d.reference}</td>
                <td className="small">{d.client}</td>
                <td className="small">
                  {d.depart} → {d.arrivee}{" "}
                  <span className="muted">({d.distance_km} km)</span>
                </td>
                <td className="small">{d.type === "fret" ? "Marchandises" : "Personnes"}</td>
                <td>{d.nb_devis}</td>
                <td className="small">{STATUTS_DEMANDE[d.statut] ?? d.statut}</td>
                <td className="small">{dateFr(d.cree_le)}</td>
                <td><Link className="btn sec sm" href={`/demande/${d.id}`}>Ouvrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {liste.length === 0 && <div className="carte vide">Aucune demande.</div>}
    </>
  );
}
