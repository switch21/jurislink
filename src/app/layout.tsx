import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JurisLink V2 — Gestion Juridique Intelligente",
  description: "Plateforme de gestion de cabinet juridique. Dossiers, clients, factures, calendrier et plus.",
  keywords: ["JurisLink", "juridique", "cabinet", "avocat", "gestion", "dossiers", "SaaS"],
  authors: [{ name: "JurisLink" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
