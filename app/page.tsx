import Link from "next/link";
import { q, compter, estInstalle } from "@/lib/db";
import { initiales, noteAffichee } from "@/lib/metier";

export const dynamic = "force-dynamic";

type Vedette = {
  id: number; raison_sociale: string; note: string; nb_missions: number;
  ville: string | null; pays_nom: string | null;
};

export default async function Page() {
  if (!(await estInstalle())) {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1>Bienvenue</h1>
        <div className="msg att">
          Le site n&apos;est pas encore installé. Lancez l&apos;assistant pour créer la base et
          votre compte administrateur.
        </div>
        <p><Link className="btn" href="/installer">Lancer l&apos;installation</Link></p>
      </div>
    );
  }

  const [nbTransporteurs, nbVilles, nbPays, nbMissions] = await Promise.all([
    compter(`SELECT COUNT(*) FROM transporteurs WHERE statut='verifie'`),
    compter(`SELECT COUNT(*) FROM villes`),
    compter(`SELECT COUNT(*) FROM pays WHERE actif`),
    compter(`SELECT COUNT(*) FROM devis WHERE statut='accepte'`),
  ]);

  const vedettes = await q<Vedette>(
    `SELECT t.id, t.raison_sociale, t.note, t.nb_missions, v.nom AS ville, p.nom AS pays_nom
     FROM transporteurs t
     LEFT JOIN villes v ON v.id = t.ville_id
     LEFT JOIN pays p ON p.code = t.pays
     WHERE t.statut='verifie'
     ORDER BY t.note DESC, t.nb_missions DESC LIMIT 6`
  );

  const parPays = await q<{ code: string; nom: string; n: string }>(
    `SELECT p.code, p.nom, COUNT(t.id) AS n
     FROM pays p JOIN transporteurs t ON t.pays=p.code AND t.statut='verifie'
     GROUP BY p.code, p.nom ORDER BY n DESC LIMIT 8`
  );

  return (
    <div className="cols droite">
      <div>
        <h1>Trouvez un transporteur vérifié, obtenez un prix ferme.</h1>
        <p className="lede">
          Décrivez votre besoin en une minute. Les entreprises de transport dont les documents ont
          été contrôlés vous répondent avec un devis. Vous comparez, vous choisissez.
        </p>

        <div className="stat">
          <div><span className="k">Transporteurs vérifiés</span><span className="v">{nbTransporteurs}</span></div>
          <div><span className="k">Villes couvertes</span><span className="v">{nbVilles.toLocaleString("fr-FR")}</span></div>
          <div><span className="k">Pays ouverts</span><span className="v">{nbPays}</span></div>
          <div><span className="k">Missions attribuées</span><span className="v">{nbMissions}</span></div>
        </div>

        <h2>Comment ça marche</h2>
        <div className="grille g3">
          <div className="carte"><h3>1. Décrivez votre besoin</h3>
            <p className="small muted">Trajet, date, nature du chargement ou nombre de passagers.</p></div>
          <div className="carte"><h3>2. Recevez des devis</h3>
            <p className="small muted">Les transporteurs vérifiés vous envoient leur prix et leur délai.</p></div>
          <div className="carte"><h3>3. Choisissez</h3>
            <p className="small muted">Vous comparez les offres et la note de chaque entreprise, puis vous acceptez.</p></div>
        </div>

        {vedettes.length > 0 ? (
          <>
            <h2>Transporteurs les mieux notés</h2>
            {vedettes.map((t) => (
              <article className="sup" key={t.id}>
                <header className="sup-h">
                  <span className="logo-e">{initiales(t.raison_sociale)}</span>
                  <h3><Link href={`/transporteur/${t.id}`}>{t.raison_sociale}</Link></h3>
                  <span className="small muted">
                    {t.ville ? t.ville + ", " : ""}{t.pays_nom} · <b>{noteAffichee(t.note, t.nb_missions)}</b>
                  </span>
                </header>
              </article>
            ))}
            <p><Link className="btn sec" href="/annuaire">Voir tout l&apos;annuaire</Link></p>
          </>
        ) : (
          <div className="carte">
            <h3>L&apos;annuaire se remplit</h3>
            <p className="small muted">
              Aucune entreprise n&apos;est encore publiée. Les transporteurs s&apos;inscrivent,
              déposent leurs documents, et apparaissent ici une fois les pièces validées.
            </p>
            <Link className="btn" href="/inscription?type=transporteur">Inscrire mon entreprise</Link>
          </div>
        )}
      </div>

      <aside>
        <div className="carte">
          <h3 style={{ marginTop: 0 }}>Demander un devis</h3>
          <p className="small muted">Gratuit et sans engagement.</p>
          <Link className="btn pleine" href="/devis?type=fret">Transporter des marchandises</Link>
          <p style={{ margin: "10px 0 0" }}>
            <Link className="btn sec pleine" href="/devis?type=pax">Transport de personnes</Link>
          </p>
        </div>
        <div className="carte">
          <h3 style={{ marginTop: 0 }}>Vous êtes transporteur ?</h3>
          <p className="small muted">
            Recevez des demandes de votre région. Inscription gratuite, commission uniquement sur
            les missions conclues.
          </p>
          <Link className="btn sec pleine" href="/inscription?type=transporteur">Inscrire mon entreprise</Link>
        </div>
        {parPays.length > 0 && (
          <div className="carte">
            <h3 style={{ marginTop: 0 }}>Par pays</h3>
            {parPays.map((p) => (
              <Link key={p.code} className="small" style={{ display: "block", padding: "4px 0" }}
                    href={`/annuaire?pays=${p.code}`}>
                {p.nom} <span className="muted">({p.n})</span>
              </Link>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
