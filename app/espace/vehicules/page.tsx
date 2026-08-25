import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerRole, monTransporteur } from "@/lib/auth";
import { q, ligne, journal } from "@/lib/db";
import { CATEGORIES } from "@/lib/metier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes véhicules" };

async function ajouter(formData: FormData) {
  "use server";
  await exigerRole("transporteur");
  const t = await monTransporteur();
  if (!t) redirect("/espace");

  const cat = String(formData.get("categorie") ?? "");
  if (!(cat in CATEGORIES)) redirect("/espace/vehicules?erreur=categorie");
  const annee = parseInt(String(formData.get("annee") ?? ""), 10) || null;
  if (annee && (annee < 1970 || annee > new Date().getFullYear() + 1)) {
    redirect("/espace/vehicules?erreur=annee");
  }
  const entier = (c: string) => {
    const v = parseInt(String(formData.get(c) ?? ""), 10);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const volume = parseFloat(String(formData.get("volume_m3") ?? "").replace(",", "."));

  await q(
    `INSERT INTO vehicules (transporteur_id, categorie, immatriculation, marque, modele,
       annee, charge_kg, volume_m3, places)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [t.id, cat,
     String(formData.get("immatriculation") ?? "").slice(0, 40),
     String(formData.get("marque") ?? "").slice(0, 60),
     String(formData.get("modele") ?? "").slice(0, 60),
     annee, entier("charge_kg"),
     Number.isFinite(volume) && volume > 0 ? volume : null,
     entier("places")]
  );
  await journal("vehicule_ajoute", "transporteur#" + t.id, cat);
  redirect("/espace/vehicules?ok=1");
}

async function supprimer(formData: FormData) {
  "use server";
  await exigerRole("transporteur");
  const t = await monTransporteur();
  if (!t) redirect("/espace");
  const id = parseInt(String(formData.get("id") ?? ""), 10) || 0;
  const v = await ligne(`SELECT id FROM vehicules WHERE id=$1 AND transporteur_id=$2`, [id, t.id]);
  if (v) await q(`DELETE FROM vehicules WHERE id=$1`, [id]);
  redirect("/espace/vehicules?ok=supprime");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerRole("transporteur", "/espace/vehicules");
  const t = await monTransporteur();
  if (!t) redirect("/espace");
  const sp = await searchParams;

  const liste = await q<{
    id: number; categorie: string; immatriculation: string; marque: string; modele: string;
    annee: number | null; charge_kg: number | null; volume_m3: string | null; places: number | null;
  }>(`SELECT * FROM vehicules WHERE transporteur_id=$1 ORDER BY cree_le DESC`, [t.id]);

  const erreurs: Record<string, string> = {
    categorie: "Choisissez une catégorie de véhicule.",
    annee: "L'année n'est pas valide.",
  };

  return (
    <>
      <nav className="crumb"><Link href="/espace">Mon espace</Link> › <span>Véhicules</span></nav>
      <h1>Mes véhicules</h1>
      {sp.ok && <div className="msg ok">{sp.ok === "supprime" ? "Véhicule supprimé." : "Véhicule ajouté."}</div>}
      {sp.erreur && <div className="msg err">{erreurs[sp.erreur] ?? "Une erreur est survenue."}</div>}

      <div className="cols droite">
        <div>
          {liste.length === 0 ? (
            <div className="carte vide">
              <b>Aucun véhicule déclaré.</b>
              <p className="small">Ajoutez au moins un véhicule pour recevoir des demandes adaptées.</p>
            </div>
          ) : (
            <div className="tw"><table>
              <thead><tr>
                <th>Catégorie</th><th>Immatriculation</th><th>Marque / modèle</th><th>Capacité</th><th></th>
              </tr></thead>
              <tbody>
                {liste.map((v) => {
                  const b: string[] = [];
                  if (v.charge_kg) b.push(v.charge_kg.toLocaleString("fr-FR") + " kg");
                  if (v.volume_m3) b.push(parseFloat(v.volume_m3).toString().replace(".", ",") + " m³");
                  if (v.places) b.push(v.places + " pl.");
                  return (
                    <tr key={v.id}>
                      <td>{CATEGORIES[v.categorie]?.nom ?? v.categorie}</td>
                      <td className="mono">{v.immatriculation || "—"}</td>
                      <td>{[v.marque, v.modele].filter(Boolean).join(" ") || "—"}
                        {v.annee ? ` (${v.annee})` : ""}</td>
                      <td className="small">{b.join(" · ") || "—"}</td>
                      <td>
                        <form action={supprimer}>
                          <input type="hidden" name="id" value={v.id} />
                          <button className="btn sec sm" type="submit">Supprimer</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
        <aside>
          <form action={ajouter} className="carte">
            <h3 style={{ marginTop: 0 }}>Ajouter un véhicule</h3>
            <div className="champ">
              <label className="ch" htmlFor="categorie">Catégorie</label>
              <select id="categorie" name="categorie" required defaultValue="">
                <option value="">— choisir —</option>
                {Object.entries(CATEGORIES).map(([k, c]) => (
                  <option key={k} value={k}>{c.nom} — {c.detail}</option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label className="ch" htmlFor="immatriculation">Immatriculation</label>
              <input id="immatriculation" name="immatriculation" />
            </div>
            <div className="grille g2">
              <div className="champ"><label className="ch" htmlFor="marque">Marque</label>
                <input id="marque" name="marque" /></div>
              <div className="champ"><label className="ch" htmlFor="modele">Modèle</label>
                <input id="modele" name="modele" /></div>
            </div>
            <div className="grille g2">
              <div className="champ"><label className="ch" htmlFor="annee">Année</label>
                <input id="annee" name="annee" type="number" min={1970} max={new Date().getFullYear() + 1} /></div>
              <div className="champ"><label className="ch" htmlFor="charge_kg">Charge utile (kg)</label>
                <input id="charge_kg" name="charge_kg" type="number" min={0} /></div>
            </div>
            <div className="grille g2">
              <div className="champ"><label className="ch" htmlFor="volume_m3">Volume (m³)</label>
                <input id="volume_m3" name="volume_m3" type="number" min={0} step={0.1} /></div>
              <div className="champ"><label className="ch" htmlFor="places">Places</label>
                <input id="places" name="places" type="number" min={0} /></div>
            </div>
            <button className="btn pleine" type="submit">Ajouter</button>
          </form>
        </aside>
      </div>
    </>
  );
}
