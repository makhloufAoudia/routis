import { redirect } from "next/navigation";
import Link from "next/link";
import { utilisateur, creerCompte, ouvrirSession } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Créer un compte" };

async function inscrire(formData: FormData) {
  "use server";
  const type = String(formData.get("type") ?? "client") === "transporteur" ? "transporteur" : "client";
  const res = await creerCompte(
    String(formData.get("email") ?? ""),
    String(formData.get("mot_de_passe") ?? ""),
    String(formData.get("nom") ?? ""),
    String(formData.get("telephone") ?? ""),
    type
  );
  if (typeof res === "string") {
    redirect(`/inscription?type=${type}&erreur=` + encodeURIComponent(res));
  }
  if (type === "transporteur") {
    const raison = String(formData.get("raison_sociale") ?? "").trim()
      || String(formData.get("nom") ?? "").trim();
    await q(
      `INSERT INTO transporteurs (utilisateur_id, raison_sociale, pays, telephone, statut)
       VALUES ($1,$2,'DZ',$3,'brouillon')`,
      [res, raison, String(formData.get("telephone") ?? "")]
    );
  }
  await ouvrirSession(res);
  redirect(type === "transporteur" ? "/espace/profil" : "/devis");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ type?: string; erreur?: string }> }) {
  if (await utilisateur()) redirect("/");
  const sp = await searchParams;
  const type = sp.type === "transporteur" ? "transporteur" : "client";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>{type === "transporteur" ? "Inscrire mon entreprise" : "Créer un compte"}</h1>
      <p className="lede">
        {type === "transporteur"
          ? "Créez votre compte, complétez votre fiche puis déposez vos documents. Votre entreprise apparaîtra dans l'annuaire une fois les pièces validées."
          : "Un compte suffit pour déposer une demande et recevoir des devis."}
      </p>
      {sp.erreur && <div className="msg err">{sp.erreur}</div>}

      <form action={inscrire} className="carte">
        <input type="hidden" name="type" value={type} />
        {type === "transporteur" && (
          <div className="champ">
            <label className="ch" htmlFor="raison_sociale">Raison sociale</label>
            <input id="raison_sociale" name="raison_sociale" required />
            <div className="aide">Le nom exact figurant sur votre registre de commerce.</div>
          </div>
        )}
        <div className="champ">
          <label className="ch" htmlFor="nom">
            {type === "transporteur" ? "Nom du responsable" : "Votre nom"}
          </label>
          <input id="nom" name="nom" required />
        </div>
        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="champ">
            <label className="ch" htmlFor="telephone">Téléphone</label>
            <input id="telephone" name="telephone" type="tel" />
          </div>
        </div>
        <div className="champ">
          <label className="ch" htmlFor="mot_de_passe">Mot de passe</label>
          <input id="mot_de_passe" name="mot_de_passe" type="password" minLength={8} required />
          <div className="aide">8 caractères minimum.</div>
        </div>
        <button className="btn pleine" type="submit">Créer mon compte</button>
      </form>
      <p className="small muted">Déjà inscrit ? <Link href="/connexion">Se connecter</Link></p>
    </div>
  );
}
