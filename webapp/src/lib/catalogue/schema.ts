import { z } from "zod";
import type { Champ, ContexteCatalogue, Traitement, Valeurs } from "./types";

/**
 * Génère, à partir de la DESCRIPTION d'un traitement, le schéma Zod qui le valide.
 * Ce fichier n'importe rien de serveur : le même code tourne dans le navigateur
 * (retour immédiat) et sur le serveur (la vraie barrière).
 */

const RE_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Les champs vides arrivent sous forme de "" : on les traite comme « non renseignés ». */
const videEnUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

function optionsDe(champ: Extract<Champ, { type: "liste" | "liste_multiple" }>, ctx: ContexteCatalogue) {
  return "referentiel" in champ.options
    ? ctx.entites.map((e) => ({ valeur: e.code, libelle: e.nom }))
    : champ.options.valeurs;
}

/** Schéma d'un champ « obligatoire » ; l'optionnalité est ajoutée ensuite. */
function schemaDeBase(champ: Champ, ctx: ContexteCatalogue): z.ZodType {
  const requis = `${champ.libelle} : obligatoire`;
  switch (champ.type) {
    case "periode":
      return z.string({ error: requis }).regex(RE_PERIODE, `${champ.libelle} : format AAAA-MM attendu`);

    case "date":
      return z
        .string({ error: requis })
        .regex(RE_DATE, `${champ.libelle} : date invalide`)
        .refine((d) => !Number.isNaN(Date.parse(d)), `${champ.libelle} : date inexistante`);

    case "nombre": {
      let s = z.coerce.number({ error: `${champ.libelle} : nombre attendu` });
      if (champ.min !== undefined) s = s.min(champ.min, `${champ.libelle} : minimum ${champ.min}`);
      if (champ.max !== undefined) s = s.max(champ.max, `${champ.libelle} : maximum ${champ.max}`);
      return s;
    }

    case "booleen":
      // Une case à cocher non cochée n'est pas envoyée du tout : absente = false.
      return z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

    case "texte":
      return z
        .string({ error: requis })
        .trim()
        .min(1, requis)
        .max(champ.longueurMax, `${champ.libelle} : ${champ.longueurMax} caractères maximum`);

    case "fichier": {
      const tailleMax = champ.tailleMaxMo * 1024 * 1024;
      return z
        .instanceof(File, { error: requis })
        .refine((f) => f.size > 0, `${champ.libelle} : le fichier est vide`)
        .refine((f) => f.size <= tailleMax, `${champ.libelle} : ${champ.tailleMaxMo} Mo maximum`)
        .refine(
          (f) => champ.extensions.some((ext) => f.name.toLowerCase().endsWith(ext)),
          `${champ.libelle} : formats acceptés ${champ.extensions.join(", ")}`,
        );
    }

    case "liste":
    case "liste_multiple": {
      const valeurs = optionsDe(champ, ctx).map((o) => o.valeur);
      // Une valeur hors liste (requête bricolée) est refusée côté serveur.
      const unique = z
        .string({ error: requis })
        .refine((v) => valeurs.includes(v), `${champ.libelle} : valeur non autorisée`);
      if (champ.type === "liste") return unique;
      const multiple = z.array(unique);
      return champ.obligatoire ? multiple.min(1, `${champ.libelle} : au moins une valeur`) : multiple;
    }
  }
}

function schemaChamp(champ: Champ, ctx: ContexteCatalogue): z.ZodType {
  const base = schemaDeBase(champ, ctx);
  if (champ.type === "booleen" || champ.type === "liste_multiple") return base; // jamais « absents »
  if (champ.type === "fichier") {
    // Un input file vide envoie un File de 0 octet : on le considère comme « non renseigné ».
    const fichierVide = (v: unknown) => (v instanceof File && v.size === 0 && v.name === "" ? undefined : v);
    return z.preprocess(fichierVide, champ.obligatoire ? base : base.optional());
  }
  return z.preprocess(videEnUndefined, champ.obligatoire ? base : base.optional());
}

/** Dernier jour d'une période AAAA-MM, au format AAAA-MM-JJ. */
export function finDePeriode(periode: string): string {
  const [a, m] = periode.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export function construireSchema(traitement: Traitement, ctx: ContexteCatalogue) {
  const forme = Object.fromEntries(traitement.champs.map((c) => [c.nom, schemaChamp(c, ctx)]));

  return z.object(forme).superRefine((valeurs, ctxZod) => {
    // Règles ENTRE champs, déclarées dans la configuration.
    for (const champ of traitement.champs) {
      if (champ.type === "date" && champ.apresFinDe) {
        const date = valeurs[champ.nom];
        const ref = valeurs[champ.apresFinDe];
        if (typeof date === "string" && typeof ref === "string" && RE_PERIODE.test(ref)) {
          const fin = finDePeriode(ref);
          if (date < fin) {
            ctxZod.addIssue({
              code: "custom",
              path: [champ.nom],
              message: `${champ.libelle} : doit être au plus tôt le ${fin.split("-").reverse().join("/")}`,
            });
          }
        }
      }
    }
  });
}

/** Extrait les valeurs brutes d'un FormData, selon la description des champs. */
export function lireValeurs(traitement: Traitement, form: FormData): Record<string, unknown> {
  return Object.fromEntries(
    traitement.champs.map((c) => [
      c.nom,
      c.type === "liste_multiple" ? form.getAll(c.nom).map(String) : (form.get(c.nom) ?? undefined),
    ]),
  );
}

export interface ErreurChamp {
  champ?: string;
  ligne?: number;
  message: string;
}

/** Validation complète : la même fonction est appelée dans le navigateur et sur le serveur. */
export function valider(
  traitement: Traitement,
  ctx: ContexteCatalogue,
  form: FormData,
): { ok: true; valeurs: Valeurs } | { ok: false; erreurs: ErreurChamp[] } {
  const res = construireSchema(traitement, ctx).safeParse(lireValeurs(traitement, form));
  if (res.success) return { ok: true, valeurs: res.data as Valeurs };
  const erreurs = res.error.issues.map((i) => ({ champ: String(i.path[0] ?? ""), message: i.message }));
  // Plusieurs valeurs fausses dans une liste donnent le même message : on ne l'affiche qu'une fois.
  const uniques = erreurs.filter((e, i) => erreurs.findIndex((x) => x.champ === e.champ && x.message === e.message) === i);
  return { ok: false, erreurs: uniques };
}

/** Valeurs lisibles par un humain, pour le récapitulatif. */
export function recapitulatif(traitement: Traitement, ctx: ContexteCatalogue, v: Valeurs) {
  return traitement.champs.map((c) => {
    const brut = v[c.nom];
    let affiche: string;
    if (brut === undefined || (Array.isArray(brut) && brut.length === 0)) {
      affiche = c.type === "liste_multiple" ? "Toutes" : "—";
    } else if (brut instanceof File) {
      affiche = `${brut.name} (${(brut.size / 1024).toFixed(0)} Ko)`;
    } else if (typeof brut === "boolean") {
      affiche = brut ? "Oui" : "Non";
    } else if (c.type === "liste" || c.type === "liste_multiple") {
      const options = optionsDe(c, ctx);
      const libelles = (Array.isArray(brut) ? brut : [String(brut)]).map(
        (val) => options.find((o) => o.valeur === val)?.libelle ?? val,
      );
      affiche = libelles.join(", ");
    } else if (c.type === "date") {
      affiche = String(brut).split("-").reverse().join("/");
    } else {
      affiche = `${brut}${c.type === "nombre" && c.unite ? ` ${c.unite}` : ""}`;
    }
    return { libelle: c.libelle, valeur: affiche };
  });
}
