import "server-only";
import ExcelJS from "exceljs";
import type { ErreurChamp } from "./schema";

/**
 * Contrôle d'un fichier de données financières (budget ou réel).
 * Mêmes règles que src/traitements/controles.py (le job) : l'application refuse
 * tôt et clairement, le job reste le filet de sécurité.
 */

const COLONNES = ["entite", "compte", "libelle", "mois", "montant"] as const;
const MAX_ERREURS = 50;

function valeurCellule(v: ExcelJS.CellValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 7); // Excel transforme souvent "2026-10" en date
  if (typeof v === "object") {
    if ("result" in v) return valeurCellule(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
  }
  return String(v);
}

const texte = (v: string | number | null) => (v === null ? "" : String(v).trim());

function nombre(v: string | number | null): number | null {
  if (typeof v === "number") return v;
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(/[\s ]/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export interface ResumeFichier {
  lignes: number;
  total: number;
  entites: string[];
}

export async function controlerDonneesFinancieres(
  contenu: ArrayBuffer,
  periode: string,
  entites: { code: string; actif: boolean }[],
): Promise<{ erreurs: ErreurChamp[]; resume?: ResumeFichier }> {
  const classeur = new ExcelJS.Workbook();
  try {
    await classeur.xlsx.load(contenu);
  } catch {
    return { erreurs: [{ champ: "fichier", message: "Le fichier n'est pas un classeur Excel lisible" }] };
  }

  const feuille = classeur.worksheets[0];
  if (!feuille) return { erreurs: [{ champ: "fichier", message: "Le classeur ne contient aucune feuille" }] };

  const positions = new Map<string, number>();
  feuille.getRow(1).eachCell((cell, col) => positions.set(texte(valeurCellule(cell.value)).toLowerCase(), col));
  const manquantes = COLONNES.filter((c) => !positions.has(c));
  if (manquantes.length) {
    return { erreurs: [{ ligne: 1, message: `Colonne(s) manquante(s) : ${manquantes.join(", ")}` }] };
  }
  const lire = (row: ExcelJS.Row, col: (typeof COLONNES)[number]) => valeurCellule(row.getCell(positions.get(col)!).value);

  const actives = new Set(entites.filter((e) => e.actif).map((e) => e.code));
  const inactives = new Set(entites.filter((e) => !e.actif).map((e) => e.code));

  const erreurs: ErreurChamp[] = [];
  const mauvaisMois: number[] = [];
  const vues = new Map<string, number>();
  const entitesVues = new Set<string>();
  let lignes = 0;
  let total = 0;

  feuille.eachRow({ includeEmpty: false }, (row, num) => {
    if (num === 1) return;
    lignes++;
    const entite = texte(lire(row, "entite")).toUpperCase();
    const compte = texte(lire(row, "compte"));
    const mois = texte(lire(row, "mois"));
    const montantBrut = lire(row, "montant");
    const montant = nombre(montantBrut);

    if (!entite) erreurs.push({ ligne: num, message: "entité vide" });
    else if (inactives.has(entite)) erreurs.push({ ligne: num, message: `l'entité ${entite} est inactive` });
    else if (!actives.has(entite)) erreurs.push({ ligne: num, message: `l'entité ${entite} est inconnue du référentiel` });
    else entitesVues.add(entite);

    if (!/^\d{4}$/.test(compte)) erreurs.push({ ligne: num, message: `compte « ${compte} » invalide (4 chiffres attendus)` });
    if (mois !== periode) mauvaisMois.push(num);

    if (montant === null) erreurs.push({ ligne: num, message: `montant « ${texte(montantBrut) || "vide"} » n'est pas un nombre` });
    else if (montant < 0) erreurs.push({ ligne: num, message: `montant négatif (${montant})` });
    else total += montant;

    const cle = `${entite}|${compte}`;
    const premiere = vues.get(cle);
    if (premiere) erreurs.push({ ligne: num, message: `doublon entité ${entite} / compte ${compte} (déjà en ligne ${premiere})` });
    else vues.set(cle, num);
  });

  if (lignes === 0) return { erreurs: [{ champ: "fichier", message: "Le fichier ne contient aucune ligne de données" }] };

  if (mauvaisMois.length) {
    const liste = mauvaisMois.slice(0, 10).join(", ") + (mauvaisMois.length > 10 ? "…" : "");
    erreurs.unshift({ message: `${mauvaisMois.length} ligne(s) ne concernent pas la période ${periode} : lignes ${liste}` });
  }

  if (erreurs.length) {
    const reste = erreurs.length - MAX_ERREURS;
    return { erreurs: reste > 0 ? [...erreurs.slice(0, MAX_ERREURS), { message: `… et ${reste} autre(s) anomalie(s)` }] : erreurs };
  }
  return { erreurs: [], resume: { lignes, total: Math.round(total * 100) / 100, entites: [...entitesVues].sort() } };
}
