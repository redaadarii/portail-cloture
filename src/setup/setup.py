# Databricks notebook source
# MAGIC %md
# MAGIC # Installation du portail de clôture
# MAGIC
# MAGIC Crée tout le modèle de données. **Idempotent** : `IF NOT EXISTS` et `MERGE` permettent
# MAGIC de relancer ce notebook sans rien casser ni dupliquer.
# MAGIC
# MAGIC | Objet | Rôle | Écrit par |
# MAGIC |---|---|---|
# MAGIC | `fichiers` (volume) | Fichiers Excel déposés | l'application |
# MAGIC | `ref_entites` | Liste des entités (alimente les listes déroulantes) | ce setup |
# MAGIC | `budget`, `reel` | Données importées | le job d'import |
# MAGIC | `ecarts` | Écarts budget / réel calculés | le job de calcul |
# MAGIC | `demandes` | Historique et workflow de validation | l'application (via SQL Warehouse) |

# COMMAND ----------

dbutils.widgets.text("catalog", "workspace")
dbutils.widgets.text("schema", "cloture_dev")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
cs = f"{catalog}.{schema}"

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {cs} COMMENT 'Portail de clôture mensuelle'")
spark.sql(f"CREATE VOLUME IF NOT EXISTS {cs}.fichiers COMMENT 'Fichiers Excel déposés par le portail'")
print(f"✅ Schéma {cs} et volume prêts")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Référentiel des entités
# MAGIC L'application lira cette table pour proposer la liste des entités : ajouter une entité
# MAGIC ici la rend disponible dans l'écran, **sans redéployer l'application**.

# COMMAND ----------

spark.sql(f"""
  CREATE TABLE IF NOT EXISTS {cs}.ref_entites (
    code   STRING  NOT NULL COMMENT 'Code court, ex. CASA',
    nom    STRING  NOT NULL COMMENT 'Libellé affiché',
    actif  BOOLEAN NOT NULL COMMENT 'Seules les entités actives sont proposées',
    CONSTRAINT pk_ref_entites PRIMARY KEY (code)
  ) COMMENT 'Référentiel des entités'
""")

# MERGE = « insère si absent, met à jour si présent » : idempotent, contrairement à INSERT.
spark.sql(f"""
  MERGE INTO {cs}.ref_entites AS cible
  USING (
    -- MERGE n'accepte pas d'alias de colonnes sur sa source : on nomme les colonnes
    -- dans un SELECT, puis on aliase seulement la sous-requête.
    SELECT * FROM VALUES
      ('CASA',      'Casablanca', true),
      ('RABAT',     'Rabat',      true),
      ('TANGER',    'Tanger',     true),
      ('MARRAKECH', 'Marrakech',  true),
      ('AGADIR',    'Agadir',     false)
    AS t(code, nom, actif)
  ) AS source
  ON cible.code = source.code
  WHEN MATCHED THEN UPDATE SET nom = source.nom, actif = source.actif
  WHEN NOT MATCHED THEN INSERT (code, nom, actif) VALUES (source.code, source.nom, source.actif)
""")
print("✅ Référentiel des entités à jour")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Données financières
# MAGIC `budget` et `reel` ont la même structure : un seul notebook d'import, paramétré, servira aux deux (phase 2).
# MAGIC La colonne `demande_id` relie chaque ligne à la demande qui l'a chargée : c'est la **traçabilité**.

# COMMAND ----------

for table, libelle in [("budget", "Budget mensuel"), ("reel", "Réalisé mensuel")]:
    spark.sql(f"""
      CREATE TABLE IF NOT EXISTS {cs}.{table} (
        entite          STRING        NOT NULL,
        compte          STRING        NOT NULL,
        libelle         STRING,
        mois            STRING        NOT NULL COMMENT 'AAAA-MM',
        montant         DECIMAL(18,2) NOT NULL,
        demande_id      STRING        COMMENT 'Demande du portail à l’origine du chargement',
        date_chargement TIMESTAMP
      ) COMMENT '{libelle}'
    """)

spark.sql(f"""
  CREATE TABLE IF NOT EXISTS {cs}.ecarts (
    entite      STRING NOT NULL,
    compte      STRING NOT NULL,
    libelle     STRING,
    mois        STRING NOT NULL,
    budget      DECIMAL(18,2),
    reel        DECIMAL(18,2),
    ecart       DECIMAL(18,2) COMMENT 'reel - budget',
    ecart_pct   DECIMAL(9,2)  COMMENT 'écart en % du budget (NULL si budget nul)',
    date_calcul TIMESTAMP
  ) COMMENT 'Écarts budget / réel'
""")
print("✅ Tables budget, reel, ecarts prêtes")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Demandes (workflow + historique)
# MAGIC Cycle de vie d'une demande :
# MAGIC ```
# MAGIC SOUMISE ──(admin approuve)──▶ APPROUVEE ──▶ EN_COURS ──▶ TERMINEE / ECHEC
# MAGIC    └────(admin rejette)─────▶ REJETEE
# MAGIC ```
# MAGIC Cette table est écrite par **l'application** (via un SQL Warehouse) et mise à jour par **le job**
# MAGIC à la fin du traitement.

# COMMAND ----------

spark.sql(f"""
  CREATE TABLE IF NOT EXISTS {cs}.demandes (
    id              STRING    NOT NULL COMMENT 'UUID généré par l’application',
    traitement      STRING    NOT NULL COMMENT 'Clé du traitement dans le catalogue',
    parametres      STRING    NOT NULL COMMENT 'Paramètres saisis, en JSON',
    fichier         STRING             COMMENT 'Chemin du fichier dans le volume',
    statut          STRING    NOT NULL,
    demandeur       STRING    NOT NULL,
    date_demande    TIMESTAMP NOT NULL,
    valideur        STRING,
    date_validation TIMESTAMP,
    commentaire     STRING             COMMENT 'Motif de rejet ou remarque',
    run_id          BIGINT             COMMENT 'Run Databricks déclenché',
    message         STRING             COMMENT 'Résultat ou erreur du traitement',
    date_maj        TIMESTAMP NOT NULL,
    CONSTRAINT pk_demandes PRIMARY KEY (id)
  ) COMMENT 'Demandes de traitement : workflow et historique'
""")

# Contrainte CHECK : Delta REFUSE toute écriture d'un statut inconnu.
# Elle s'ajoute avec ALTER TABLE ; on vérifie d'abord qu'elle n'existe pas (idempotence).
proprietes = {r.key: r.value for r in spark.sql(f"SHOW TBLPROPERTIES {cs}.demandes").collect()}
if "delta.constraints.statut_valide" not in proprietes:
    spark.sql(f"""
      ALTER TABLE {cs}.demandes ADD CONSTRAINT statut_valide
      CHECK (statut IN ('SOUMISE','APPROUVEE','REJETEE','EN_COURS','TERMINEE','ECHEC'))
    """)
print("✅ Table demandes prête")

# COMMAND ----------

# Récapitulatif
display(spark.sql(f"SHOW TABLES IN {cs}"))
