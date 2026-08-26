import { redirect } from "next/navigation";
import Link from "next/link";
import { utilisateur, changerMotDePasse } from "@/lib/auth";
import { q, ligne } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouveau mot de passe" };

type LigneJeton = { id: number; utilisateur_id: number; email: string };

async function chercherJeton(jeton: string): Promise<LigneJeton | null> {
  if (!/^[a-f0-9]{64}$/.test(jeton)) return null;
  return await ligne<LigneJeton>(
    `SELECT j.id, j.utilisateur_id, u.email
     FROM jetons j JOIN utilisateurs u ON u.id = j.utilisateur_id
     WHERE j.jeton=$1 AND j.usage_prevu='mot_de_passe'
       AND j.utilise_le IS NULL AND j.expire_le > now()`, [jeton]);
}

async function enregistrer(formData: FormData) {
  "use server";
  const jeton = String(formData.get("jeton") ?? "");
  const mdp = String(formData.get("mot_de_passe") ?? "");
  const conf = String(formData.get("confirmation") ?? "");
  const lj = await chercherJeton(jeton);
  if (!lj) redirect("/nouveau-mot-de-passe?jeton=" + jeton);
  if (mdp.length < 8) redirect(`/nouveau-mot-de-passe?jeton=${jeton}&erreur=court`);
  if (mdp !== conf) redirect(`/nouveau-mot-de-passe?jeton=${jeton}&erreur=different`);
  await changerMotDePasse(lj.utilisateur_id, mdp);
  await q(`UPDATE jetons SET utilise_le=now() WHERE id=$1`, [lj.id]);
  redirect("/nouveau-mot-de-passe?fait=1");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ jeton?: string; erreur?: string; fait?: string }> }) {
  if (await utilisateur()) redirect("/");
  const sp = await searchParams;

  if (sp.fait) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1>Nouveau mot de passe</h1>
        <div className="msg ok">Votre mot de passe a été changé. Vous pouvez vous connecter.</div>
        <p><Link className="btn" href="/connexion">Se connecter</Link></p>
      </div>
    );
  }

  const lj = await chercherJeton(sp.jeton ?? "");
  if (!lj) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1>Nouveau mot de passe</h1>
        <div className="msg err">
          Ce lien n&apos;est plus valable : il a déjà servi, ou il a plus d&apos;une heure.
        </div>
        <p><Link className="btn" href="/mot-de-passe-oublie">Demander un nouveau lien</Link></p>
      </div>
    );
  }

  const messages: Record<string, string> = {
    court: "Le mot de passe doit contenir au moins 8 caractères.",
    different: "Les deux mots de passe ne correspondent pas.",
  };

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <h1>Nouveau mot de passe</h1>
      <p className="lede">Compte : <b>{lj.email}</b></p>
      {sp.erreur && <div className="msg err">{messages[sp.erreur]}</div>}
      <form action={enregistrer} className="carte">
        <input type="hidden" name="jeton" value={sp.jeton ?? ""} />
        <div className="champ">
          <label className="ch" htmlFor="mot_de_passe">Nouveau mot de passe</label>
          <input id="mot_de_passe" name="mot_de_passe" type="password" minLength={8} required autoFocus placeholder=" " />
          <div className="aide">8 caractères minimum.</div>
        </div>
        <div className="champ">
          <label className="ch" htmlFor="confirmation">Confirmation</label>
          <input id="confirmation" name="confirmation" type="password" minLength={8} required placeholder=" " />
        </div>
        <button className="btn pleine" type="submit">Enregistrer</button>
      </form>
    </div>
  );
}
