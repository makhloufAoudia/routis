import Link from "next/link";
import { utilisateur } from "@/lib/auth";
import { estInstalle } from "@/lib/db";
import { enAttente } from "@/lib/attente";
import BasculeTheme from "./BasculeTheme";
import MenuCompact from "./MenuCompact";
import Onglets from "./Onglets";
import { Suspense } from "react";

export default async function Entete() {
  const u = await utilisateur();
  let installe = true;
  try { installe = await estInstalle(); } catch { installe = false; }
  const attente = installe ? await enAttente(u) : null;

  /* Le compteur ne se colle qu'au lien qui y mène : ailleurs il ne voudrait rien dire. */
  const pastille = (lien: string) =>
    attente && attente.lien === lien ? (
      <span className="pastille">
        {attente.nombre}
        <span className="lu-seul"> {attente.libelle}</span>
      </span>
    ) : null;

  /* Le logo porte le rôle : sans lui, rien à l'écran ne dit sous quel compte
     on navigue, et les espaces client et transporteur se ressemblent trop. */
  const roles: Record<string, string> = {
    client: "client",
    transporteur: "pro",
    admin: "admin",
  };
  const role = u ? roles[u.role] : null;

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
            {role && <span className="logo-r">{role}</span>}
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
                {u.role === "transporteur" && (
                  <Link href="/espace/demandes">Mon espace{pastille("/espace/demandes")}</Link>
                )}
                {u.role === "admin" && (
                  <Link href="/admin">Administration{pastille("/admin")}</Link>
                )}
                {u.role === "client" && (
                  <Link href="/mes-demandes">Mes demandes{pastille("/mes-demandes")}</Link>
                )}
                <Link href="/deconnexion">Déconnexion</Link>
              </>
            ) : (
              <>
                <Link href="/inscription">Devenir transporteur</Link>
                <Link href="/connexion">Connexion</Link>
              </>
            )}
          </MenuCompact>
        </div>
      </div>

      {/* Lire la requête oblige à passer côté navigateur ; le repli affiche les
          mêmes onglets sans mise en évidence, jamais une barre vide. */}
      <Suspense fallback={
        <nav className="tabs" aria-label="Sections principales">
          <div className="tabs-in">
            <Link href="/annuaire">Annuaire</Link>
            <Link href="/devis?type=fret">Marchandises</Link>
            <Link href="/devis?type=pax">Personnes</Link>
          </div>
        </nav>
      }>
        <Onglets />
      </Suspense>
    </>
  );
}
