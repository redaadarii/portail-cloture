import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portail de clôture",
  description: "Pilotage de la clôture mensuelle : budget, réel, écarts",
};

const NAVIGATION = [
  { libelle: "Tableau de bord", href: "/", actif: true },
  { libelle: "Catalogue", href: null, actif: false }, // phase 4
  { libelle: "Demandes", href: null, actif: false }, // phase 5
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3">
            <span className="font-semibold">Portail de clôture</span>
            <nav className="flex gap-1 text-sm">
              {NAVIGATION.map((n) =>
                n.href ? (
                  <a key={n.libelle} href={n.href} className="rounded-md bg-slate-100 px-3 py-1.5 font-medium">
                    {n.libelle}
                  </a>
                ) : (
                  <span key={n.libelle} className="px-3 py-1.5 text-slate-400" title="Bientôt disponible">
                    {n.libelle}
                  </span>
                ),
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
