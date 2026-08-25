import { NextResponse } from "next/server";
import { ligne } from "@/lib/db";
import { utilisateur, monTransporteur } from "@/lib/auth";
import { lireFichier } from "@/lib/stockage";

/**
 * Sert un document déposé, uniquement à son propriétaire ou à un administrateur.
 * Les fichiers ne sont jamais accessibles par une adresse publique.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await utilisateur();
  if (!u) return new NextResponse("Connexion requise.", { status: 401 });

  const { id } = await ctx.params;
  const doc = await ligne<{
    id: number; transporteur_id: number; cle_fichier: string;
    nom_origine: string; type_mime: string;
  }>(`SELECT * FROM documents WHERE id=$1`, [parseInt(id, 10) || 0]);
  if (!doc) return new NextResponse("Document introuvable.", { status: 404 });

  const mien = await monTransporteur();
  if (u.role !== "admin" && mien?.id !== doc.transporteur_id) {
    return new NextResponse("Accès refusé.", { status: 403 });
  }

  const octets = await lireFichier(doc.cle_fichier);
  if (!octets) return new NextResponse("Fichier absent du stockage.", { status: 404 });

  return new NextResponse(new Uint8Array(octets), {
    headers: {
      "Content-Type": doc.type_mime || "application/octet-stream",
      "Content-Disposition":
        `inline; filename="${doc.nom_origine.replace(/[^\w.\-]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
