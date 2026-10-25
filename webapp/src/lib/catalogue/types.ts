/**
 * Le « langage » du catalogue : chaque traitement est DÉCRIT (pas codé).
 * À partir de cette description, l'application génère :
 *   - le formulaire (composant ChampFormulaire),
 *   - la validation Zod (construireSchema), identique côté navigateur et serveur,
 *   - les paramètres envoyés au Databricks Job.
 *
 * L'union discriminée sur `type` permet à TypeScript de vérifier que chaque
 * champ a exactement les propriétés qui le concernent.
 */

interface ChampBase {
  /** Nom technique : clé dans les valeurs, nom du champ du formulaire. */
  nom: string;
  libelle: string;
  /** Texte d'aide affiché sous le champ. */
  aide?: string;
  obligatoire: boolean;
}

export interface ChampPeriode extends ChampBase {
  type: "periode"; // mois au format AAAA-MM
}

export interface ChampDate extends ChampBase {
  type: "date"; // AAAA-MM-JJ
  /** Règle entre champs : la date doit être postérieure ou égale à la fin de cette période. */
  apresFinDe?: string;
}

export interface ChampFichier extends ChampBase {
  type: "fichier";
  extensions: string[]; // ex. [".xlsx"]
  tailleMaxMo: number;
  /** Contenu attendu : déclenche le contrôle des lignes côté serveur. */
  contenu?: "donnees_financieres";
}

export interface ChampNombre extends ChampBase {
  type: "nombre";
  min?: number;
  max?: number;
  defaut?: number;
  unite?: string;
}

export interface ChampBooleen extends ChampBase {
  type: "booleen";
  defaut?: boolean;
}

export interface ChampTexte extends ChampBase {
  type: "texte";
  longueurMax: number;
}

/** Les options viennent soit d'une liste fixe, soit d'un référentiel lu en base. */
export type SourceOptions =
  | { referentiel: "entites" }
  | { valeurs: { valeur: string; libelle: string }[] };

export interface ChampListe extends ChampBase {
  type: "liste" | "liste_multiple";
  options: SourceOptions;
}

export type Champ =
  | ChampPeriode
  | ChampDate
  | ChampFichier
  | ChampNombre
  | ChampBooleen
  | ChampTexte
  | ChampListe;

/** Valeurs validées d'un formulaire (sortie du schéma Zod). */
export type Valeurs = Record<string, string | string[] | number | boolean | File | undefined>;

export interface Traitement {
  cle: string;
  titre: string;
  description: string;
  categorie: "Import" | "Calcul";
  champs: Champ[];
  job: {
    /** Clé du job dans le bundle (resources/*.job.yml). */
    cle: string;
    /** Transforme les valeurs du formulaire en paramètres du job (toujours des chaînes). */
    parametres: (valeurs: Valeurs, cheminFichier?: string) => Record<string, string>;
  };
}

/** Données dynamiques nécessaires pour construire formulaires et schémas. */
export interface ContexteCatalogue {
  entites: { code: string; nom: string }[];
}
