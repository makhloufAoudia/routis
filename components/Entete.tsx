import Link from "next/link";
import { utilisateur } from "@/lib/auth";
import { estInstalle } from "@/lib/db";
import BasculeTheme from "./BasculeTheme";
import MenuCompact from "./MenuCompact";

export default async function Entete() {
  const u = await utilisateur();
  let installe = true;
  try { installe = await estInstalle(); } catch { installe = false; }

  return (
    <>
      {!installe && (
        <div className="bandeau-install">
          <div className="in">
            Le site n&apos;est pas encore installé. <Link href="/installer">Lancer l&apos;installation</Link>
          </div>
        </div>
      )}

      <div className="gbar">
        <div className="gbar-in">
          <Link className="logo" href="/">
            <span className="m">R</span>
            <span className="n">rou<i>tis</i></span>
          </Link>
          <form className="gsearch" action="/annuaire" role="search">
            <input type="search" name="q" placeholder="Rechercher un transporteur, une ville…"
                   aria-label="Rechercher un transporteur" />
            <button type="submit" aria-label="Rechercher">⌕</button>
          </form>
          <BasculeTheme />
          <MenuCompact>
            <Link href="/devis">Demander un devis</Link>
            {u ? (
              <>
                {u.role === "transporteur" && <Link href="/espace">Mon espace</Link>}
                {u.role === "admin" && <Link href="/admin">Administration</Link>}
                {u.role === "client" && <Link href="/mes-demandes">Mes demandes</Link>}
                <Link href="/deconnexion">Déconnexion</Link>
              </>
            ) : (
              <>
                <Link href="/inscription?type=transporteur">Devenir transporteur</Link>
                <Link href="/connexion">Connexion</Link>
              </>
            )}
          </MenuCompact>
        </div>
      </div>

      <nav className="tabs">
        <div className="tabs-in">
          <Link href="/annuaire">Annuaire</Link>
          <Link href="/devis?type=fret">Marchandises</Link>
          <Link href="/devis?type=pax">Personnes</Link>
          <span className="sp" />
          {(!u || u.role !== "transporteur") && (
            <Link href="/inscription?type=transporteur">Inscrire mon entreprise</Link>
          )}
        </div>
      </nav>
    </>
  );
}
