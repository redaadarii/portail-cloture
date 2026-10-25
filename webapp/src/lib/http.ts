import "server-only";
import { NextResponse } from "next/server";
import { DatabricksError } from "./databricks";
import { getUtilisateur } from "./identite";
import { peut, type Action, type Utilisateur } from "./roles";

export function erreurServeur(message: string) {
  return NextResponse.json({ erreurs: [{ message }] }, { status: 500 });
}

/** Traduit une erreur technique en message compréhensible ; le détail part dans les logs. */
export function erreurDatabricks(e: unknown) {
  console.error("[databricks]", e);
  if (e instanceof DatabricksError) {
    const message =
      e.status === 401 || e.status === 403
        ? "L'application n'a pas les droits nécessaires sur Databricks"
        : e.status === 404
          ? "Ressource Databricks introuvable (job ou volume)"
          : e.status === 429
            ? "Databricks est momentanément saturé, réessayez dans un instant"
            : "Erreur lors de l'appel à Databricks";
    return NextResponse.json({ erreurs: [{ message }] }, { status: 502 });
  }
  return erreurServeur("Erreur inattendue");
}

/**
 * Garde d'autorisation pour les routes API.
 * Renvoie l'utilisateur s'il a le droit, sinon une réponse 401 (non identifié)
 * ou 403 (identifié mais pas autorisé). À appeler en tout début de route.
 *
 * Masquer un bouton dans l'écran ne suffit JAMAIS : la vraie protection est ici.
 */
export async function exiger(
  action: Action,
): Promise<{ ok: true; utilisateur: Utilisateur } | { ok: false; reponse: NextResponse }> {
  const utilisateur = await getUtilisateur();
  if (!utilisateur) {
    return {
      ok: false,
      reponse: NextResponse.json({ erreurs: [{ message: "Utilisateur non identifié" }] }, { status: 401 }),
    };
  }
  if (!peut(utilisateur.role, action)) {
    console.warn(`[securite] refus : ${utilisateur.email} (rôle ${utilisateur.role ?? "aucun"}) → ${action}`);
    return {
      ok: false,
      reponse: NextResponse.json(
        { erreurs: [{ message: "Vous n'avez pas les droits pour effectuer cette action" }] },
        { status: 403 },
      ),
    };
  }
  return { ok: true, utilisateur };
}
