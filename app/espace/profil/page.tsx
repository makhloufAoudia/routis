import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerRole, monTransporteur } from "@/lib/auth";
import { q, journal, compter } from "@/lib/db";
import { SERVICES, EQUIPEMENTS, COUVERTURES, EFFECTIFS } from "@/lib/metier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ma fiche entreprise" };

async function enregistrer(formData: FormData) {
  "use server";
  await exigerRole("transporteur");
  const t = await monTransporteur();
  if (!t) redirect("/espace");

  const raison = String(formData.get("raison_sociale") ?? "").trim();
  if (!raison) redirect("/espace/profil?erreur=raison");

  let pays = String(formData.get("pays") ?? "DZ");
  if (!(await compter(`SELECT COUNT(*) FROM pays WHERE code=$1`, [pays]))) pays = "DZ";

  let ville: number | null = parseInt(String(formData.get("ville_id") ?? ""), 10) || null;
  if (ville && !(await compter(`SELECT COUNT(*) FROM villes WHERE id=$1 AND pays=$2`, [ville, pays]))) {
    ville = null;
  }

  const annee = parseInt(String(formData.get("annee_creation") ?? ""), 10) || null;
  if (annee && (annee < 1900 || annee > new Date().getFullYear())) {
    redirect("/espace/profil?erreur=annee");
  }

  const couverture = String(formData.get("couverture") ?? "nationale");

  await q(
    `UPDATE transporteurs SET raison_sociale=$1, forme=$2, registre=$3, pays=$4, ville_id=$5,
       adresse=$6, telephone=$7, site_web=$8, description=$9, annee_creation=$10,
       effectif=$11, couverture=$12
     WHERE id=$13`,
    [
      raison,
      String(formData.get("forme") ?? "").slice(0, 40),
      String(formData.get("registre") ?? "").slice(0, 80),
      pays, ville,
      String(formData.get("adresse") ?? "").slice(0, 220),
      String(formData.get("telephone") ?? "").slice(0, 40),
      String(formData.get("site_web") ?? "").slice(0, 190),
      String(formData.get("description") ?? ""),
      annee,
      String(formData.get("effectif") ?? ""),
      couverture in COUVERTURES ? couverture : "nationale",
      t.id,
    ]
  );

  await q(`DELETE FROM transporteur_services WHERE transporteur_id=$1`, [t.id]);
  for (const s of formData.getAll("service").map(String)) {
    if (s in SERVICES) {
      await q(`INSERT INTO transporteur_services (transporteur_id, service) VALUES ($1,$2)
               ON CONFLICT DO NOTHING`, [t.id, s]);
    }
  }
  await q(`DELETE FROM transporteur_equipements WHERE transporteur_id=$1`, [t.id]);
  for (const e of formData.getAll("equip").map(String)) {
    if (e in EQUIPEMENTS) {
      await q(`INSERT INTO transporteur_equipements (transporteur_id, equipement) VALUES ($1,$2)
               ON CONFLICT DO NOTHING`, [t.id, e]);
    }
  }

  await journal("profil_modifie", "transporteur#" + t.id);
  redirect("/espace/profil?ok=1");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ pays?: string; ok?: string; erreur?: string }> }) {
  await exigerRole("transporteur", "/espace/profil");
  const t = await monTransporteur();
  if (!t) redirect("/espace");
  const sp = await searchParams;

  const paysAffiche =
    sp.pays && (await compter(`SELECT COUNT(*) FROM pays WHERE code=$1`, [sp.pays]))
      ? sp.pays
      : t.pays;

  const [paysListe, villes, mesServices, mesEquips] = await Promise.all([
    q<{ code: string; nom: string }>(`SELECT code, nom FROM pays ORDER BY nom`),
    q<{ id: number; nom: string }>(
      `SELECT id, nom FROM villes WHERE pays=$1 ORDER BY population DESC LIMIT 400`, [paysAffiche]),
    q<{ service: string }>(`SELECT service FROM transporteur_services WHERE transporteur_id=$1`, [t.id]),
    q<{ equipement: string }>(`SELECT equipement FROM transporteur_equipements WHERE transporteur_id=$1`, [t.id]),
  ]);
  const services = new Set(mesServices.map((s) => s.service));
  const equips = new Set(mesEquips.map((e) => e.equipement));

  const messages: Record<string, string> = {
    raison: "La raison sociale est obligatoire.",
    annee: "L'année de création n'est pas valide.",
  };

  return (
    <>
      <nav className="crumb"><Link href="/espace">Mon espace</Link> › <span>Fiche entreprise</span></nav>
      <h1>Ma fiche entreprise</h1>
      {sp.ok && <div className="msg ok">Fiche enregistrée.</div>}
      {sp.erreur && <div className="msg err">{messages[sp.erreur] ?? "Une erreur est survenue."}</div>}

      <form action={enregistrer} className="carte" style={{ maxWidth: 820 }}>
        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="raison_sociale">Raison sociale</label>
            <input id="raison_sociale" name="raison_sociale" defaultValue={t.raison_sociale} required />
          </div>
          <div className="champ">
            <label className="ch" htmlFor="forme">Forme juridique</label>
            <input id="forme" name="forme" defaultValue={t.forme} placeholder="SARL, EURL, SPA, ETS…" />
          </div>
        </div>
        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="registre">N° de registre de commerce</label>
            <input id="registre" name="registre" defaultValue={t.registre} />
          </div>
          <div className="champ">
            <label className="ch" htmlFor="annee_creation">Année de création</label>
            <input id="annee_creation" name="annee_creation" type="number" min={1900}
                   max={new Date().getFullYear()} defaultValue={t.annee_creation ?? ""} />
          </div>
        </div>
        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="pays">Pays</label>
            <select id="pays" name="pays" defaultValue={paysAffiche}>
              {paysListe.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
            </select>
            <div className="aide">
              Pour changer la liste des villes,{" "}
              <Link href="/espace/profil?pays=FR">rechargez avec un autre pays</Link>.
            </div>
          </div>
          <div className="champ">
            <label className="ch" htmlFor="ville_id">Ville</label>
            <select id="ville_id" name="ville_id" defaultValue={String(t.ville_id ?? "")}>
              <option value="">— choisir —</option>
              {villes.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
            </select>
          </div>
        </div>
        <div className="champ">
          <label className="ch" htmlFor="adresse">Adresse</label>
          <input id="adresse" name="adresse" defaultValue={t.adresse} />
        </div>
        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="telephone">Téléphone</label>
            <input id="telephone" name="telephone" type="tel" defaultValue={t.telephone} />
          </div>
          <div className="champ">
            <label className="ch" htmlFor="site_web">Site internet</label>
            <input id="site_web" name="site_web" defaultValue={t.site_web} placeholder="https://" />
          </div>
        </div>
        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="effectif">Effectif</label>
            <select id="effectif" name="effectif" defaultValue={t.effectif}>
              {EFFECTIFS.map((e) => (
                <option key={e} value={e}>{e === "" ? "— non précisé —" : e + " salariés"}</option>
              ))}
            </select>
          </div>
          <div className="champ">
            <label className="ch" htmlFor="couverture">Zone couverte</label>
            <select id="couverture" name="couverture" defaultValue={t.couverture}>
              {Object.entries(COUVERTURES).map(([k, lab]) => (
                <option key={k} value={k}>{lab}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend>Services proposés</legend>
          {Object.entries(SERVICES).map(([k, lab]) => (
            <label className="coche" key={k}>
              <input type="checkbox" name="service" value={k} defaultChecked={services.has(k)} />
              <span>{lab}</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Équipements</legend>
          {Object.entries(EQUIPEMENTS).map(([k, lab]) => (
            <label className="coche" key={k}>
              <input type="checkbox" name="equip" value={k} defaultChecked={equips.has(k)} />
              <span>{lab}</span>
            </label>
          ))}
        </fieldset>

        <div className="champ">
          <label className="ch" htmlFor="description">Présentation publique</label>
          <textarea id="description" name="description" defaultValue={t.description ?? ""}
                    placeholder="Votre activité, vos spécialités, vos zones d'intervention." />
          <div className="aide">Ce texte apparaît sur votre fiche dans l&apos;annuaire.</div>
        </div>

        <button className="btn" type="submit">Enregistrer</button>
      </form>
    </>
  );
}
