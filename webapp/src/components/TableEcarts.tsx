import { formatMontant, formatPourcent } from "@/lib/format";
import { SEUIL_SIGNIFICATIF_PCT, type LigneEcart } from "@/lib/donnees";

export function TableEcarts({ lignes }: { lignes: LigneEcart[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2 font-medium">Entité</th>
            <th className="px-4 py-2 font-medium">Compte</th>
            <th className="px-4 py-2 text-right font-medium">Budget</th>
            <th className="px-4 py-2 text-right font-medium">Réel</th>
            <th className="px-4 py-2 text-right font-medium">Écart</th>
            <th className="px-4 py-2 text-right font-medium">Écart %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lignes.map((l) => {
            const significatif = l.ecart_pct !== null && Math.abs(l.ecart_pct) > SEUIL_SIGNIFICATIF_PCT;
            return (
              <tr key={`${l.entite}-${l.compte}`} className="hover:bg-slate-50">
                <td className="px-4 py-2">{l.nom_entite}</td>
                <td className="px-4 py-2">
                  <span className="font-mono text-slate-500">{l.compte}</span> {l.libelle}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMontant(l.budget)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMontant(l.reel)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMontant(l.ecart)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <span
                    className={
                      significatif ? "rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800" : "text-slate-600"
                    }
                  >
                    {formatPourcent(l.ecart_pct)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
