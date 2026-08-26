import Link from "next/link";
import { redirect } from "next/navigation";
import ListeFiltrable from "@/components/ListeFiltrable";
import { utilisateur } from "@/lib/auth";
import { q, ligne, journal } from "@/lib/db";
import { EQUIPEMENTS, distanceKm, nouvelleReference } from "@/lib/metier";
import { mailNouvelleDemande } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demander un devis" };

type Ville = { id: number; nom: string; lat: string; lon: string };

async function deposer(formData: FormData) {
  "use server";
  const u = await utilisateur();
  const type = String(formData.get("type") ?? "fret") === "pax" ? "pax" : "fret";
  const cible = parseInt(String(formData.get("transporteur") ?? ""), 10) || null;

  if (!u) {
    redirect("/connexion?suite=" + encodeURIComponent(`/devis?type=${type}`));
  }

  const depart = parseInt(String(formData.get("depart") ?? ""), 10) || 0;
  const arrivee = parseInt(String(formData.get("arrivee") ?? ""), 10) || 0;
  const vd = depart ? await ligne<Ville>(`SELECT * FROM villes WHERE id=$1`, [depart]) : null;
  const va = arrivee ? await ligne<Ville>(`SELECT * FROM villes WHERE id=$1`, [arrivee]) : null;

  if (!vd || !va) redirect(`/devis?type=${type}&erreur=villes`);
  if (vd.id === va.id) redirect(`/devis?type=${type}&erreur=identiques`);

  const date = String(formData.get("date_souhaitee") ?? "");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(`/devis?type=${type}&erreur=date`);

  const equips = formData
    .getAll("equip")
    .map(String)
    .filter((e) => e in EQUIPEMENTS);

  const nombre = (cle: string) => {
    const v = parseInt(String(formData.get(cle) ?? ""), 10);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const decimal = (cle: string) => {
    const v = parseFloat(String(formData.get(cle) ?? "").replace(",", "."));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  const ref = nouvelleReference();
  const cree = await ligne<{ id: number }>(
    `INSERT INTO demandes
      (reference, client_id, type, ville_depart, ville_arrivee, distance_km, date_souhaitee,
       nature, poids_kg, volume_m3, palettes, passagers, equipements, precisions, transporteur_cible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      ref, u.id, type, vd.id, va.id,
      distanceKm(parseFloat(vd.lat), parseFloat(vd.lon), parseFloat(va.lat), parseFloat(va.lon)),
      date || null,
      String(formData.get("nature") ?? "").slice(0, 120),
      type === "fret" ? nombre("poids") : null,
      type === "fret" ? decimal("volume") : null,
      type === "fret" ? nombre("palettes") : null,
      type === "pax" ? nombre("passagers") : null,
      equips.join(","),
      String(formData.get("precisions") ?? ""),
      cible,
    ]
  );

  await journal("demande_creee", "demande#" + cree!.id, ref, u.id);
  await mailNouvelleDemande(
    {
      id: cree!.id, reference: ref, client_id: u.id, type,
      depart: vd.nom, arrivee: va.nom,
      distance_km: distanceKm(parseFloat(vd.lat), parseFloat(vd.lon), parseFloat(va.lat), parseFloat(va.lon)),
      date_souhaitee: date || null,
    },
    vd.id,
    cible
  );

  redirect(`/demande/${cree!.id}`);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; transporteur?: string; erreur?: string }>;
}) {
  const sp = await searchParams;
  const type = sp.type === "pax" ? "pax" : "fret";
  const cibleId = parseInt(sp.transporteur ?? "", 10) || 0;
  const u = await utilisateur();

  const cible = cibleId
    ? await ligne<{ id: number; raison_sociale: string; pays: string }>(
        `SELECT id, raison_sociale, pays FROM transporteurs WHERE id=$1 AND statut='verifie'`,
        [cibleId]
      )
    : null;

  const pays = cible?.pays ?? "DZ";
  const villes = await q<{ id: number; nom: string }>(
    `SELECT id, nom FROM villes WHERE pays=$1 ORDER BY population DESC LIMIT 400`,
    [pays]
  );

  const messages: Record<string, string> = {
    villes: "Choisissez une ville de départ et une ville d'arrivée dans la liste.",
    identiques: "Le départ et l'arrivée sont identiques.",
    date: "La date n'est pas valide.",
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <h1>Demander un devis</h1>
      <p className="lede">
        Décrivez votre besoin. Les transporteurs vérifiés qui correspondent vous enverront un
        prix ferme.
      </p>

      {cible && (
        <div className="msg info">
          Votre demande sera adressée à <b>{cible.raison_sociale}</b>, et à elle seule.
          Pour comparer plusieurs prix, repassez par{" "}
          <Link href="/devis">Demander un devis</Link> : la demande partira alors à tous
          les transporteurs vérifiés qui correspondent.
        </div>
      )}
      {sp.erreur && <div className="msg err">{messages[sp.erreur] ?? "Une erreur est survenue."}</div>}
      {!u && (
        <div className="msg att">
          Vous devrez vous connecter (ou créer un compte) au moment d&apos;envoyer la demande.
        </div>
      )}

      <form action={deposer} className="carte">
        <input type="hidden" name="transporteur" value={cibleId || ""} />

        <div className="champ">
          <label className="ch">Type de transport</label>
          <label className="coche">
            <input type="radio" name="type" value="fret" defaultChecked={type === "fret"} />
            <span>Marchandises</span>
          </label>
          <label className="coche">
            <input type="radio" name="type" value="pax" defaultChecked={type === "pax"} />
            <span>Personnes</span>
          </label>
        </div>

        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="depart">Ville de départ</label>
            <ListeFiltrable id="depart" nom="depart" requis
                            options={villes.map((v) => ({ v: String(v.id), l: v.nom }))} />
          </div>
          <div className="champ">
            <label className="ch" htmlFor="arrivee">Ville d&apos;arrivée</label>
            <ListeFiltrable id="arrivee" nom="arrivee" requis
                            options={villes.map((v) => ({ v: String(v.id), l: v.nom }))} />
          </div>
        </div>

        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="date_souhaitee">Date souhaitée</label>
            <input id="date_souhaitee" name="date_souhaitee" type="date" />
          </div>
          <div className="champ">
            <label className="ch" htmlFor="nature">Nature du transport</label>
            <input id="nature" name="nature" placeholder="Ex. mobilier, palettes, matériaux…" />
          </div>
        </div>

        <fieldset>
          <legend>Marchandises</legend>
          <div className="grille g3">
            <div className="champ">
              <label className="ch" htmlFor="poids">Poids (kg)</label>
              <input id="poids" name="poids" type="number" min="0" step="1" placeholder=" " />
            </div>
            <div className="champ">
              <label className="ch" htmlFor="volume">Volume (m³)</label>
              <input id="volume" name="volume" type="number" min="0" step="0.1" placeholder=" " />
            </div>
            <div className="champ">
              <label className="ch" htmlFor="palettes">Palettes</label>
              <input id="palettes" name="palettes" type="number" min="0" step="1" placeholder=" " />
            </div>
          </div>
          <label className="ch">Besoins particuliers</label>
          {Object.entries(EQUIPEMENTS).map(([k, lab]) => (
            <label className="coche" key={k}>
              <input type="checkbox" name="equip" value={k} />
              <span>{lab}</span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Personnes</legend>
          <div className="champ" style={{ maxWidth: 220 }}>
            <label className="ch" htmlFor="passagers">Nombre de passagers</label>
            <input id="passagers" name="passagers" type="number" min="1" max="60" placeholder=" " />
          </div>
        </fieldset>

        <div className="champ">
          <label className="ch" htmlFor="precisions">Précisions</label>
          <textarea id="precisions" name="precisions"
                    placeholder="Adresses exactes, contraintes horaires, étage, accès…" />
        </div>

        <button className="btn pleine" type="submit">Envoyer ma demande</button>
      </form>
    </div>
  );
}
