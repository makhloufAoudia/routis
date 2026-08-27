import { redirect } from "next/navigation";
import Link from "next/link";
import {
  utilisateur, verifierIdentifiants, ouvrirSession,
  tropDeTentatives, noterEchec, effacerEchecs,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion" };

async function connecter(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const mdp = String(formData.get("mot_de_passe") ?? "");
  const suite = String(formData.get("suite") ?? "");

  if (await tropDeTentatives(email)) redirect("/connexion?erreur=trop");

  const u = await verifierIdentifiants(email, mdp);
  if (!u) {
    await noterEchec(email);
    redirect("/connexion?erreur=1" + (suite ? "&suite=" + encodeURIComponent(suite) : ""));
  }
  await effacerEchecs(email);
  await ouvrirSession(u.id);

  if (suite && suite.startsWith("/")) redirect(suite);
  if (u.role === "admin") redirect("/admin");
  if (u.role === "transporteur") redirect("/espace");
  redirect("/mes-demandes");
}

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ erreur?: string; suite?: string }> }) {
  if (await utilisateur()) redirect("/");
  const sp = await searchParams;

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <h1>Connexion</h1>
      {sp.erreur === "trop" && (
        <div className="msg err">Trop de tentatives. Réessayez dans dix minutes.</div>
      )}
      {sp.erreur === "1" && (
        <div className="msg err">Adresse e-mail ou mot de passe incorrect.</div>
      )}
      <form action={connecter} className="carte">
        <input type="hidden" name="suite" value={sp.suite ?? ""} />
        <div className="champ">
          <label className="ch" htmlFor="email">Adresse e-mail</label>
          <input id="email" name="email" type="email" required autoFocus autoComplete="username" placeholder=" " />
        </div>
        <div className="champ">
          <label className="ch" htmlFor="mot_de_passe">Mot de passe</label>
          <input id="mot_de_passe" name="mot_de_passe" type="password" required
                 autoComplete="current-password" placeholder=" " />
        </div>
        <button className="btn pleine" type="submit">Se connecter</button>
        <p className="small" style={{ margin: "12px 0 0", textAlign: "center" }}>
          <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </p>
      </form>
      {/* Deux publics, deux inscriptions : chacune sur sa ligne, et de couleurs
          différentes pour qu'on ne prenne pas l'une pour l'autre. */}
      <p className="small muted" style={{ marginBottom: 8 }}>Pas encore de compte ?</p>
      <div className="choix-compte">
        <Link className="btn pleine" href="/inscription-client">Créer un compte client</Link>
        <Link className="btn sec pleine" href="/inscription">
          Inscrire mon entreprise
        </Link>
      </div>
    </div>
  );
}
