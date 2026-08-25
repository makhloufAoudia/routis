import "server-only";

/**
 * Stockage des documents envoyés par les transporteurs.
 *
 * En production (Netlify) : Netlify Blobs — les fichiers ne sont jamais
 * exposés par une adresse publique, ils transitent par une route protégée.
 * En développement : dossier .stockage/ à la racine du projet.
 */

const NOM_ESPACE = "documents-transporteurs";

async function blobs() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: NOM_ESPACE, consistency: "strong" });
}

function surNetlify(): boolean {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

async function cheminLocal(cle: string) {
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const dossier = path.join(process.cwd(), ".stockage");
  await fs.mkdir(dossier, { recursive: true });
  return path.join(dossier, cle.replace(/[^a-zA-Z0-9._-]/g, "_"));
}

export async function enregistrerFichier(cle: string, donnees: Buffer): Promise<void> {
  if (surNetlify()) {
    const store = await blobs();
    // Netlify Blobs attend un ArrayBuffer, pas un Buffer Node
    const ab = donnees.buffer.slice(
      donnees.byteOffset,
      donnees.byteOffset + donnees.byteLength
    ) as ArrayBuffer;
    await store.set(cle, ab);
    return;
  }
  const fs = await import("node:fs/promises");
  await fs.writeFile(await cheminLocal(cle), donnees);
}

export async function lireFichier(cle: string): Promise<Buffer | null> {
  try {
    if (surNetlify()) {
      const store = await blobs();
      const ab = await store.get(cle, { type: "arrayBuffer" });
      return ab ? Buffer.from(ab as ArrayBuffer) : null;
    }
    const fs = await import("node:fs/promises");
    return await fs.readFile(await cheminLocal(cle));
  } catch {
    return null;
  }
}

export async function supprimerFichier(cle: string): Promise<void> {
  try {
    if (surNetlify()) {
      const store = await blobs();
      await store.delete(cle);
      return;
    }
    const fs = await import("node:fs/promises");
    await fs.unlink(await cheminLocal(cle));
  } catch {
    /* le fichier n'existait plus */
  }
}

/** Types acceptés pour les pièces justificatives. */
export const TYPES_ACCEPTES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const TAILLE_MAX = 5 * 1024 * 1024;

/**
 * Contrôle le contenu réel du fichier, pas seulement son extension :
 * un script renommé en .png doit être refusé.
 */
export function extensionReelle(octets: Buffer, typeAnnonce: string): string | null {
  const debut = octets.subarray(0, 8);
  const hex = debut.toString("hex").toUpperCase();
  if (hex.startsWith("25504446")) return "pdf";                  // %PDF
  if (hex.startsWith("FFD8FF")) return "jpg";                    // JPEG
  if (hex.startsWith("89504E470D0A1A0A")) return "png";          // PNG
  void typeAnnonce;
  return null;
}
