# Databricks notebook source
# MAGIC %md
# MAGIC # Calcul des écarts budget / réel
# MAGIC
# MAGIC Compare le budget et le réel d'une période, par entité et par compte.
# MAGIC Un **FULL OUTER JOIN** garde aussi les lignes présentes d'un seul côté
# MAGIC (dépense réelle non budgétée, ou budget non consommé).

# COMMAND ----------

dbutils.widgets.text("catalog", "workspace")
dbutils.widgets.text("schema", "cloture_dev")
dbutils.widgets.text("periode", "2026-10")

cs = f"{dbutils.widgets.get('catalog')}.{dbutils.widgets.get('schema')}"
periode = dbutils.widgets.get("periode")

from controles import periode_valide

if not periode_valide(periode):
    raise ValueError(f"Période invalide : « {periode} »")

# COMMAND ----------

# Requêtes PARAMÉTRÉES (:periode) : la valeur n'est jamais collée dans le texte SQL.
# C'est la protection standard contre l'injection SQL.
nb = spark.sql(
    f"""
    SELECT
      (SELECT COUNT(*) FROM {cs}.budget WHERE mois = :periode) AS budget,
      (SELECT COUNT(*) FROM {cs}.reel   WHERE mois = :periode) AS reel
    """,
    args={"periode": periode},
).first()

if nb["budget"] == 0:
    raise ValueError(f"Aucun budget pour {periode} : importez le budget avant de calculer les écarts")
if nb["reel"] == 0:
    raise ValueError(f"Aucun réel pour {periode} : importez le réel avant de calculer les écarts")

print(f"Budget : {nb['budget']} lignes | Réel : {nb['reel']} lignes")

# COMMAND ----------

ecarts = spark.sql(
    f"""
    WITH b AS (SELECT * FROM {cs}.budget WHERE mois = :periode),
         r AS (SELECT * FROM {cs}.reel   WHERE mois = :periode)
    SELECT
      COALESCE(b.entite,  r.entite)  AS entite,
      COALESCE(b.compte,  r.compte)  AS compte,
      COALESCE(b.libelle, r.libelle) AS libelle,
      :periode                        AS mois,
      b.montant                       AS budget,
      r.montant                       AS reel,
      CAST(COALESCE(r.montant, 0) - COALESCE(b.montant, 0) AS DECIMAL(18,2)) AS ecart,
      CAST(
        CASE WHEN b.montant IS NULL OR b.montant = 0 THEN NULL
             ELSE (COALESCE(r.montant, 0) - b.montant) / b.montant * 100
        END AS DECIMAL(9,2)
      )                               AS ecart_pct,
      current_timestamp()             AS date_calcul
    FROM b FULL OUTER JOIN r
      ON b.entite = r.entite AND b.compte = r.compte
    """,
    args={"periode": periode},
)

(
    ecarts.write.format("delta")
    .mode("overwrite")
    .option("replaceWhere", f"mois = '{periode}'")
    .saveAsTable(f"{cs}.ecarts")
)

# COMMAND ----------

SEUIL_PCT = 10
resume = spark.sql(
    f"""
    SELECT COUNT(*) AS lignes,
           SUM(ecart) AS ecart_total,
           COUNT_IF(ABS(ecart_pct) > {SEUIL_PCT}) AS significatifs
    FROM {cs}.ecarts WHERE mois = :periode
    """,
    args={"periode": periode},
).first()

dbutils.jobs.taskValues.set(key="ecarts_significatifs", value=int(resume["significatifs"]))

message = (
    f"{resume['lignes']} écarts calculés pour {periode} : "
    f"écart total {resume['ecart_total']:,.2f}, {resume['significatifs']} au-delà de ±{SEUIL_PCT} %"
)
print("✅ " + message)
dbutils.notebook.exit(message)
