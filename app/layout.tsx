import type { Metadata } from "next";
import "./globals.css";
import Entete from "@/components/Entete";
import Pied from "@/components/Pied";

export const metadata: Metadata = {
  title: { default: "ROUTIS — transport de marchandises et de personnes", template: "%s — ROUTIS" },
  description:
    "Trouvez un transporteur vérifié, obtenez un devis et réservez votre transport de marchandises ou de personnes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Entete />
        <main>{children}</main>
        <Pied />
      </body>
    </html>
  );
}
