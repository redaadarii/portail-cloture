import type { Entite } from "@/lib/donnees";

/** Lu dans ref_entites : une entité ajoutée au référentiel apparaît ici sans redéployer l'application. */
export function ListeEntites({ entites }: { entites: Entite[] }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
      {entites.map((e) => (
        <li key={e.code} className="flex items-center justify-between px-4 py-2">
          <span>
            {e.nom} <span className="font-mono text-xs text-slate-400">{e.code}</span>
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              e.actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {e.actif ? "Active" : "Inactive"}
          </span>
        </li>
      ))}
    </ul>
  );
}
