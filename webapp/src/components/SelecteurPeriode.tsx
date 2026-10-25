"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { libellePeriode } from "@/lib/format";

/**
 * La période choisie est stockée dans l'URL (?periode=2026-10) : la page reste partageable
 * et le bouton « précédent » du navigateur fonctionne. Le serveur relit l'URL et recharge les données.
 */
export function SelecteurPeriode({ periodes, actuelle }: { periodes: string[]; actuelle: string }) {
  const router = useRouter();
  const chemin = usePathname();
  const [enCours, demarrer] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-600">Période</span>
      <select
        value={actuelle}
        disabled={enCours}
        onChange={(e) => demarrer(() => router.push(`${chemin}?periode=${encodeURIComponent(e.target.value)}`))}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 capitalize focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
      >
        {periodes.map((p) => (
          <option key={p} value={p}>
            {libellePeriode(p)}
          </option>
        ))}
      </select>
      {enCours && <span className="text-slate-500">Chargement…</span>}
    </label>
  );
}
