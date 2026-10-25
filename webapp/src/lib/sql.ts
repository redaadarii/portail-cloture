import "server-only";
import { connection } from "next/server";
import { call } from "./databricks";

/**
 * Exécution de requêtes SQL via un SQL Warehouse (API « Statement Execution »).
 *
 *   POST /api/2.0/sql/statements          → lance la requête (et attend jusqu'à 30 s)
 *   GET  /api/2.0/sql/statements/{id}     → suit une requête encore en cours
 *
 * Les valeurs passent par des PARAMÈTRES NOMMÉS (:periode) : jamais de concaténation
 * de texte saisi par l'utilisateur dans le SQL (protection contre l'injection SQL).
 */

export type ParametreSql = string | number | boolean | null;

export class SqlError extends Error {
  constructor(
    message: string,
    public statementId?: string,
  ) {
    super(message);
    this.name = "SqlError";
  }
}

interface ColonneApi {
  name: string;
  type_name: string;
}
interface ReponseApi {
  statement_id: string;
  status: { state: string; error?: { message?: string } };
  manifest?: { schema?: { columns?: ColonneApi[] } };
  result?: {
    data_array?: (string | null)[][];
    next_chunk_internal_link?: string;
  };
}

const ETATS_FINAUX = new Set(["SUCCEEDED", "FAILED", "CANCELED", "CLOSED"]);
const DELAI_MAX_MS = 120_000;

function getWarehouseId(): string {
  const id = process.env.DATABRICKS_WAREHOUSE_ID;
  if (!id) throw new SqlError("Variable d'environnement DATABRICKS_WAREHOUSE_ID manquante");
  return id;
}

/** L'API renvoie toutes les valeurs en texte : on les reconvertit selon le type de la colonne. */
function convertir(valeur: string | null, type: string): unknown {
  if (valeur === null) return null;
  switch (type) {
    case "BYTE":
    case "SHORT":
    case "INT":
    case "LONG":
    case "FLOAT":
    case "DOUBLE":
    case "DECIMAL":
      return Number(valeur);
    case "BOOLEAN":
      return valeur === "true";
    default:
      return valeur; // STRING, DATE, TIMESTAMP… restent du texte (ISO pour les dates)
  }
}

function typeParametre(v: ParametreSql): string | undefined {
  if (typeof v === "number") return Number.isInteger(v) ? "BIGINT" : "DOUBLE";
  if (typeof v === "boolean") return "BOOLEAN";
  return undefined; // STRING par défaut
}

/**
 * Exécute une requête et renvoie les lignes sous forme d'objets { colonne: valeur }.
 * Pour une requête d'écriture (INSERT, UPDATE…), le tableau renvoyé est vide.
 */
export async function executerSql<T = Record<string, unknown>>(
  requete: string,
  parametres: Record<string, ParametreSql> = {},
): Promise<T[]> {
  // Les données changent à chaque import : elles doivent être lues AU MOMENT de la requête
  // de l'utilisateur, jamais figées lors du pré-rendu de la page (Next.js 16).
  await connection();

  let rep = await call<ReponseApi>("/api/2.0/sql/statements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      warehouse_id: getWarehouseId(),
      statement: requete,
      parameters: Object.entries(parametres).map(([name, value]) => ({
        name,
        value: value === null ? null : String(value),
        type: typeParametre(value),
      })),
      wait_timeout: "30s", // attente synchrone (le warehouse serverless démarre vite)
      on_wait_timeout: "CONTINUE", // au-delà : on passe en suivi asynchrone
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  });

  // Si la requête n'est pas terminée après 30 s, on interroge son statut toutes les secondes.
  const debut = Date.now();
  while (!ETATS_FINAUX.has(rep.status.state)) {
    if (Date.now() - debut > DELAI_MAX_MS) {
      throw new SqlError("La requête SQL a dépassé le délai maximal", rep.statement_id);
    }
    await new Promise((r) => setTimeout(r, 1000));
    rep = await call<ReponseApi>(`/api/2.0/sql/statements/${rep.statement_id}`);
  }

  if (rep.status.state !== "SUCCEEDED") {
    // Attention : une requête en échec renvoie quand même HTTP 200, l'erreur est dans le statut.
    throw new SqlError(rep.status.error?.message ?? `Requête ${rep.status.state}`, rep.statement_id);
  }

  const colonnes = rep.manifest?.schema?.columns ?? [];
  const lignes = [...(rep.result?.data_array ?? [])];

  // Gros résultats : la suite arrive en plusieurs « chunks » à récupérer un par un.
  let suivant = rep.result?.next_chunk_internal_link;
  while (suivant) {
    const chunk = await call<{ data_array?: (string | null)[][]; next_chunk_internal_link?: string }>(suivant);
    lignes.push(...(chunk.data_array ?? []));
    suivant = chunk.next_chunk_internal_link;
  }

  return lignes.map(
    (ligne) =>
      Object.fromEntries(colonnes.map((c, i) => [c.name, convertir(ligne[i], c.type_name)])) as T,
  );
}

// ---------------------------------------------------------------------------
// Noms de tables : le catalogue et le schéma viennent de la configuration (dev ≠ prod).
// Ce sont des IDENTIFIANTS (pas des valeurs) : ils ne peuvent pas passer en paramètre,
// on les valide donc strictement avant de les insérer dans le SQL.
// ---------------------------------------------------------------------------

const RE_IDENTIFIANT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function table(nom: string): string {
  const catalogue = process.env.CLOTURE_CATALOG ?? "workspace";
  const schema = process.env.CLOTURE_SCHEMA ?? "cloture_dev";
  for (const partie of [catalogue, schema, nom]) {
    if (!RE_IDENTIFIANT.test(partie)) throw new SqlError(`Identifiant SQL invalide : « ${partie} »`);
  }
  return `${catalogue}.${schema}.${nom}`;
}
