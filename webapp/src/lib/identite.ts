import "server-only";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getGroupesViaApplication, getGroupesViaTokenUtilisateur } from "./databricks";
import { roleDepuisGroupes, type Utilisateur } from "./roles";

/**
 * Qui est connecté ?
 *
 * Sur Databricks Apps, l'utilisateur s'est déjà authentifié (SSO Databricks, ou Entra ID
 * sur Azure Databricks) AVANT d'atteindre l'application. Le proxy de Databricks ajoute
 * alors des en-têtes à chaque requête :
 *   X-Forwarded-Email               → e-mail
 *   X-Forwarded-Preferred-Username  → nom d'utilisateur
 *   X-Forwarded-User                → identifiant
 *   X-Forwarded-Access-Token        → token au nom de l'utilisateur (si l'autorisation utilisateur est activée)
 *
 * Ces en-têtes ne sont fiables QUE parce que l'application n'est joignable qu'à travers
 * ce proxy. Une application exposée directement sur Internet ne devrait jamais leur faire confiance.
 */

const correspondance = () => ({
  admins: process.env.GROUPE_ADMINS ?? "cloture-admins",
  operateurs: process.env.GROUPE_OPERATEURS ?? "cloture-operateurs",
  lecteurs: process.env.GROUPE_LECTEURS ?? "cloture-lecteurs",
});

// Petit cache mémoire : on évite d'appeler Databricks à chaque requête.
// Durée courte, pour qu'un changement de groupe soit pris en compte rapidement.
const CACHE_MS = 60_000;
const cache = new Map<string, { groupes: string[]; source: Utilisateur["source"]; expire: number }>();

export async function getUtilisateur(): Promise<Utilisateur | null> {
  // L'identité est propre à chaque requête : jamais pré-rendue (et le cache ci-dessous utilise l'heure).
  await connection();
  const h = await headers();
  const email = h.get("x-forwarded-email");

  // Développement local : pas de proxy Databricks, on simule l'utilisateur.
  // Jamais actif en production (next start ⇒ NODE_ENV=production).
  if (!email) {
    if (process.env.NODE_ENV === "development" && process.env.DEV_USER_EMAIL) {
      const groupes = (process.env.DEV_USER_GROUPS ?? "").split(",").map((g) => g.trim()).filter(Boolean);
      return {
        email: process.env.DEV_USER_EMAIL,
        nom: process.env.DEV_USER_EMAIL,
        groupes,
        role: roleDepuisGroupes(groupes, correspondance()),
        source: "dev-local",
      };
    }
    return null; // personne d'identifié : on refuse
  }

  const nom = h.get("x-forwarded-preferred-username") ?? email;
  const tokenUtilisateur = h.get("x-forwarded-access-token");

  const enCache = cache.get(email);
  let groupes: string[];
  let source: Utilisateur["source"];

  if (enCache && enCache.expire > Date.now()) {
    ({ groupes, source } = enCache);
  } else {
    try {
      if (tokenUtilisateur) {
        groupes = await getGroupesViaTokenUtilisateur(tokenUtilisateur);
        source = "token-utilisateur";
      } else {
        groupes = await getGroupesViaApplication(email);
        source = "application";
      }
      cache.set(email, { groupes, source, expire: Date.now() + CACHE_MS });
    } catch (e) {
      // Impossible de connaître les groupes : on ne devine pas, on refuse (rôle null).
      // Pas de mise en cache : on réessaiera à la prochaine requête.
      console.error("[identite] lecture des groupes impossible pour", email, e);
      groupes = [];
      source = tokenUtilisateur ? "token-utilisateur" : "application";
    }
  }

  return { email, nom, groupes, role: roleDepuisGroupes(groupes, correspondance()), source };
}
