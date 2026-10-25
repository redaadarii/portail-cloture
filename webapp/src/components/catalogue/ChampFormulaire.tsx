"use client";

import type { Champ, ContexteCatalogue } from "@/lib/catalogue/types";

const CLASSE_INPUT =
  "mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100";

/**
 * Dessine UN champ à partir de sa description. C'est ici que la configuration
 * devient de l'interface : un `switch` sur le type, rien de spécifique à un traitement.
 * Les champs sont « non contrôlés » (defaultValue) : le formulaire est lu d'un bloc via FormData.
 */
export function ChampFormulaire({
  champ,
  ctx,
  defauts,
  erreur,
}: {
  champ: Champ;
  ctx: ContexteCatalogue;
  defauts: Record<string, string>;
  erreur?: string;
}) {
  const id = `champ-${champ.nom}`;
  const idAide = `${id}-aide`;
  const aria = {
    "aria-invalid": erreur ? true : undefined,
    "aria-describedby": champ.aide ? idAide : undefined,
  };

  let controle: React.ReactNode;
  switch (champ.type) {
    case "periode":
      controle = <input id={id} name={champ.nom} type="month" defaultValue={defauts.periode} className={`${CLASSE_INPUT} w-48`} {...aria} />;
      break;
    case "date":
      controle = <input id={id} name={champ.nom} type="date" className={`${CLASSE_INPUT} w-48`} {...aria} />;
      break;
    case "nombre":
      controle = (
        <span className="flex items-center gap-2">
          <input id={id} name={champ.nom} type="number" min={champ.min} max={champ.max} step="any" defaultValue={champ.defaut} className={`${CLASSE_INPUT} w-32`} {...aria} />
          {champ.unite && <span className="mt-1 text-slate-500">{champ.unite}</span>}
        </span>
      );
      break;
    case "texte":
      controle = <textarea id={id} name={champ.nom} maxLength={champ.longueurMax} rows={2} className={`${CLASSE_INPUT} w-full`} {...aria} />;
      break;
    case "fichier":
      controle = (
        <input
          id={id}
          name={champ.nom}
          type="file"
          accept={champ.extensions.join(",")}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium hover:file:bg-slate-200"
          {...aria}
        />
      );
      break;
    case "booleen":
      return (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input name={champ.nom} type="checkbox" defaultChecked={champ.defaut} className="h-4 w-4 rounded border-slate-300" />
            {champ.libelle}
          </label>
          {erreur && <p className="mt-1 text-sm text-red-600">{erreur}</p>}
        </div>
      );
    case "liste":
    case "liste_multiple": {
      const options =
        "referentiel" in champ.options
          ? ctx.entites.map((e) => ({ valeur: e.code, libelle: e.nom }))
          : champ.options.valeurs;
      controle =
        champ.type === "liste" ? (
          <select id={id} name={champ.nom} defaultValue="" className={`${CLASSE_INPUT} w-64`} {...aria}>
            <option value="">— Choisir —</option>
            {options.map((o) => (
              <option key={o.valeur} value={o.valeur}>{o.libelle}</option>
            ))}
          </select>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-libelle`}>
            {options.map((o) => (
              <label key={o.valeur} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input type="checkbox" name={champ.nom} value={o.valeur} className="h-3.5 w-3.5" />
                {o.libelle}
              </label>
            ))}
          </div>
        );
      break;
    }
  }

  return (
    <div>
      <label
        htmlFor={champ.type === "liste_multiple" ? undefined : id}
        id={`${id}-libelle`}
        className="block text-sm font-medium"
      >
        {champ.libelle}
        {champ.obligatoire && <span className="text-red-600"> *</span>}
      </label>
      {controle}
      {champ.aide && <p id={idAide} className="mt-1 text-xs text-slate-500">{champ.aide}</p>}
      {erreur && <p className="mt-1 text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
