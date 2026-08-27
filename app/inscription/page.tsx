import { redirect } from "next/navigation";
import Link from "next/link";
import { utilisateur, creerCompte, ouvrirSession } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inscrire mon entreprise" };

/** Ce que l'entreprise transporte, tel qu'elle le déclare en s'inscrivant. */
const ACTIVITES: Record<string, { titre: string; detail: string; services: string[] }> = {
  fret: {
    titre: "Des marchandises",
    detail: "Colis, palettes, matériaux, déménagements.",
    services: ["fret"],
  },
  pax: {
    titre: "Des personnes",
    detail: "Transferts, navettes, mise à disposition, tourisme.",
    services: ["pax"],
  },
  tous: {
    titre: "Les deux",
    detail: "Votre entreprise répond aux demandes de marchandises comme de personnes.",
    services: ["fret", "pax"],
  },
};

async function inscrire(formData: FormData) {
  "use server";

  const activite = String(formData.get("activite") ?? "fret");
  const choix = ACTIVITES[activite] ?? ACTIVITES.fret;

  const res = await creerCompte(
    String(formData.get("email") ?? ""),
    String(formData.get("mot_de_passe") ?? ""),
    String(formData.get("nom") ?? ""),
    String(formData.get("telephone") ?? ""),
    "transporteur"
  );
  if (typeof res === "string") {
    redirect("/inscription?erreur=" + encodeURIComponent(res));
  }

  const raison = String(formData.get("raison_sociale") ?? "").trim()
    || String(formData.get("nom") ?? "").trim();
  const t = await q<{ id: number }>(
    `INSERT INTO transporteurs (utilisateur_id, raison_sociale, pays, telephone, statut)
     VALUES ($1,$2,'DZ',$3,'brouillon') RETURNING id`,
    [res, raison, String(formData.get("telephone") ?? "")]
  );

  /* Le service déclaré ici décide des demandes que l'entreprise verra. Il reste
     modifiable ensuite dans sa fiche : c'est le rôle du compte qui est figé,
     pas le métier. */
  for (const s of choix.services) {
    await q(
      `INSERT INTO transporteur_services (transporteur_id, service) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [t[0]!.id, s]
    );
  }

  await ouvrirSession(res);
  redirect("/espace/profil");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ erreur?: string; activite?: string }> }) {
  if (await utilisateur()) redirect("/");
  const sp = await searchParams;
  const defaut = sp.activite && sp.activite in ACTIVITES ? sp.activite : "fret";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>Inscrire mon entreprise</h1>
      <p className="lede">
        Publiez votre entreprise et répondez aux demandes de transport. L&apos;inscription est
        gratuite ; vos documents seront contrôlés avant votre mise en ligne.
      </p>
      {sp.erreur && <div className="msg err">{sp.erreur}</div>}

      <form action={inscrire} className="carte">
        <fieldset className="choix-role">
          <legend>Que transportez-vous ?</legend>
          {Object.entries(ACTIVITES).map(([cle, a]) => (
            <label key={cle}>
              <input type="radio" name="activite" value={cle} defaultChecked={cle === defaut} />
              <span className="t">
                <b>{a.titre}</b>
                <span>{a.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="champ">
          <label className="ch" htmlFor="raison_sociale">Raison sociale</label>
          <input id="raison_sociale" name="raison_sociale" required
                 autoComplete="organization" placeholder=" " />
          <div className="aide">Le nom exact figurant sur votre registre de commerce.</div>
        </div>

        <div className="champ">
          <label className="ch" htmlFor="nom">Nom du responsable</label>
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

        <button className="btn pleine" type="submit">Inscrire mon entreprise</button>
      </form>

      <p className="small muted">
        Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
        {" · "}
        Vous cherchez un transporteur ?{" "}
        <Link href="/inscription-client">Créer un compte client</Link>
      </p>
    </div>
  );
}
