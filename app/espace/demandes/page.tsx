import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerRole, monTransporteur } from "@/lib/auth";
import { q, ligne, valeur, journal } from "@/lib/db";
import { montant, dateFr } from "@/lib/metier";
import { DEMANDE_VISIBLE } from "@/lib/diffusion";
import { mailDevisRecu } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demandes à traiter" };

async function repondre(formData: FormData) {
  "use server";
  await exigerRole("transporteur");
  const t = await monTransporteur();
  if (!t) redirect("/espace");
  if (t.statut !== "verifie") redirect("/espace/demandes?erreur=non_verifie");

  const demandeId = parseInt(String(formData.get("demande_id") ?? ""), 10) || 0;
  const d = await ligne<{
    id: number; reference: string; client_id: number; type: string; statut: string;
    distance_km: number; date_souhaitee: string | null; depart: string; arrivee: string;
  }>(
    `SELECT d.*, vd.nom AS depart, va.nom AS arrivee
     FROM demandes d JOIN villes vd ON vd.id=d.ville_depart JOIN villes va ON va.id=d.ville_arrivee
     WHERE d.id=$1 AND d.statut IN ('ouverte','devis')`, [demandeId]);
  if (!d) redirect("/espace/demandes?erreur=introuvable");

  const prix = parseFloat(String(formData.get("prix") ?? "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(prix) || prix <= 0) redirect("/espace/demandes?erreur=prix");

  const devise = (await valeur<string>(`SELECT devise FROM pays WHERE code=$1`, [t.pays], "DZD")) ?? "DZD";
  const valide = String(formData.get("valide_jusqu_au") ?? "");
  const existe = await ligne<{ id: number }>(
    `SELECT id FROM devis WHERE demande_id=$1 AND transporteur_id=$2`, [demandeId, t.id]);

  if (existe) {
    await q(
      `UPDATE devis SET prix=$1, devise=$2, delai=$3, message=$4, valide_jusqu_au=$5, statut='envoye'
       WHERE id=$6`,
      [prix, devise, String(formData.get("delai") ?? "").slice(0, 120),
       String(formData.get("message") ?? ""), valide || null, existe.id]);
  } else {
    await q(
      `INSERT INTO devis (demande_id, transporteur_id, prix, devise, delai, message, valide_jusqu_au)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [demandeId, t.id, prix, devise, String(formData.get("delai") ?? "").slice(0, 120),
       String(formData.get("message") ?? ""), valide || null]);
    await mailDevisRecu(d, t.raison_sociale, prix, devise);
  }

  if (d.statut === "ouverte") await q(`UPDATE demandes SET statut='devis' WHERE id=$1`, [demandeId]);
  await journal("devis_envoye", "demande#" + demandeId, String(prix));
  redirect("/espace/demandes?ok=" + (existe ? "maj" : "envoye"));
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerRole("transporteur", "/espace/demandes");
  const t = await monTransporteur();
  if (!t) redirect("/espace");
  const sp = await searchParams;

  const mesServices = await q<{ service: string }>(
    `SELECT service FROM transporteur_services WHERE transporteur_id=$1`, [t.id]);
  const services = mesServices.length ? mesServices.map((s) => s.service) : ["fret", "pax"];

  const demandes = await q<{
    id: number; reference: string; type: string; distance_km: number;
    date_souhaitee: string | null; nature: string; poids_kg: number | null;
    volume_m3: string | null; palettes: number | null; passagers: number | null;
    precisions: string | null; statut: string; transporteur_cible: number | null;
    depart: string; arrivee: string; nb_devis: string;
    mon_prix: string | null; mon_devise: string | null; mon_statut: string | null;
    mon_delai: string | null; mon_message: string | null; mon_valide: string | null;
    client_tel: string | null;
  }>(
    `SELECT d.id, d.reference, d.type, d.distance_km, d.date_souhaitee, d.nature, d.poids_kg,
            d.volume_m3, d.palettes, d.passagers, d.precisions, d.statut, d.transporteur_cible,
            vd.nom AS depart, va.nom AS arrivee,
            (SELECT COUNT(*) FROM devis x WHERE x.demande_id=d.id) AS nb_devis,
            m.prix AS mon_prix, m.devise AS mon_devise, m.statut AS mon_statut,
            m.delai AS mon_delai, m.message AS mon_message, m.valide_jusqu_au AS mon_valide,
            CASE WHEN m.statut='accepte' THEN u.telephone ELSE NULL END AS client_tel
     FROM demandes d
     JOIN villes vd ON vd.id=d.ville_depart
     JOIN villes va ON va.id=d.ville_arrivee
     JOIN utilisateurs u ON u.id=d.client_id
     LEFT JOIN devis m ON m.demande_id=d.id AND m.transporteur_id=$1
     WHERE (d.statut IN ('ouverte','devis') AND ${DEMANDE_VISIBLE})
        OR m.id IS NOT NULL
     ORDER BY (d.statut='acceptee') DESC, (d.transporteur_cible=$1) DESC, d.cree_le DESC
     LIMIT 50`,
    [t.id, services, t.pays]
  );

  const erreurs: Record<string, string> = {
    non_verifie: "Votre entreprise doit être vérifiée avant de pouvoir répondre aux demandes.",
    introuvable: "Demande introuvable ou déjà attribuée.",
    prix: "Indiquez un prix supérieur à zéro.",
  };

  return (
    <>
      <nav className="crumb"><Link href="/espace">Mon espace</Link> › <span>Demandes</span></nav>
      <h1>Demandes à traiter</h1>
      {sp.ok && (
        <div className="msg ok">{sp.ok === "maj" ? "Devis mis à jour." : "Devis envoyé au client."}</div>
      )}
      {sp.erreur && <div className="msg err">{erreurs[sp.erreur] ?? "Une erreur est survenue."}</div>}

      {t.statut !== "verifie" && (
        <div className="msg att">
          Votre entreprise n&apos;est pas encore vérifiée : vous voyez les demandes mais ne pouvez
          pas encore y répondre. <Link href="/espace/documents">Compléter mon dossier</Link>
        </div>
      )}

      {demandes.length === 0 && (
        <div className="carte vide">
          <b>Aucune demande ouverte pour le moment.</b>
          <p className="small">
            Les nouvelles demandes correspondant à vos services apparaîtront ici.
          </p>
        </div>
      )}

      {demandes.map((d) => (
        <article className="carte" key={d.id}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{d.depart} → {d.arrivee}</h3>
            <span className="muted small">
              {d.distance_km} km · {d.type === "fret" ? "Marchandises" : "Personnes"} ·
              réf. <span className="mono">{d.reference}</span>
            </span>
            <span style={{ flex: 1 }} />
            {d.transporteur_cible === t.id && (
              <span className="tag pri">Demande qui vous est adressée</span>
            )}
            <span className="tag">{d.nb_devis} devis</span>
          </div>

          <p className="small muted" style={{ margin: "8px 0" }}>
            Date souhaitée : {dateFr(d.date_souhaitee)}
            {d.nature ? " · " + d.nature : ""}
            {d.poids_kg ? " · " + d.poids_kg.toLocaleString("fr-FR") + " kg" : ""}
            {d.volume_m3 ? " · " + d.volume_m3 + " m³" : ""}
            {d.palettes ? " · " + d.palettes + " palettes" : ""}
            {d.passagers ? " · " + d.passagers + " passagers" : ""}
          </p>
          {d.precisions && <p className="small">{d.precisions}</p>}

          {d.mon_statut === "accepte" ? (
            <div className="msg ok">
              <b>Mission gagnée.</b> Votre devis de{" "}
              <b>{montant(d.mon_prix ?? 0, d.mon_devise ?? "DZD")}</b> a été accepté par le client.
              {d.client_tel ? ` Contact : ${d.client_tel}.` : ""}
            </div>
          ) : d.mon_statut === "refuse" ? (
            <div className="msg">
              Votre devis de {montant(d.mon_prix ?? 0, d.mon_devise ?? "DZD")} n&apos;a pas été retenu.
            </div>
          ) : t.statut === "verifie" && (d.statut === "ouverte" || d.statut === "devis") ? (
            <form action={repondre}
                  style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}>
              <input type="hidden" name="demande_id" value={d.id} />
              <div className="champ" style={{ width: 170, marginBottom: 0 }}>
                <label className="ch">Votre prix</label>
                <input name="prix" type="text" inputMode="decimal"
                       defaultValue={d.mon_prix ?? ""} required placeholder=" " />
              </div>
              <div className="champ" style={{ width: 200, marginBottom: 0 }}>
                <label className="ch">Délai proposé</label>
                <input name="delai" defaultValue={d.mon_delai ?? ""} placeholder="Ex. enlèvement demain" />
              </div>
              <div className="champ" style={{ width: 170, marginBottom: 0 }}>
                <label className="ch">Valable jusqu&apos;au</label>
                <input name="valide_jusqu_au" type="date" defaultValue={d.mon_valide ?? ""} />
              </div>
              <div className="champ" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
                <label className="ch">Message</label>
                <input name="message" defaultValue={d.mon_message ?? ""}
                       placeholder="Conditions, véhicule proposé…" />
              </div>
              <button className="btn sm" type="submit">
                {d.mon_prix ? "Mettre à jour" : "Envoyer mon devis"}
              </button>
            </form>
          ) : null}
        </article>
      ))}
    </>
  );
}
