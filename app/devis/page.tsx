import Link from "next/link";
import { redirect } from "next/navigation";
import ListeFiltrable from "@/components/ListeFiltrable";
import { utilisateur } from "@/lib/auth";
import { q, ligne, journal } from "@/lib/db";
import { villesDuPays, listePays } from "@/lib/villes";
import { listerDestinataires, assurerDestinataires } from "@/lib/diffusion";
import { EQUIPEMENTS, distanceKm, nouvelleReference, noteAffichee } from "@/lib/metier";
import { mailNouvelleDemande } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demander un devis" };

type Ville = { id: number; nom: string; lat: string; lon: string };

async function deposer(formData: FormData) {
  "use server";
  const u = await utilisateur();
  const type = String(formData.get("type") ?? "fret") === "pax" ? "pax" : "fret";
  const cible = parseInt(String(formData.get("transporteur") ?? ""), 10) || null;
  const code = (c: unknown) => {
    const v = String(c ?? "").toUpperCase();
    return /^[A-Z]{2}$/.test(v) ? v : "";
  };
  // Conservé pour revenir sur le même trajet si la saisie est à reprendre.
  const trajet = `type=${type}` +
    (code(formData.get("pd")) ? `&pd=${code(formData.get("pd"))}` : "") +
    (code(formData.get("pa")) ? `&pa=${code(formData.get("pa"))}` : "");

  if (!u) {
    redirect("/connexion?suite=" + encodeURIComponent(`/devis?${trajet}`));
  }

  const depart = parseInt(String(formData.get("depart") ?? ""), 10) || 0;
  const arrivee = parseInt(String(formData.get("arrivee") ?? ""), 10) || 0;
  const vd = depart ? await ligne<Ville>(`SELECT * FROM villes WHERE id=$1`, [depart]) : null;
  const va = arrivee ? await ligne<Ville>(`SELECT * FROM villes WHERE id=$1`, [arrivee]) : null;

  if (!vd || !va) redirect(`/devis?${trajet}&erreur=villes`);
  if (vd.id === va.id) redirect(`/devis?${trajet}&erreur=identiques`);

  const date = String(formData.get("date_souhaitee") ?? "");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(`/devis?${trajet}&erreur=date`);

  const equips = formData
    .getAll("equip")
    .map(String)
    .filter((e) => e in EQUIPEMENTS);

  const nombre = (cle: string) => {
    const v = parseInt(String(formData.get(cle) ?? ""), 10);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const decimal = (cle: string) => {
    const v = parseFloat(String(formData.get(cle) ?? "").replace(",", "."));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  const ref = nouvelleReference();
  const cree = await ligne<{ id: number }>(
    `INSERT INTO demandes
      (reference, client_id, type, ville_depart, ville_arrivee, distance_km, date_souhaitee,
       nature, poids_kg, volume_m3, palettes, passagers, equipements, precisions, transporteur_cible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      ref, u.id, type, vd.id, va.id,
      distanceKm(parseFloat(vd.lat), parseFloat(vd.lon), parseFloat(va.lat), parseFloat(va.lon)),
      date || null,
      String(formData.get(type === "pax" ? "nature_pax" : "nature") ?? "").slice(0, 120),
      type === "fret" ? nombre("poids") : null,
      type === "fret" ? decimal("volume") : null,
      type === "fret" ? nombre("palettes") : null,
      type === "pax" ? nombre("passagers") : null,
      type === "fret" ? equips.join(",") : "",
      String(formData.get("precisions") ?? ""),
      cible,
    ]
  );

  /* Les entreprises cochées par le client. Aucune ligne enregistrée = la
     demande reste ouverte à tous ceux qui correspondent. */
  const choisis = formData.getAll("destinataire")
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (choisis.length) {
    await assurerDestinataires();
    await q(
      `INSERT INTO demande_destinataires (demande_id, transporteur_id)
       SELECT $1, id FROM transporteurs WHERE id = ANY($2::int[]) AND statut='verifie'
       ON CONFLICT DO NOTHING`,
      [cree!.id, choisis]
    );
  }

  await journal("demande_creee", "demande#" + cree!.id, ref, u.id);
  await mailNouvelleDemande(
    {
      id: cree!.id, reference: ref, client_id: u.id, type,
      depart: vd.nom, arrivee: va.nom,
      distance_km: distanceKm(parseFloat(vd.lat), parseFloat(vd.lon), parseFloat(va.lat), parseFloat(va.lon)),
      date_souhaitee: date || null,
    },
    vd.id,
    va.id,
    cible
  );

  redirect(`/demande/${cree!.id}`);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string; transporteur?: string; erreur?: string; pd?: string; pa?: string;
  }>;
}) {
  const sp = await searchParams;
  const type = sp.type === "pax" ? "pax" : "fret";
  const cibleId = parseInt(sp.transporteur ?? "", 10) || 0;
  const u = await utilisateur();

  const cible = cibleId
    ? await ligne<{ id: number; raison_sociale: string; pays: string }>(
        `SELECT id, raison_sociale, pays FROM transporteurs WHERE id=$1 AND statut='verifie'`,
        [cibleId]
      )
    : null;

  const pays = await listePays();
  const connu = (c: string | undefined) =>
    c && pays.some((p) => p.code === c) ? c : null;

  // Le trajet peut franchir une frontière : chaque extrémité a son pays, celui
  // de départ servant de valeur par défaut à l'arrivée.
  const paysDepart = connu(sp.pd) ?? cible?.pays ?? "DZ";
  const paysArrivee = connu(sp.pa) ?? paysDepart;
  const international = paysArrivee !== paysDepart;

  const [villesDepart, villesArrivee] = await Promise.all([
    villesDuPays(paysDepart),
    paysArrivee === paysDepart ? villesDuPays(paysDepart) : villesDuPays(paysArrivee),
  ]);
  const optionsDepart = villesDepart.map((v) => ({ v: String(v.id), l: v.nom }));
  const optionsArrivee = paysArrivee === paysDepart
    ? optionsDepart
    : villesArrivee.map((v) => ({ v: String(v.id), l: v.nom }));

  // Combien d'entreprises recevront la demande : le client doit le savoir avant
  // d'écrire, pas après. Inutile quand la demande est adressée à une seule.
  await assurerDestinataires();
  const destinataires = cible ? [] : await listerDestinataires(type, paysDepart, international);

  const messages: Record<string, string> = {
    villes: "Choisissez une ville de départ et une ville d'arrivée dans la liste.",
    identiques: "Le départ et l'arrivée sont identiques.",
    date: "La date n'est pas valide.",
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <h1>Demander un devis</h1>
      <p className="lede">
        Décrivez votre besoin. Les transporteurs vérifiés qui correspondent vous enverront un
        prix ferme.
      </p>

      {/* Le client doit savoir à qui il s'adresse. Si le compte exact n'est pas
          disponible, on le dit sans chiffre plutôt que de ne rien dire. */}
      {!cible && destinataires.length === 0 && (
        <p className="msg att">
          Aucun transporteur vérifié ne correspond encore à ce trajet. Votre demande sera
          enregistrée et leur sera présentée dès qu’une entreprise s’inscrira.
        </p>
      )}

      {cible && (
        <div className="msg info">
          Votre demande sera adressée à <b>{cible.raison_sociale}</b>, et à elle seule.
          Pour comparer plusieurs prix, repassez par{" "}
          <Link href="/devis">Demander un devis</Link> : la demande partira alors à tous
          les transporteurs vérifiés qui correspondent.
        </div>
      )}
      {sp.erreur && <div className="msg err">{messages[sp.erreur] ?? "Une erreur est survenue."}</div>}
      {!u && (
        <div className="msg att">
          Vous devrez vous connecter (ou créer un compte) au moment d&apos;envoyer la demande.
        </div>
      )}

      {/* La classe du formulaire décide de la section affichée. La règle voyage
          avec la page, et non dans le fichier de style commun : une feuille
          restée en mémoire du navigateur ne peut donc pas la faire disparaître. */}
      {/* Le choix des pays recharge la page : les villes proposées en dépendent,
          et il y en a des centaines par pays. Son propre formulaire, donc — un
          formulaire ne peut pas en contenir un autre. */}
      <form method="get" action="/devis" id="trajet" className="carte">
        <input type="hidden" name="type" value={type} />
        {cibleId ? <input type="hidden" name="transporteur" value={cibleId} /> : null}
        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="pd">Pays de départ</label>
            <select id="pd" name="pd" defaultValue={paysDepart}>
              {pays.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label className="ch" htmlFor="pa">Pays d&apos;arrivée</label>
            <select id="pa" name="pa" defaultValue={paysArrivee}>
              {pays.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
            </select>
          </div>
        </div>
        <button className="btn sec" type="submit">Mettre à jour les villes</button>
        {international && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Trajet international : votre demande partira aux transporteurs du pays de départ
            dont la zone couverte dépasse leurs frontières.
          </p>
        )}
      </form>

      <style
        dangerouslySetInnerHTML={{
          __html:
            "form.t-fret .sect-pax,form.t-pax .sect-fret{display:none!important}",
        }}
      />
      <form action={deposer} className={"carte " + (type === "pax" ? "t-pax" : "t-fret")} autoComplete="off">
        <input type="hidden" name="transporteur" value={cibleId || ""} />

        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="pd" value={paysDepart} />
        <input type="hidden" name="pa" value={paysArrivee} />

        {/* Les deux phrases sont là toutes les deux ; la classe du formulaire
            n’en laisse voir qu’une, comme pour les sections. */}
        <p className="small muted sect-fret" style={{ marginTop: 0 }}>
          Transport de marchandises. Pour des personnes, passez par l’onglet « Personnes » ci-dessus.
        </p>
        <p className="small muted sect-pax" style={{ marginTop: 0 }}>
          Transport de personnes. Pour des marchandises, passez par l’onglet « Marchandises » ci-dessus.
        </p>

        <div className="grille g2">
          <div className="champ">
            <label className="ch" htmlFor="depart">Ville de départ</label>
            <ListeFiltrable id="depart" nom="depart" requis options={optionsDepart} />
          </div>
          <div className="champ">
            <label className="ch" htmlFor="arrivee">Ville d&apos;arrivée</label>
            <ListeFiltrable id="arrivee" nom="arrivee" requis options={optionsArrivee} />
          </div>
        </div>

        <div className="champ" style={{ maxWidth: 260 }}>
          <label className="ch" htmlFor="date_souhaitee">Date souhaitée</label>
          <input id="date_souhaitee" name="date_souhaitee" type="date" />
        </div>

        <fieldset className="sect-fret">
          <legend>Marchandises</legend>
          <div className="champ">
            <label className="ch" htmlFor="nature">Nature de la marchandise</label>
            <input id="nature" name="nature" placeholder="Ex. mobilier, palettes, matériaux…" />
          </div>
          <div className="grille g3">
            <div className="champ">
              <label className="ch" htmlFor="poids">Poids (kg)</label>
              <input id="poids" name="poids" type="number" min="0" step="1" placeholder=" " />
            </div>
            <div className="champ">
              <label className="ch" htmlFor="volume">Volume (m³)</label>
              <input id="volume" name="volume" type="number" min="0" step="0.1" placeholder=" " />
            </div>
            <div className="champ">
              <label className="ch" htmlFor="palettes">Palettes</label>
              <input id="palettes" name="palettes" type="number" min="0" step="1" placeholder=" " />
            </div>
          </div>
          <label className="ch">Besoins particuliers</label>
          {Object.entries(EQUIPEMENTS).map(([k, lab]) => (
            <label className="coche" key={k}>
              <input type="checkbox" name="equip" value={k} />
              <span>{lab}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="sect-pax">
          <legend>Personnes</legend>
          <div className="grille g2">
            <div className="champ">
              <label className="ch" htmlFor="passagers">Nombre de passagers</label>
              <input id="passagers" name="passagers" type="number" min="1" max="60" placeholder=" " />
            </div>
            <div className="champ">
              <label className="ch" htmlFor="nature_pax">Motif du déplacement</label>
              <input id="nature_pax" name="nature_pax" placeholder="Ex. navette aéroport, transfert d’employés, mariage…" />
            </div>
          </div>
        </fieldset>

        <div className="champ">
          <label className="ch" htmlFor="precisions">Précisions</label>
          <textarea id="precisions" name="precisions"
                    placeholder="Adresses exactes, contraintes horaires, étage, accès…" />
        </div>

        {!cible && destinataires.length > 0 && (
          <fieldset>
            <legend>À qui envoyer</legend>
            <p className="small muted" style={{ marginTop: 0 }}>
              {destinataires.length === 1
                ? "Une seule entreprise vérifiée correspond à ce trajet. Décochez-la si vous ne souhaitez pas la solliciter."
                : `${destinataires.length} entreprises vérifiées correspondent à ce trajet. Toutes sont retenues : décochez celles que vous ne souhaitez pas solliciter.`}
            </p>
            {destinataires.map((e) => (
              <label className="coche" key={e.id}>
                <input type="checkbox" name="destinataire" value={e.id} defaultChecked />
                <span>
                  <b>{e.raison_sociale}</b>
                  <span className="small muted">
                    {" · "}{e.ville ?? "—"}{" · "}{noteAffichee(e.note, e.nb_missions)}
                    {e.nb_missions > 0 ? ` · ${e.nb_missions} mission${e.nb_missions > 1 ? "s" : ""}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <button className="btn pleine" type="submit">Envoyer ma demande</button>
      </form>

      {/* Filet de sécurité : si la page servie ne correspondait pas au type
          demandé dans l'adresse — une version gardée en réserve, par exemple —
          ces trois lignes la remettent d'accord avec l'onglet choisi. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var v=new URLSearchParams(location.search).get('type');" +
            "v=(v==='pax')?'pax':'fret';" +
            "var tr=document.getElementById('trajet');" +
            "if(tr){tr.querySelectorAll('select').forEach(function(sel){" +
            "sel.addEventListener('change',function(){tr.submit();});});" +
            "var b=tr.querySelector('button[type=submit]');if(b)b.style.display='none';}" +
            "document.querySelectorAll('form.t-fret,form.t-pax').forEach(function(f){" +
            "f.classList.toggle('t-fret',v==='fret');f.classList.toggle('t-pax',v==='pax');" +
            "var h=f.querySelector('input[name=type]');if(h)h.value=v;});})();",
        }}
      />
    </div>
  );
}
