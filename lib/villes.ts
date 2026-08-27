import "server-only";
import { q } from "@/lib/db";

export type VilleChoix = { id: number; nom: string };

declare global {
  // eslint-disable-next-line no-var
  var __routisVilles: Map<string, VilleChoix[]> | undefined;
}

/**
 * Les villes d'un pays, les plus peuplées d'abord.
 *
 * Cette liste ne bouge pas d'une visite à l'autre : la relire à chaque
 * formulaire réveillait la base pour rien et retardait l'affichage. Elle est
 * donc gardée en mémoire de l'instance, comme le pool de connexions ; un
 * nouveau déploiement la vide.
 */
export async function villesDuPays(pays: string): Promise<VilleChoix[]> {
  const cache = (global.__routisVilles ??= new Map<string, VilleChoix[]>());
  const connues = cache.get(pays);
  if (connues) return connues;

  const rows = await q<VilleChoix>(
    `SELECT id, nom FROM villes WHERE pays=$1 ORDER BY population DESC LIMIT 400`,
    [pays]
  );
  cache.set(pays, rows);
  return rows;
}
