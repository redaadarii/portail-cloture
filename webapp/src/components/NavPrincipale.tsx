"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LIENS = [
  { libelle: "Tableau de bord", href: "/" },
  { libelle: "Catalogue", href: "/catalogue" },
  { libelle: "Demandes", href: null }, // phase 5
];

/** Composant client : seul le navigateur connaît l'URL courante pour surligner le bon lien. */
export function NavPrincipale() {
  return <Liens chemin={usePathname()} />;
}

/** Variante sans lien actif, affichée le temps que l'URL soit connue (repli du <Suspense>). */
export function NavStatique() {
  return <Liens chemin={null} />;
}

function Liens({ chemin }: { chemin: string | null }) {
  return (
    <nav className="flex gap-1 text-sm">
      {LIENS.map((l) => {
        if (!l.href) {
          return (
            <span key={l.libelle} className="px-3 py-1.5 text-slate-400" title="Bientôt disponible">
              {l.libelle}
            </span>
          );
        }
        const actif = chemin !== null && (l.href === "/" ? chemin === "/" : chemin.startsWith(l.href));
        return (
          <Link
            key={l.libelle}
            href={l.href}
            aria-current={actif ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${actif ? "bg-slate-100 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {l.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
