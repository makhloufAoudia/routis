import { redirect } from "next/navigation";
import Link from "next/link";
import { utilisateur, creerCompte, ouvrirSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Créer un compte client" };

/**
 * L'inscription des clients, séparée de celle des entreprises.
 *
 * Les deux publics ne remplissent pas les mêmes champs et ne cherchent pas la
 * même chose : une question « quel compte voulez-vous créer ? » au milieu du
 * chemin n'aidait personne. Chaque lien mène désormais à son formulaire.
 */
async function inscrire(formData: FormData) {
  "use server";
  const res = await creerCompte(
    String(formData.get("email") ?? ""),
    String(formData.get("mot_de_passe") ?? ""),
    String(formData.get("nom") ?? ""),
    String(formData.get("telephone") ?? ""),
    "client"
  );
  if (typeof res === "string") {
    redirect("/inscription-client?erreur=" + encodeURIComponent(res));
  }
  await ouvrirSession(res);
  redirect("/devis");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ erreur?: string }> }) {
  if (await utilisateur()) redirect("/");
  const sp = await searchParams;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>Créer un compte client</h1>
      <p className="lede">
        Décrivez votre besoin, comparez les devis reçus, choisissez votre transporteur.
        L&apos;inscription est gratuite et sans engagement.
      </p>
      {sp.erreur && <div className="msg err">{sp.erreur}</div>}

      <form action={inscrire} className="carte">
        <div className="champ">
          <label className="ch" htmlFor="nom">Votre nom</label>
          <input id="nom" name="nom" required autoComplete="name" placeholder=" " />
        </div>
        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder=" " />
          </div>
          <div className="champ">
            <label className="ch" htmlFor="telephone">Téléphone</label>
            <input id="telephone" name="telephone" type="tel" autoComplete="tel" placeholder=" " />
          </div>
        </div>
        <div className="champ">
          <label className="ch" htmlFor="mot_de_passe">Mot de passe</label>
          <input id="mot_de_passe" name="mot_de_passe" type="password" minLength={8} required
                 autoComplete="new-password" placeholder=" " />
          <div className="aide">8 caractères minimum.</div>
        </div>
        <button className="btn pleine" type="submit">Créer mon compte</button>
      </form>

      <p className="small muted">
        Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
        {" · "}
        Vous êtes transporteur ?{" "}
        <Link href="/inscription">Inscrire mon entreprise</Link>
      </p>
    </div>
  );
}
