import "server-only";
import { q } from "./db";

/**
 * Envoi des notifications.
 *
 * Utilise Resend si la clé est fournie (RESEND_API_KEY). Sans clé, les messages
 * sont uniquement journalisés : le site reste utilisable, l'administrateur voit
 * dans son back-office ce qui aurait dû partir.
 */

export function adresseExpediteur(): string {
  return process.env.EMAIL_EXPEDITEUR || "ROUTIS <onboarding@resend.dev>";
}

export function urlSite(): string {
  return (
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function gabarit(titre: string, corps: string, bouton?: { texte: string; url: string }): string {
  const nom = process.env.NOM_SITE || "ROUTIS";
  const b = bouton
    ? `<p style="margin:26px 0"><a href="${bouton.url}" style="background:#5C8208;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:700;display:inline-block">${bouton.texte}</a></p>`
    : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#F3F4F5;font-family:Arial,Helvetica,sans-serif;color:#14181B">
<div style="max-width:600px;margin:0 auto;background:#fff">
<div style="background:#002E1F;color:#fff;padding:18px 26px;font-size:21px;font-weight:bold">${nom}</div>
<div style="padding:26px;line-height:1.6;font-size:15px">
<h1 style="font-size:20px;margin:0 0 14px">${titre}</h1>${corps}${b}</div>
<div style="background:#003A27;color:#C3D2CB;padding:16px 26px;font-size:12.5px">
Message automatique — merci de ne pas y répondre.</div></div></body></html>`;
}

export async function envoyerMail(destinataire: string, sujet: string, corps: string): Promise<boolean> {
  let ok = false;
  let erreur = "";
  const cle = process.env.RESEND_API_KEY;

  if (!cle) {
    erreur = "aucune clé RESEND_API_KEY : message journalisé sans envoi";
  } else {
    try {
      const rep = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: adresseExpediteur(), to: [destinataire], subject: sujet, html: corps }),
      });
      ok = rep.ok;
      if (!ok) erreur = "Resend a répondu " + rep.status + " : " + (await rep.text()).slice(0, 180);
    } catch (e) {
      erreur = e instanceof Error ? e.message.slice(0, 200) : "erreur inconnue";
    }
  }

  try {
    await q(
      `INSERT INTO emails (destinataire, sujet, corps, statut, erreur) VALUES ($1,$2,$3,$4,$5)`,
      [destinataire, sujet.slice(0, 190), corps, ok ? "envoye" : "echec", erreur.slice(0, 255)]
    );
  } catch { /* le journal ne bloque jamais */ }
  return ok;
}
