import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le traçage des fichiers doit rester dans le dossier du projet :
  // sans cela, l'hébergeur embarque des fichiers voisins inutiles.
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
};

export default nextConfig;
