import "server-only";
import { executerSql, table } from "./sql";

/**
 * Accès aux données métier. Chaque fonction = une requête, typée.
 * Les composants n'écrivent jamais de SQL : ils appellent ces fonctions.
 */

export interface Entite {
  code: string;
  nom: string;
  actif: boolean;
}

export interface Synthese {
  budget: number | null;
  reel: number | null;
  ecart: number | null;
  lignes: number;
  significatifs: number;
}

export interface LigneEcart {
  entite: string;
  nom_entite: string;
  compte: string;
  libelle: string | null;
  budget: number | null;
  reel: number | null;
  ecart: number | null;
  ecart_pct: number | null;
}

export const SEUIL_SIGNIFICATIF_PCT = 10;

export async function getEntites(): Promise<Entite[]> {
  return executerSql<Entite>(`SELECT code, nom, actif FROM ${table("ref_entites")} ORDER BY nom`);
}

/** Les périodes pour lesquelles des écarts ont été calculés, de la plus récente à la plus ancienne. */
export async function getPeriodes(): Promise<string[]> {
  const lignes = await executerSql<{ mois: string }>(
    `SELECT DISTINCT mois FROM ${table("ecarts")} ORDER BY mois DESC`,
  );
  return lignes.map((l) => l.mois);
}

export async function getSynthese(periode: string): Promise<Synthese> {
  const [s] = await executerSql<Synthese>(
    `SELECT
       SUM(budget) AS budget,
       SUM(reel)   AS reel,
       SUM(ecart)  AS ecart,
       COUNT(*)    AS lignes,
       COUNT_IF(ABS(ecart_pct) > :seuil) AS significatifs
     FROM ${table("ecarts")}
     WHERE mois = :periode`,
    { periode, seuil: SEUIL_SIGNIFICATIF_PCT },
  );
  return s;
}

export async function getPrincipauxEcarts(periode: string, limite = 10): Promise<LigneEcart[]> {
  const n = Math.min(Math.max(Math.trunc(limite), 1), 100); // borné : jamais de valeur libre dans LIMIT
  return executerSql<LigneEcart>(
    `SELECT e.entite, COALESCE(r.nom, e.entite) AS nom_entite, e.compte, e.libelle,
            e.budget, e.reel, e.ecart, e.ecart_pct
     FROM ${table("ecarts")} e
     LEFT JOIN ${table("ref_entites")} r ON r.code = e.entite
     WHERE e.mois = :periode
     ORDER BY ABS(e.ecart_pct) DESC NULLS LAST
     LIMIT ${n}`,
    { periode },
  );
}
