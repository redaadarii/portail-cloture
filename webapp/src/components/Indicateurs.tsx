import { formatCompact, formatMontant } from "@/lib/format";
import { SEUIL_SIGNIFICATIF_PCT, type Synthese } from "@/lib/donnees";

function Carte({ titre, valeur, detail, ton = "neutre" }: {
  titre: string;
  valeur: string;
  detail?: string;
  ton?: "neutre" | "positif" | "negatif" | "alerte";
}) {
  const couleurs = {
    neutre: "text-slate-900",
    positif: "text-emerald-700",
    negatif: "text-red-700",
    alerte: "text-amber-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{titre}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${couleurs[ton]}`}>{valeur}</p>
      {detail && <p className="mt-1 text-xs text-slate-500 tabular-nums">{detail}</p>}
    </div>
  );
}

export function Indicateurs({ s }: { s: Synthese }) {
  const ecart = s.ecart ?? 0;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Carte titre="Budget" valeur={formatCompact(s.budget)} detail={formatMontant(s.budget)} />
      <Carte titre="Réel" valeur={formatCompact(s.reel)} detail={formatMontant(s.reel)} />
      <Carte
        titre="Écart (réel − budget)"
        valeur={formatCompact(s.ecart)}
        detail={formatMontant(s.ecart)}
        ton={ecart > 0 ? "negatif" : ecart < 0 ? "positif" : "neutre"}
      />
      <Carte
        titre={`Écarts > ±${SEUIL_SIGNIFICATIF_PCT} %`}
        valeur={`${s.significatifs} / ${s.lignes}`}
        detail="lignes à analyser"
        ton={s.significatifs > 0 ? "alerte" : "neutre"}
      />
    </div>
  );
}
