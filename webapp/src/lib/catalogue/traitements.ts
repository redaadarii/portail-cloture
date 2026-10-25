import type { Champ, Traitement } from "./types";

/**
 * LE CATALOGUE. Ajouter un traitement = ajouter un objet ici.
 * Aucun nouvel écran, aucune nouvelle route : formulaire et validation sont générés.
 */

const periode: Champ = {
  nom: "periode",
  type: "periode",
  libelle: "Période",
  obligatoire: true,
};

const fichierFinancier: Champ = {
  nom: "fichier",
  type: "fichier",
  libelle: "Fichier Excel",
  aide: "Colonnes attendues : entite, compte, libelle, mois, montant.",
  obligatoire: true,
  extensions: [".xlsx"],
  tailleMaxMo: 5,
  contenu: "donnees_financieres",
};

export const TRAITEMENTS: Traitement[] = [
  {
    cle: "import_budget",
    titre: "Import du budget",
    description: "Charge le budget mensuel d'une période. Réimporter une période remplace ses lignes.",
    categorie: "Import",
    champs: [periode, fichierFinancier],
    job: {
      cle: "import_donnees",
      parametres: (v, chemin) => ({
        type_donnees: "budget",
        periode: String(v.periode),
        fichier: chemin ?? "",
      }),
    },
  },
  {
    cle: "import_reel",
    titre: "Import du réel",
    description:
      "Charge le réalisé d'une période, recalcule les écarts budget / réel et rafraîchit le dashboard.",
    categorie: "Import",
    champs: [periode, fichierFinancier],
    job: {
      cle: "import_donnees",
      parametres: (v, chemin) => ({
        type_donnees: "reel",
        periode: String(v.periode),
        fichier: chemin ?? "",
      }),
    },
  },
  {
    cle: "recalcul_ecarts",
    titre: "Recalcul des écarts",
    description:
      "Recalcule les écarts d'une période avec un seuil d'alerte personnalisé, à une date d'arrêté donnée.",
    categorie: "Calcul",
    champs: [
      periode,
      {
        nom: "entites",
        type: "liste_multiple",
        libelle: "Entités",
        aide: "Laisser vide pour toutes les entités actives.",
        obligatoire: false,
        options: { referentiel: "entites" },
      },
      {
        nom: "seuil_pct",
        type: "nombre",
        libelle: "Seuil d'écart significatif",
        obligatoire: true,
        min: 1,
        max: 100,
        defaut: 10,
        unite: "%",
      },
      {
        nom: "date_arrete",
        type: "date",
        libelle: "Date d'arrêté",
        aide: "Doit être postérieure ou égale au dernier jour de la période.",
        obligatoire: true,
        apresFinDe: "periode",
      },
      {
        nom: "rafraichir_dashboard",
        type: "booleen",
        libelle: "Rafraîchir le dashboard à la fin du traitement",
        obligatoire: false,
        defaut: true,
      },
      {
        nom: "commentaire",
        type: "texte",
        libelle: "Commentaire",
        aide: "Visible par l'administrateur qui validera la demande.",
        obligatoire: false,
        longueurMax: 200,
      },
    ],
    job: {
      cle: "recalcul_ecarts", // job créé en phase 5
      parametres: (v) => ({
        periode: String(v.periode),
        entites: Array.isArray(v.entites) ? v.entites.join(",") : "",
        seuil_pct: String(v.seuil_pct),
        date_arrete: String(v.date_arrete),
        rafraichir_dashboard: v.rafraichir_dashboard ? "true" : "false",
      }),
    },
  },
    {
    cle: "export_ecarts",
    titre: "Export des écarts",
    description: "Génère un fichier des écarts d'une période, au format choisi, déposé dans le volume.",
    categorie: "Export",
    champs: [
      periode,
      {
        nom: "format",
        type: "liste",
        libelle: "Format",
        obligatoire: true,
        options: {
          valeurs: [
            { valeur: "xlsx", libelle: "Excel (.xlsx)" },
            { valeur: "csv", libelle: "CSV" },
          ],
        },
      },
      {
        nom: "significatifs_seulement",
        type: "booleen",
        libelle: "Seulement les écarts significatifs",
        obligatoire: false,
        defaut: false,
      },
    ],
    job: {
      cle: "export_ecarts",
      parametres: (v) => ({
        periode: String(v.periode),
        format: String(v.format),
        significatifs_seulement: v.significatifs_seulement ? "true" : "false",
      }),
    },
  },
];

export function trouverTraitement(cle: string): Traitement | undefined {
  return TRAITEMENTS.find((t) => t.cle === cle);
}
