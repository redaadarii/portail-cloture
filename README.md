# Portail de clôture mensuelle

Application web déployée sur **Databricks Apps** pour piloter la clôture mensuelle :
saisie des paramètres, dépôt de fichiers Excel, validation par un administrateur,
lancement et suivi des **Databricks Jobs**, historique complet.

## Architecture

```
Utilisateur ──▶ Databricks Apps (Next.js) ──▶ SQL Warehouse ──▶ tables Delta (demandes, référentiels)
   (SSO)              │
                      ├──▶ Files API ──▶ Volume (fichiers Excel)
                      └──▶ Jobs API  ──▶ Job d'import ──▶ budget / reel ──▶ écarts ──▶ dashboard
```

## Structure

| Dossier | Contenu |
|---|---|
| `databricks.yml` | Définition du bundle et des environnements |
| `resources/` | Une ressource par fichier : jobs, app, dashboard |
| `src/` | Notebooks des traitements |
| `webapp/` | Application Next.js (phase 3) |
| `donnees_test/` | Fichiers Excel de test |

## Commandes

Toujours depuis la **racine** du dépôt :

```bash
databricks bundle validate          # vérifier (lire les Warnings !)
databricks bundle deploy            # déployer en dev
databricks bundle run cloture_setup # créer le modèle de données
```

Tests Python des contrôles (en local, sans Databricks) :

```bash
pip install -r requirements-dev.txt
pytest tests/
```

## Avancement

- [x] Phase 1 — Fondations : bundle structuré, modèle de données, référentiel
- [x] Phase 2a — Traitements : import générique, contrôles testés, tâche conditionnelle, écarts
- [x] Phase 2b — Dashboard AI/BI rafraîchi par le job
- [x] Phase 3 — Application : socle Next.js, SQL Warehouse, identité et rôles
- [x] Phase 4 — Catalogue de traitements piloté par configuration
- [ ] Phase 5 — Workflow de validation et historique
- [ ] Phase 6 — Tests automatisés (Vitest)
- [ ] Phase 7 — Industrialisation : prod, service principal, GitHub Actions
