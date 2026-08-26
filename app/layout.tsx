import type { Metadata } from "next";
import "./globals.css";
import Entete from "@/components/Entete";
import Pied from "@/components/Pied";

export const metadata: Metadata = {
  title: { default: "ROUTIS — transport de marchandises et de personnes", template: "%s — ROUTIS" },
  description:
    "Trouvez un transporteur vérifié, obtenez un devis et réservez votre transport de marchandises ou de personnes.",
};

/**
 * Appliqué avant le premier affichage : sans cela, une page en mode sombre
 * apparaîtrait blanche une fraction de seconde à chaque chargement.
 */
const THEME_AVANT_PEINTURE = `try{var t=localStorage.getItem("routis-theme");
if(t==="clair"||t==="sombre")document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_AVANT_PEINTURE }} />
        <meta name="theme-color" content="#002E1F" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#04231A" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        <noscript>
          {/* Sans JavaScript le bouton du menu ne peut rien ouvrir :
              on affiche les liens en permanence. */}
          <style>{".menu-b{display:none !important}.gnav{display:flex !important}"}</style>
        </noscript>
        <Entete />
        <main>{children}</main>
        <Pied />
      </body>
    </html>
  );
}
