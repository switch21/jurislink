import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" retiré — Vercel a son propre runtime natif.
  // Ce mode est uniquement pour Docker / self-hosted et peut
  // causer des problèmes d'hydratation en modifiant comment le HTML est servi.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
