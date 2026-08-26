import { redirect } from "next/navigation";
import { estInstalle, q, compter, ligne } from "@/lib/db";
import { SCHEMA } from "@/lib/schema";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Installation" };

/**
 * Découpe une ligne CSV en tenant compte des guillemets :
 * certains noms contiennent une virgule, comme « Mianzhu, Deyang, Sichuan ».
 */
function colonnes(ligne: string): string[] {
  const sortie: string[] = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') { courant += '"'; i++; }
      else entreGuillemets = !entreGuillemets;
    } else if (c === "," && !entreGuillemets) {
      sortie.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  sortie.push(courant);
  return sortie.map((s) => s.trim());
}

async function installer(formData: FormData) {
  "use server";

  if (await estInstalle()) redirect("/installer?etat=deja");

  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/installer?erreur=email");
  if (motDePasse.length < 8) redirect("/installer?erreur=mdp");
  if (!nom) redirect("/installer?erreur=nom");

  try {
    // 1. Structure
    for (const instruction of SCHEMA) await q(instruction);

    // 2. Pays
    if ((await compter(`SELECT COUNT(*) FROM pays`)) === 0) {
      const { PAYS_CSV } = await import("@/lib/donnees/pays");
      const lignes = PAYS_CSV.trim().split("\n").slice(1);
      for (let i = 0; i < lignes.length; i += 200) {
        const lot = lignes.slice(i, i + 200).map(colonnes).filter((c) => c.length >= 5);
        const valeurs: unknown[] = [];
        const morceaux = lot.map((c, k) => {
          valeurs.push(c[0], c[1], c[2] || "EUR", c[3], c[4]);
          const d = k * 5;
          return `($${d + 1},$${d + 2},$${d + 3},$${d + 4},$${d + 5})`;
        });
        await q(
          `INSERT INTO pays (code,nom,devise,continent,indicatif) VALUES ${morceaux.join(",")}
           ON CONFLICT (code) DO NOTHING`,
          valeurs
        );
      }
      await q(`UPDATE pays SET actif=true, tva=19 WHERE code IN ('DZ','TN')`);
      await q(`UPDATE pays SET actif=true, tva=20 WHERE code IN ('FR','MA')`);
    }

    // 3. Villes
    if ((await compter(`SELECT COUNT(*) FROM villes`)) === 0) {
      const { VILLES_CSV } = await import("@/lib/donnees/villes");
      const lignes = VILLES_CSV.trim().split("\n").slice(1);
      for (let i = 0; i < lignes.length; i += 500) {
        const lot = lignes.slice(i, i + 500).map(colonnes).filter((c) => c.length >= 5);
        const valeurs: unknown[] = [];
        const morceaux = lot.map((c, k) => {
          valeurs.push(c[0], c[1], c[2], c[3], parseInt(c[4], 10) || 0);
          const d = k * 5;
          return `($${d + 1},$${d + 2},$${d + 3},$${d + 4},$${d + 5})`;
        });
        await q(`INSERT INTO villes (nom,pays,lat,lon,population) VALUES ${morceaux.join(",")}`, valeurs);
      }
    }

    // 4. Compte administrateur
    const existe = await ligne(`SELECT id FROM utilisateurs WHERE email=$1`, [email]);
    if (!existe) {
      await q(
        `INSERT INTO utilisateurs (role,email,nom,mot_de_passe) VALUES ('admin',$1,$2,$3)`,
        [email, nom, await bcrypt.hash(motDePasse, 10)]
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erreur inconnue";
    redirect("/installer?erreur=base&detail=" + encodeURIComponent(msg.slice(0, 200)));
  }

  redirect("/installer?etat=fait");
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string; erreur?: string; detail?: string }>;
}) {
  const sp = await searchParams;
  const installe = await estInstalle();

  const messages: Record<string, string> = {
    email: "L'adresse e-mail n'est pas valide.",
    mdp: "Le mot de passe doit contenir au moins 8 caractères.",
    nom: "Indiquez votre nom.",
    base: "La base de données a refusé l'opération. " + (sp.detail ?? ""),
  };

  if (sp.etat === "fait") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1>Installation terminée</h1>
        <div className="msg ok">
          La base est créée, les 6 495 villes et 244 pays sont importés, et votre compte
          administrateur est actif.
        </div>
        <div className="msg att">
          <b>Pensez à retirer l&apos;accès à cette page.</b> Une fois un administrateur créé,
          l&apos;assistant se verrouille tout seul : il refusera toute nouvelle installation.
        </div>
        <p>
          <a className="btn" href="/connexion">Me connecter</a>{" "}
          <a className="btn sec" href="/">Voir le site</a>
        </p>
      </div>
    );
  }

  if (installe) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1>Le site est déjà installé</h1>
        <div className="msg att">
          Un compte administrateur existe déjà. L&apos;assistant est verrouillé.
        </div>
        <p><a className="btn" href="/">Aller au site</a></p>
      </div>
    );
  }

  const urlPresente = Boolean(process.env.DATABASE_URL);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>Installation de ROUTIS</h1>
      <p className="lede">
        Trois minutes. Créez d&apos;abord une base PostgreSQL gratuite, collez son adresse dans
        la variable <code>DATABASE_URL</code>, puis créez votre compte administrateur ici.
      </p>

      {sp.erreur && <div className="msg err">{messages[sp.erreur] ?? "Une erreur est survenue."}</div>}

      <div className={urlPresente ? "msg ok" : "msg err"}>
        <b>Base de données :</b>{" "}
        {urlPresente
          ? "la variable DATABASE_URL est bien renseignée."
          : "la variable DATABASE_URL est absente. Renseignez-la dans les réglages de votre hébergeur, puis rechargez cette page."}
      </div>

      {urlPresente && (
        <form action={installer} className="carte">
          <h2 style={{ marginTop: 0 }}>Votre compte administrateur</h2>
          <div className="champ">
            <label className="ch" htmlFor="nom">Nom complet</label>
            <input id="nom" name="nom" required placeholder=" " />
          </div>
          <div className="grille g2">
            <div className="champ">
              <label className="ch" htmlFor="email">Adresse e-mail</label>
              <input id="email" name="email" type="email" required placeholder=" " />
            </div>
            <div className="champ">
              <label className="ch" htmlFor="mot_de_passe">Mot de passe</label>
              <input id="mot_de_passe" name="mot_de_passe" type="password" minLength={8} required placeholder=" " />
              <div className="aide">8 caractères minimum.</div>
            </div>
          </div>
          <button className="btn pleine" type="submit">Installer le site</button>
          <p className="aide" style={{ marginTop: 10 }}>
            L&apos;import des 6 495 villes prend quelques secondes.
          </p>
        </form>
      )}
    </div>
  );
}
