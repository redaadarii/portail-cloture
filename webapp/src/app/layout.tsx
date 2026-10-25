import type { Metadata } from "next";
import { Suspense } from "react";
import { NavPrincipale, NavStatique } from "@/components/NavPrincipale";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portail de clôture",
  description: "Pilotage de la clôture mensuelle : budget, réel, écarts",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3">
            <span className="font-semibold">Portail de clôture</span>
            {/* usePathname() lit l'URL de la requête : Next.js 16 exige un <Suspense> autour */}
            <Suspense fallback={<NavStatique />}>
              <NavPrincipale />
            </Suspense>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
