"use client";

import { useState, type FormEvent } from "react";
import { valider, type ErreurChamp } from "@/lib/catalogue/schema";
import { trouverTraitement } from "@/lib/catalogue/traitements";
import type { ContexteCatalogue } from "@/lib/catalogue/types";
import { formatMontant } from "@/lib/format";
import { ChampFormulaire } from "./ChampFormulaire";

interface Resultat {
  recapitulatif: { libelle: string; valeur: string }[];
  fichier?: { lignes: number; total: number; entites: string[] };
  job: { cle: string; parametres: Record<string, string> };
}

/**
 * Formulaire GÉNÉRIQUE : il ne connaît aucun traitement en particulier.
 * Il reçoit une clé, retrouve la description dans le catalogue et en déduit tout le reste.
 * (On passe la clé et non l'objet : la description contient des fonctions, qui ne
 *  peuvent pas être transmises d'un composant serveur à un composant client.)
 */
export function FormulaireTraitement({
  cle,
  ctx,
  defauts,
  lectureSeule,
}: {
  cle: string;
  ctx: ContexteCatalogue;
  defauts: Record<string, string>;
  lectureSeule: boolean;
}) {
  const traitement = trouverTraitement(cle)!;
  const [erreurs, setErreurs] = useState<ErreurChamp[]>([]);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function controler(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreurs([]);
    setResultat(null);
    const form = new FormData(e.currentTarget);

    // 1. Navigateur : même fonction de validation que le serveur → retour instantané
    const local = valider(traitement, ctx, form);
    if (!local.ok) {
      setErreurs(local.erreurs);
      return;
    }

    // 2. Serveur : revalidation + contrôle du contenu du fichier
    setEnCours(true);
    try {
      const res = await fetch(`/api/catalogue/${traitement.cle}/controle`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) setErreurs(json.erreurs ?? [{ message: "Erreur inattendue" }]);
      else setResultat(json);
    } catch {
      setErreurs([{ message: "Impossible de joindre le serveur" }]);
    } finally {
      setEnCours(false);
    }
  }

  const nomsChamps = new Set(traitement.champs.map((c) => c.nom));
  const erreurDe = (nom: string) => erreurs.find((e) => e.champ === nom && e.ligne === undefined)?.message;
  const erreursGenerales = erreurs.filter((e) => !e.champ || !nomsChamps.has(e.champ) || e.ligne !== undefined);

  return (
    <div className="space-y-6">
      {/* Toute modification invalide le récapitulatif : il faut recontrôler. */}
      <form onSubmit={controler} onChange={() => setResultat(null)} noValidate className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <fieldset disabled={lectureSeule || enCours} className="space-y-5">
          {traitement.champs.map((champ) => (
            <ChampFormulaire key={champ.nom} champ={champ} ctx={ctx} defauts={defauts} erreur={erreurDe(champ.nom)} />
          ))}
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enCours ? "Contrôle en cours…" : "Contrôler la demande"}
          </button>
        </fieldset>
      </form>

      {erreursGenerales.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <h2 className="font-semibold">
            La demande n&apos;est pas valide ({erreursGenerales.length} problème{erreursGenerales.length > 1 ? "s" : ""})
          </h2>
          <ul className="mt-2 space-y-1">
            {erreursGenerales.map((e, i) => (
              <li key={i}>
                {e.ligne !== undefined && <span className="font-mono font-medium">Ligne {e.ligne} · </span>}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultat && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6" aria-live="polite">
          <h2 className="font-semibold text-emerald-900">✓ Demande conforme</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            {resultat.recapitulatif.map((r) => (
              <div key={r.libelle} className="contents">
                <dt className="text-slate-600">{r.libelle}</dt>
                <dd className="font-medium">{r.valeur}</dd>
              </div>
            ))}
            {resultat.fichier && (
              <div className="contents">
                <dt className="text-slate-600">Contenu du fichier</dt>
                <dd className="font-medium">
                  {resultat.fichier.lignes} lignes · total {formatMontant(resultat.fichier.total)} ·{" "}
                  {resultat.fichier.entites.length} entité(s)
                </dd>
              </div>
            )}
          </dl>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-slate-600">Paramètres transmis au job « {resultat.job.cle} »</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-white p-3 text-xs">{JSON.stringify(resultat.job.parametres, null, 2)}</pre>
          </details>
          <button
            type="button"
            disabled
            title="Disponible en phase 5 : enregistrement et workflow de validation"
            className="mt-4 rounded-md bg-emerald-700 px-4 py-2 font-medium text-white opacity-50"
          >
            Soumettre la demande (phase 5)
          </button>
        </section>
      )}
    </div>
  );
}
