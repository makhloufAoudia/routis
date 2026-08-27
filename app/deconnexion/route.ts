import { NextResponse } from "next/server";
import { fermerSession } from "@/lib/auth";

/**
 * La déconnexion, en route plutôt qu'en page.
 *
 * Effacer le cookie de session pendant le rendu d'une page est refusé par
 * Next : un cookie ne se modifie que dans une action de formulaire ou dans une
 * route comme celle-ci. La page qui occupait cette adresse échouait donc avec
 * une erreur serveur, et l'on restait connecté.
 */
export const dynamic = "force-dynamic";

export async function GET(requete: Request) {
  await fermerSession();
  // 303 : le navigateur repart en GET sur l'accueil, sans reproposer l'adresse.
  return NextResponse.redirect(new URL("/", requete.url), { status: 303 });
}
