import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { q } from "@/lib/db";
import { STATUTS_DEMANDE, dateFr } from "@/lib/metier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes demandes" };

export default async function Page() {
  const u = await exigerConnexion("/mes-demandes");
  if (u.role === "transporteur") redirect("/espace/demandes");
  if (u.role === "admin") redirect("/admin/demandes");

  const demandes = await q<{
    id: number; reference: string; type: string; distance_km: number;
    date_souhaitee: string | null; statut: string; nb_devis: string;
    depart: string; arrivee: string;
  }>(
    `SELECT d.id, d.reference, d.type, d.distance_km, d.date_souhaitee, d.statut,
            CASE WHEN vd.pays <> va.pays THEN vd.nom || ' (' || ppd.nom || ')' ELSE vd.nom END AS depart,
            CASE WHEN vd.pays <> va.pays THEN va.nom || ' (' || ppa.nom || ')' ELSE va.nom END AS arrivee,
            (SELECT COUNT(*) FROM devis q WHERE q.demande_id=d.id) AS nb_devis
     FROM demandes d
     JOIN villes vd ON vd.id=d.ville_depart
     JOIN villes va ON va.id=d.ville_arrivee
     JOIN pays ppd ON ppd.code=vd.pays
     JOIN pays ppa ON ppa.code=va.pays
     WHERE d.client_id=$1 ORDER BY d.cree_le DESC`, [u.id]
  );

  return (
    <>
      <h1>Mes demandes</h1>
      {demandes.length === 0 ? (
        <div className="carte vide">
          <p><b>Vous n&apos;avez pas encore de demande.</b></p>
          <p><Link className="btn" href="/devis">Demander un devis</Link></p>
        </div>
      ) : (
        <div className="tw"><table>
          <thead><tr>
            <th>Référence</th><th>Trajet</th><th>Type</th><th>Date</th>
            <th>Devis reçus</th><th>Statut</th><th></th>
          </tr></thead>
          <tbody>
            {demandes.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.reference}</td>
                <td>{d.depart} → {d.arrivee}<br /><span className="small muted">{d.distance_km} km</span></td>
                <td>{d.type === "fret" ? "Marchandises" : "Personnes"}</td>
                <td>{dateFr(d.date_souhaitee)}</td>
                <td><b>{d.nb_devis}</b></td>
                <td><span className={"tag " + (d.statut === "acceptee" || d.statut === "terminee" ? "ok" : d.statut === "annulee" ? "err" : "")}>
                  {STATUTS_DEMANDE[d.statut] ?? d.statut}</span></td>
                <td><Link className="btn sec sm" href={`/demande/${d.id}`}>Ouvrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  );
}
