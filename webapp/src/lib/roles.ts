/**
 * Rôles applicatifs et droits associés. Aucun code serveur ici :
 * l'écran utilise les mêmes règles pour masquer ce que l'utilisateur ne peut pas faire.
 *
 * Principe : l'application ne gère PAS de liste d'utilisateurs.
 * Elle lit les GROUPES de la personne (gérés dans Databricks, ou dans Entra ID en entreprise)
 * et en déduit un rôle. Ajouter quelqu'un au bon groupe suffit à lui donner accès.
 */

export type Role = "LECTEUR" | "OPERATEUR" | "ADMIN";

export type Action =
  | "consulter" // voir le statut des traitements
  | "lancer_import" // déposer un fichier et lancer le job
  | "voir_detail_technique"; // lien vers le run Databricks, messages techniques

const DROITS: Record<Role, Action[]> = {
  LECTEUR: ["consulter"],
  OPERATEUR: ["consulter", "lancer_import"],
  ADMIN: ["consulter", "lancer_import", "voir_detail_technique"],
};

export const LIBELLES_ROLES: Record<Role, string> = {
  LECTEUR: "Lecteur",
  OPERATEUR: "Opérateur",
  ADMIN: "Administrateur",
};

export function peut(role: Role | null, action: Action): boolean {
  return role !== null && DROITS[role].includes(action);
}

/** Correspondance groupe → rôle, configurable par variables d'environnement. */
export interface CorrespondanceGroupes {
  admins: string;
  operateurs: string;
  lecteurs: string;
}

/**
 * Si une personne est dans plusieurs groupes, elle obtient le rôle le plus élevé.
 * Si elle n'est dans aucun groupe du portail : null → accès refusé (refus par défaut).
 */
export function roleDepuisGroupes(groupes: string[], c: CorrespondanceGroupes): Role | null {
  const g = new Set(groupes.map((x) => x.toLowerCase()));
  if (g.has(c.admins.toLowerCase())) return "ADMIN";
  if (g.has(c.operateurs.toLowerCase())) return "OPERATEUR";
  if (g.has(c.lecteurs.toLowerCase())) return "LECTEUR";
  return null;
}

/** Ce que l'écran a besoin de savoir sur la personne connectée. */
export interface Utilisateur {
  email: string;
  nom: string;
  groupes: string[];
  role: Role | null;
  /** D'où viennent les groupes : utile pour comprendre et déboguer. */
  source: "token-utilisateur" | "application" | "dev-local";
}
