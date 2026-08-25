import Link from "next/link";
import { exigerRole } from "@/lib/auth";
import { q, compter } from "@/lib/db";
import { dateFr } from "@/lib/metier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal des e-mails" };

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ statut?: string }> }) {
  await exigerRole("admin", "/admin/emails");
  const sp = await searchParams;
  const echecsSeuls = sp.statut === "echec";

  const [liste, nOk, nKo] = await Promise.all([
    q<{
      id: number; destinataire: string; sujet: string; statut: string;
      erreur: string; cree_le: string;
    }>(
      `SELECT id, destinataire, sujet, statut, erreur, cree_le FROM emails
       ${echecsSeuls ? "WHERE statut='echec'" : ""}
       ORDER BY id DESC LIMIT 200`
    ),
    compter(`SELECT COUNT(*) FROM emails WHERE statut='envoye'`),
    compter(`SELECT COUNT(*) FROM emails WHERE statut='echec'`),
  ]);

  const cleAbsente = !process.env.RESEND_API_KEY;

  return (
    <>
      <nav className="crumb"><Link href="/admin">Administration</Link> › <span>E-mails</span></nav>
      <h1>Journal des e-mails</h1>
      <p className="lede">
        Tous les messages envoyés par le site. Les échecs signalent presque toujours un problème
        de configuration de l&apos;expéditeur, jamais un bug du site.
      </p>

      <div className="stat">
        <div><span className="k">Envoyés</span><span className="v">{nOk}</span></div>
        <div><span className="k">En échec</span><span className="v">{nKo}</span></div>
      </div>

      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn sec sm" href="/admin/emails">Tous</Link>
        <Link className="btn sec sm" href="/admin/emails?statut=echec">
          Échecs uniquement ({nKo})
        </Link>
      </p>

      {cleAbsente && (
        <div className="msg att">
          <b>Aucune clé d&apos;envoi configurée.</b> Les messages sont enregistrés ici mais ne
          partent pas. Créez un compte gratuit sur Resend, puis renseignez les variables
          <code> RESEND_API_KEY</code> et <code>EMAIL_EXPEDITEUR</code> dans les réglages de
          votre hébergeur.
        </div>
      )}

      {!cleAbsente && nKo > 0 && (
        <div className="msg att">
          Des envois ont échoué. Vérifiez que le domaine de l&apos;adresse indiquée dans
          <code> EMAIL_EXPEDITEUR</code> est bien vérifié chez Resend : tant qu&apos;il ne
          l&apos;est pas, seuls les envois vers votre propre adresse sont acceptés.
        </div>
      )}

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Destinataire</th><th>Sujet</th><th>Statut</th><th>Erreur</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((m) => (
              <tr key={m.id}>
                <td className="small">{dateFr(m.cree_le, true)}</td>
                <td className="small">{m.destinataire}</td>
                <td className="small">{m.sujet}</td>
                <td>
                  <span className={"tag " + (m.statut === "envoye" ? "ok" : "err")}>{m.statut}</span>
                </td>
                <td className="small muted">{m.erreur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {liste.length === 0 && (
        <div className="carte vide">Aucun e-mail envoyé pour l&apos;instant.</div>
      )}
    </>
  );
}
