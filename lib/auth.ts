import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { q, ligne, journal, compter } from "./db";

export type Role = "client" | "transporteur" | "admin";

export interface Utilisateur {
  id: number;
  role: Role;
  email: string;
  telephone: string;
  nom: string;
  statut: string;
}

export interface Transporteur {
  id: number;
  utilisateur_id: number;
  raison_sociale: string;
  forme: string;
  registre: string;
  pays: string;
  ville_id: number | null;
  adresse: string;
  telephone: string;
  site_web: string;
  description: string | null;
  annee_creation: number | null;
  effectif: string;
  couverture: string;
  statut: string;
  motif_refus: string;
  note: string;
  nb_missions: number;
}

const COOKIE = "routis_session";
const DUREE_JOURS = 30;

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

function nouvelIdentifiantSession(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function ouvrirSession(utilisateurId: number): Promise<void> {
  const id = nouvelIdentifiantSession();
  const expire = new Date(Date.now() + DUREE_JOURS * 86400_000);
  await q(`INSERT INTO sessions (id, utilisateur_id, expire_le) VALUES ($1,$2,$3)`, [
    id, utilisateurId, expire,
  ]);
  await q(`UPDATE utilisateurs SET derniere_connexion = now() WHERE id=$1`, [utilisateurId]);
  await q(`DELETE FROM sessions WHERE expire_le < now()`);
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expire,
  });
  await journal("connexion", "utilisateur#" + utilisateurId, "", utilisateurId);
}

export async function fermerSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) {
    await q(`DELETE FROM sessions WHERE id=$1`, [id]);
    jar.delete(COOKIE);
  }
}

/** Utilisateur connecté, ou null. */
export async function utilisateur(): Promise<Utilisateur | null> {
  let id: string | undefined;
  try {
    const jar = await cookies();
    id = jar.get(COOKIE)?.value;
  } catch {
    return null;
  }
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  try {
    return await ligne<Utilisateur & { [k: string]: unknown }>(
      `SELECT u.id, u.role, u.email, u.telephone, u.nom, u.statut
       FROM sessions s JOIN utilisateurs u ON u.id = s.utilisateur_id
       WHERE s.id = $1 AND s.expire_le > now() AND u.statut = 'actif'`,
      [id]
    );
  } catch {
    return null;
  }
}

export async function exigerConnexion(retour?: string): Promise<Utilisateur> {
  const u = await utilisateur();
  if (!u) redirect("/connexion" + (retour ? "?suite=" + encodeURIComponent(retour) : ""));
  return u;
}

export async function exigerRole(role: Role, retour?: string): Promise<Utilisateur> {
  const u = await exigerConnexion(retour);
  if (u.role !== role) redirect("/acces-refuse");
  return u;
}

/** Fiche transporteur du compte connecté. */
export async function monTransporteur(): Promise<Transporteur | null> {
  const u = await utilisateur();
  if (!u || u.role !== "transporteur") return null;
  return await ligne<Transporteur & { [k: string]: unknown }>(
    `SELECT * FROM transporteurs WHERE utilisateur_id = $1`,
    [u.id]
  );
}

/* ------------------------------------------------------------------ */
/* Comptes                                                             */
/* ------------------------------------------------------------------ */

export async function creerCompte(
  email: string,
  motDePasse: string,
  nom: string,
  telephone: string,
  role: Role = "client"
): Promise<number | string> {
  const mail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return "L'adresse e-mail n'est pas valide.";
  if (motDePasse.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!nom.trim()) return "Indiquez votre nom.";
  if (await compter(`SELECT COUNT(*) FROM utilisateurs WHERE email=$1`, [mail])) {
    return "Un compte existe déjà avec cette adresse e-mail.";
  }
  const hash = await bcrypt.hash(motDePasse, 10);
  const r = await ligne<{ id: number }>(
    `INSERT INTO utilisateurs (role, email, telephone, nom, mot_de_passe)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [role === "transporteur" ? "transporteur" : "client", mail, telephone.trim(), nom.trim(), hash]
  );
  const id = r!.id;
  await journal("creation_compte", "utilisateur#" + id, role, id);
  return id;
}

export async function verifierIdentifiants(
  email: string,
  motDePasse: string
): Promise<Utilisateur | null> {
  const mail = email.trim().toLowerCase();
  const u = await ligne<Utilisateur & { mot_de_passe: string }>(
    `SELECT * FROM utilisateurs WHERE email=$1`,
    [mail]
  );
  if (!u || u.statut !== "actif") return null;
  if (!(await bcrypt.compare(motDePasse, u.mot_de_passe))) return null;
  return u;
}

export async function changerMotDePasse(utilisateurId: number, motDePasse: string): Promise<void> {
  const hash = await bcrypt.hash(motDePasse, 10);
  await q(`UPDATE utilisateurs SET mot_de_passe=$1 WHERE id=$2`, [hash, utilisateurId]);
  await q(`DELETE FROM sessions WHERE utilisateur_id=$1`, [utilisateurId]);
  await journal("mot_de_passe_change", "utilisateur#" + utilisateurId, "", utilisateurId);
}

/* ------------------------------------------------------------------ */
/* Limitation des tentatives de connexion                              */
/* ------------------------------------------------------------------ */

/**
 * Le comptage vit en base, pas en mémoire : sur un hébergement sans serveur,
 * deux requêtes successives ne tombent pas forcément sur la même machine, et
 * un compteur en mémoire ne protégerait donc rien.
 */
const FENETRE_MINUTES = 10;
const MAX_ECHECS = 5;

export async function tropDeTentatives(email: string): Promise<boolean> {
  try {
    const n = await compter(
      `SELECT COUNT(*) FROM journal
       WHERE action='connexion_echec' AND cible=$1
         AND cree_le > now() - ($2 || ' minutes')::interval`,
      [email.trim().toLowerCase(), String(FENETRE_MINUTES)]
    );
    return n >= MAX_ECHECS;
  } catch { return false; }
}

export async function noterEchec(email: string): Promise<void> {
  await journal("connexion_echec", email.trim().toLowerCase());
}

export async function effacerEchecs(email: string): Promise<void> {
  await q(`DELETE FROM journal WHERE action='connexion_echec' AND cible=$1`,
    [email.trim().toLowerCase()]);
}
