import "server-only";
import { Pool, type QueryResultRow } from "pg";

/**
 * Connexion PostgreSQL.
 * Un seul pool est conservé entre les invocations : en environnement
 * « serverless », le module reste chargé d'un appel à l'autre.
 */

declare global {
  // eslint-disable-next-line no-var
  var __routisPool: Pool | undefined;
}

export function pool(): Pool {
  if (!global.__routisPool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL n'est pas défini. Renseignez la variable d'environnement de la base de données."
      );
    }
    global.__routisPool = new Pool({
      connectionString: url,
      // Les bases hébergées (Neon, Supabase…) exigent TLS ; en local on s'en passe.
      ssl: url.includes("localhost") || url.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return global.__routisPool;
}

/** Exécute une requête paramétrée. Les valeurs ne sont jamais concaténées. */
export async function q<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool().query<T>(sql, params);
  return res.rows;
}

/** Première ligne, ou null. */
export async function ligne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows.length ? rows[0] : null;
}

/** Première colonne de la première ligne. */
export async function valeur<T = unknown>(
  sql: string,
  params: unknown[] = [],
  defaut: T | null = null
): Promise<T | null> {
  const res = await pool().query(sql, params);
  if (!res.rows.length) return defaut;
  const premiere = Object.values(res.rows[0])[0];
  return (premiere ?? defaut) as T;
}

/** Compte (entier) — raccourci fréquent. */
export async function compter(sql: string, params: unknown[] = []): Promise<number> {
  const v = await valeur<string>(sql, params, "0");
  return parseInt(String(v ?? "0"), 10) || 0;
}

/** La base est-elle installée ? */
export async function estInstalle(): Promise<boolean> {
  try {
    const v = await valeur<string>(
      `SELECT to_regclass('public.utilisateurs')::text`,
      []
    );
    if (!v) return false;
    return (await compter(`SELECT COUNT(*) FROM utilisateurs WHERE role='admin'`)) > 0;
  } catch {
    return false;
  }
}

/** Journal d'audit — ne doit jamais faire échouer une action métier. */
export async function journal(
  action: string,
  cible = "",
  details = "",
  utilisateurId: number | null = null
): Promise<void> {
  try {
    await q(
      `INSERT INTO journal (utilisateur_id, action, cible, details) VALUES ($1,$2,$3,$4)`,
      [utilisateurId, action, cible.slice(0, 120), details.slice(0, 255)]
    );
  } catch {
    /* silencieux */
  }
}
