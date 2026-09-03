import Link from "next/link";
import ListeFiltrable from "@/components/ListeFiltrable";
import { q, compter, valeur, estInstalle } from "@/lib/db";
import { SERVICES, EQUIPEMENTS, COUVERTURES, initiales, noteAffichee, extrait } from "@/lib/metier";
import Soumettre from "@/components/Soumettre";

export const dynamic = "force-dynamic";

type Params = {
  pays?: string; q?: string; ville?: string;
  service?: string | string[]; equip?: string | string[];
  note?: string; tri?: string; page?: string;
};

type Ligne = {
  id: number; raison_sociale: string; description: string | null;
  annee_creation: number | null; effectif: string; couverture: string;
  note: string; nb_missions: number; ville: string | null; pays_nom: string | null;
  nb_vehicules: string; services: string[] | null; equipements: string[] | null;
};

function enTableau(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const pays = sp.pays || "DZ";
  let nom = pays;
  // le site peut ne pas être encore installé : les tables n'existent pas
  try {
    nom = (await valeur<string>(`SELECT nom FROM pays WHERE code=$1`, [pays], pays)) ?? pays;
  } catch { /* on garde le code pays */ }
  return {
    title: `Transporteurs en ${nom}`,
    description: `Annuaire des sociétés de transport en ${nom} : entreprises vérifiées, documents contrôlés, devis en ligne.`,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await estInstalle())) {
    return (
      <div className="carte vide">
        Le site n&apos;est pas installé. <Link href="/installer">Lancer l&apos;installation</Link>
      </div>
    );
  }

  const sp = await searchParams;
  const pays = sp.pays || "DZ";
  const recherche = (sp.q ?? "").trim();
  const villeId = parseInt(sp.ville ?? "", 10) || 0;
  const services = enTableau(sp.service).filter((s) => s in SERVICES);
  const equips = enTableau(sp.equip).filter((s) => s in EQUIPEMENTS);
  const noteMin = parseFloat(sp.note ?? "") || 0;
  const tri = ["note", "missions", "anciennete"].includes(sp.tri ?? "") ? sp.tri! : "pertinence";
  const parPage = 6;

  /* --- filtres : uniquement des paramètres liés, jamais de concaténation --- */
  const conditions: string[] = [`t.statut = 'verifie'`, `t.pays = $1`];
  const params: unknown[] = [pays];

  if (recherche) {
    params.push(`%${recherche}%`);
    const i = params.length;
    conditions.push(`(t.raison_sociale ILIKE $${i} OR v.nom ILIKE $${i} OR t.description ILIKE $${i})`);
  }
  if (villeId) { params.push(villeId); conditions.push(`t.ville_id = $${params.length}`); }
  if (noteMin) { params.push(noteMin); conditions.push(`t.note >= $${params.length}`); }
  for (const s of services) {
    params.push(s);
    conditions.push(`EXISTS (SELECT 1 FROM transporteur_services ts
                             WHERE ts.transporteur_id = t.id AND ts.service = $${params.length})`);
  }
  for (const e of equips) {
    params.push(e);
    conditions.push(`EXISTS (SELECT 1 FROM transporteur_equipements te
                             WHERE te.transporteur_id = t.id AND te.equipement = $${params.length})`);
  }
  const where = conditions.join(" AND ");

  const total = await compter(
    `SELECT COUNT(*) FROM transporteurs t LEFT JOIN villes v ON v.id=t.ville_id WHERE ${where}`,
    params
  );
  const pagesTotal = Math.max(1, Math.ceil(total / parPage));
  const page = Math.min(Math.max(1, parseInt(sp.page ?? "1", 10) || 1), pagesTotal);

  const ordre: Record<string, string> = {
    note: "t.note DESC, t.nb_missions DESC",
    missions: "t.nb_missions DESC",
    anciennete: "t.annee_creation ASC NULLS LAST",
    pertinence: "t.note DESC, t.nb_missions DESC",
  };

  const liste = await q<Ligne>(
    `SELECT t.id, t.raison_sociale, t.description, t.annee_creation, t.effectif, t.couverture,
            t.note, t.nb_missions, v.nom AS ville, p.nom AS pays_nom,
            (SELECT COUNT(*) FROM vehicules ve WHERE ve.transporteur_id=t.id AND ve.actif) AS nb_vehicules,
            ARRAY(SELECT service FROM transporteur_services WHERE transporteur_id=t.id) AS services,
            ARRAY(SELECT equipement FROM transporteur_equipements WHERE transporteur_id=t.id) AS equipements
     FROM transporteurs t
     LEFT JOIN villes v ON v.id = t.ville_id
     LEFT JOIN pays p ON p.code = t.pays
     WHERE ${where}
     ORDER BY ${ordre[tri]}
     LIMIT ${parPage} OFFSET ${(page - 1) * parPage}`,
    params
  );

  const paysListe = await q<{ code: string; nom: string; n: string }>(
    `SELECT p.code, p.nom, COUNT(t.id) AS n
     FROM pays p LEFT JOIN transporteurs t ON t.pays=p.code AND t.statut='verifie'
     GROUP BY p.code, p.nom, p.actif
     HAVING COUNT(t.id) > 0 OR p.actif
     ORDER BY COUNT(t.id) DESC, p.nom`
  );
  const villesDispo = await q<{ id: number; nom: string; n: string }>(
    `SELECT v.id, v.nom, COUNT(*) AS n
     FROM transporteurs t JOIN villes v ON v.id=t.ville_id
     WHERE t.statut='verifie' AND t.pays=$1
     GROUP BY v.id, v.nom ORDER BY v.nom`, [pays]
  );

  /* décomptes par critère */
  const facette = async (sql: string, extra: unknown[] = []) =>
    compter(`SELECT COUNT(*) FROM transporteurs t
             WHERE t.statut='verifie' AND t.pays=$1 AND ${sql}`, [pays, ...extra]);

  const nbService: Record<string, number> = {};
  for (const k of Object.keys(SERVICES)) {
    nbService[k] = await facette(
      `EXISTS (SELECT 1 FROM transporteur_services ts WHERE ts.transporteur_id=t.id AND ts.service=$2)`, [k]);
  }
  const nbEquip: Record<string, number> = {};
  for (const k of Object.keys(EQUIPEMENTS)) {
    nbEquip[k] = await facette(
      `EXISTS (SELECT 1 FROM transporteur_equipements te WHERE te.transporteur_id=t.id AND te.equipement=$2)`, [k]);
  }
  const nbNote4 = await facette(`t.note >= 4`);
  const nbNote45 = await facette(`t.note >= 4.5`);

  const paysNom = paysListe.find((p) => p.code === pays)?.nom ?? pays;

  return (
    <>
      <nav className="crumb">
        <Link href="/">Accueil</Link> ›{" "}
        <Link href="/annuaire">Annuaire des transporteurs</Link> ›{" "}
        <span>Société de transport en {paysNom}</span>
      </nav>

      <div className="cols">
        <aside>
          <form method="get" className="filtres" id="filtres">
            <h3>Pays</h3>
            <div className="champ">
              <ListeFiltrable nom="pays" valeur={pays} vide=""
                              options={paysListe.map((p) => ({ v: p.code, l: p.nom, sous: String(p.n) }))} />
            </div>

            <h3>Ville</h3>
            {/* Le filtre ne liste que les villes où une entreprise est publiée : proposer
                une ville sans transporteur mènerait à une page de résultats vide.
                Tant qu'aucune entreprise n'est vérifiée, on le dit au lieu de laisser
                une liste vide qui ressemble à une panne. */}
            {villesDispo.length > 0 ? (
              <div className="champ">
                <ListeFiltrable nom="ville" valeur={String(villeId || "")} vide="Toutes les villes"
                                options={villesDispo.map((v) => ({ v: String(v.id), l: v.nom, sous: String(v.n) }))} />
              </div>
            ) : (
              <p className="aide" style={{ marginTop: 0 }}>
                Aucune ville à proposer pour l&apos;instant : la liste se remplit avec les
                villes des entreprises vérifiées.
              </p>
            )}

            <h3>Type de service</h3>
            {Object.entries(SERVICES).map(([k, lab]) => (
              <label className="coche" key={k}>
                <input type="checkbox" name="service" value={k} defaultChecked={services.includes(k)} />
                <span>{lab}</span>
                <span className="muted small" style={{ marginLeft: "auto" }}>({nbService[k]})</span>
              </label>
            ))}

            <h3>Équipements</h3>
            {Object.entries(EQUIPEMENTS).map(([k, lab]) => (
              <label className="coche" key={k}>
                <input type="checkbox" name="equip" value={k} defaultChecked={equips.includes(k)} />
                <span>{lab}</span>
                <span className="muted small" style={{ marginLeft: "auto" }}>({nbEquip[k]})</span>
              </label>
            ))}

            <h3>Note minimale</h3>
            <label className="coche">
              <input type="radio" name="note" value="4" defaultChecked={noteMin === 4} />
              <span>4,0 et plus</span>
              <span className="muted small" style={{ marginLeft: "auto" }}>({nbNote4})</span>
            </label>
            <label className="coche">
              <input type="radio" name="note" value="4.5" defaultChecked={noteMin === 4.5} />
              <span>4,5 et plus</span>
              <span className="muted small" style={{ marginLeft: "auto" }}>({nbNote45})</span>
            </label>

            <h3>Trier par</h3>
            <select name="tri" defaultValue={tri}>
              <option value="pertinence">Pertinence</option>
              <option value="note">Note</option>
              <option value="missions">Missions</option>
              <option value="anciennete">Ancienneté</option>
            </select>

            {recherche && <input type="hidden" name="q" value={recherche} />}
            <p style={{ marginTop: 14 }}>
              <Soumettre className="btn pleine">Appliquer les filtres</Soumettre>
            </p>
            <p style={{ margin: 0 }}>
              <Link className="btn sec pleine" href={`/annuaire?pays=${pays}`}>Réinitialiser</Link>
            </p>
          </form>
        </aside>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <h1 style={{ margin: 0 }}>{total} transporteur{total > 1 ? "s" : ""}</h1>
            <span className="muted">
              en {paysNom}{recherche ? ` pour « ${recherche} »` : ""}
            </span>
          </div>

          {liste.length === 0 && (
            <div className="carte vide">
              <p><b>Aucun transporteur vérifié ne correspond à ces critères.</b></p>
              <p className="small">
                L&apos;annuaire n&apos;affiche que les entreprises dont les documents ont été
                contrôlés et sont en cours de validité.
              </p>
              <p><Link className="btn sec" href={`/annuaire?pays=${pays}`}>Réinitialiser les filtres</Link></p>
            </div>
          )}

          {liste.map((t) => (
            <article className="sup" key={t.id}>
              <header className="sup-h">
                <span className="logo-e">{initiales(t.raison_sociale)}</span>
                <h3><Link href={`/transporteur/${t.id}`}>{t.raison_sociale}</Link></h3>
                <span className="small muted">
                  {t.pays_nom}{t.ville ? ", " + t.ville : ""}{" "}
                  <span className="tag ok" title="Documents contrôlés">✔ vérifié</span>
                </span>
              </header>
              <div className="sup-b">
                <div className="faits">
                  {t.annee_creation && <div>Créée en <b>{t.annee_creation}</b></div>}
                  {t.effectif && <div>Effectif : <b>{t.effectif}</b></div>}
                  <div>Couverture : <b>{COUVERTURES[t.couverture] ?? t.couverture}</b></div>
                  <div>Véhicules déclarés : <b>{t.nb_vehicules}</b></div>
                </div>
                <div>
                  <p className="small" style={{ color: "var(--ink-2)" }}>
                    {extrait(t.description ?? "Entreprise de transport référencée sur ROUTIS.", 240)}
                  </p>
                  <div className="tags">
                    {(t.services ?? []).map((s) => (
                      <span className="tag pri" key={s}>{SERVICES[s] ?? s}</span>
                    ))}
                    {(t.equipements ?? []).map((e) => (
                      <span className="tag" key={e}>{EQUIPEMENTS[e] ?? e}</span>
                    ))}
                  </div>
                  <div className="sup-act">
                    <span className="note small">
                      <b>{noteAffichee(t.note, t.nb_missions)}</b> · {t.nb_missions} mission{t.nb_missions > 1 ? "s" : ""}
                    </span>
                    <span className="sp" />
                    <Link className="btn sec sm" href={`/transporteur/${t.id}`}>Voir la fiche</Link>
                    <Link className="btn sm" href={`/devis?transporteur=${t.id}`}>Demander un devis</Link>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {pagesTotal > 1 && (
            <nav className="pager">
              {Array.from({ length: pagesTotal }, (_, i) => i + 1).map((i) => {
                const p = new URLSearchParams();
                p.set("pays", pays);
                if (recherche) p.set("q", recherche);
                if (villeId) p.set("ville", String(villeId));
                services.forEach((s) => p.append("service", s));
                equips.forEach((e) => p.append("equip", e));
                if (noteMin) p.set("note", String(noteMin));
                if (tri !== "pertinence") p.set("tri", tri);
                p.set("page", String(i));
                return i === page ? (
                  <span className="on" key={i}>{i}</span>
                ) : (
                  <Link key={i} href={`/annuaire?${p.toString()}`}>{i}</Link>
                );
              })}
            </nav>
          )}

          <section className="carte" style={{ marginTop: 22 }}>
            <h2 style={{ marginTop: 0 }}>Transport de marchandises en {paysNom}</h2>
            <p className="small">
              Les entreprises référencées ici ont déposé leur registre de commerce, leur licence de
              transport et leur attestation d&apos;assurance. Chaque pièce porte une date
              d&apos;expiration : à l&apos;échéance, l&apos;entreprise sort automatiquement de
              l&apos;annuaire jusqu&apos;à la mise à jour du document.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
