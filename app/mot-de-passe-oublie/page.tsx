import { redirect } from "next/navigation";
import Link from "next/link";
import { utilisateur } from "@/lib/auth";
import { q, ligne, journal } from "@/lib/db";
import { envoyerMail, gabarit, urlSite } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mot de passe oublié" };

async function demander(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const u = await ligne<{ id: number; nom: string; email: string }>(
    `SELECT id, nom, email FROM utilisateurs WHERE email=$1 AND statut='actif'`, [email]
  );
  if (u) {
    await q(`UPDATE jetons SET utilise_le=now()
             WHERE utilisateur_id=$1 AND usage_prevu='mot_de_passe' AND utilise_le IS NULL`, [u.id]);
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    const jeton = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    await q(`INSERT INTO jetons (utilisateur_id, jeton, usage_prevu, expire_le)
             VALUES ($1,$2,'mot_de_passe', now() + interval '1 hour')`, [u.id, jeton]);
    await envoyerMail(u.email, "Réinitialiser votre mot de passe",
      gabarit("Réinitialisation du mot de passe",
        `<p>Bonjour ${u.nom},</p><p>Vous avez demandé à réinitialiser votre mot de passe.
         Le lien ci-dessous est valable <b>une heure</b> et ne peut servir qu'une seule fois.</p>
         <p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
        { texte: "Choisir un nouveau mot de passe", url: `${urlSite()}/nouveau-mot-de-passe?jeton=${jeton}` }));
    await journal("mot_de_passe_demande", "utilisateur#" + u.id, "", u.id);
  }
  // même réponse dans tous les cas : on ne révèle pas quelles adresses existent
  redirect("/mot-de-passe-oublie?envoye=1");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ envoye?: string }> }) {
  if (await utilisateur()) redirect("/");
  const sp = await searchParams;

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <h1>Mot de passe oublié</h1>
      {sp.envoye ? (
        <>
          <div className="msg ok">
            Si un compte existe avec cette adresse, un lien de réinitialisation vient d&apos;être
            envoyé. Il est valable une heure. Pensez à regarder dans les courriers indésirables.
          </div>
          <p><Link className="btn sec" href="/connexion">Retour à la connexion</Link></p>
        </>
      ) : (
        <>
          <p className="lede">
            Indiquez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau
            mot de passe.
          </p>
          <form action={demander} className="carte">
            <div className="champ">
              <label className="ch" htmlFor="email">Adresse e-mail</label>
              <input id="email" name="email" type="email" required autoFocus />
            </div>
            <button className="btn pleine" type="submit">Envoyer le lien</button>
          </form>
          <p className="small muted"><Link href="/connexion">Je me souviens de mon mot de passe</Link></p>
        </>
      )}
    </div>
  );
}
