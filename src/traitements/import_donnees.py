# Databricks notebook source
# MAGIC %md
# MAGIC # Import générique : budget ou réel
# MAGIC
# MAGIC **Un seul notebook pour deux types de données** : le paramètre `type_donnees` choisit la table cible.
# MAGIC Les règles de contrôle sont dans `controles.py` (testées en local avec pytest) ;
# MAGIC ce notebook ne fait qu'orchestrer : lire → contrôler → écrire.

# COMMAND ----------

# MAGIC %pip install openpyxl --quiet

# COMMAND ----------

dbutils.widgets.text("catalog", "workspace")
dbutils.widgets.text("schema", "cloture_dev")
dbutils.widgets.dropdown("type_donnees", "budget", ["budget", "reel"])
dbutils.widgets.text("periode", "2026-10")
dbutils.widgets.text("fichier", "/Volumes/workspace/cloture_dev/fichiers/budget_2026_10.xlsx")
dbutils.widgets.text("demande_id", "")  # renseigné par le portail ; vide en lancement manuel

cs = f"{dbutils.widgets.get('catalog')}.{dbutils.widgets.get('schema')}"
type_donnees = dbutils.widgets.get("type_donnees")
periode = dbutils.widgets.get("periode")
fichier = dbutils.widgets.get("fichier")
demande_id = dbutils.widgets.get("demande_id") or None

print(f"Import {type_donnees} | période {periode} | {fichier} | demande {demande_id or '(manuel)'}")

# COMMAND ----------

from controles import controler, periode_valide  # module voisin de ce notebook

# Contrôles des paramètres : on n'écrit JAMAIS un nom de table construit avec une valeur non vérifiée.
if type_donnees not in ("budget", "reel"):
    raise ValueError(f"type_donnees invalide : « {type_donnees} » (attendu : budget ou reel)")
if not periode_valide(periode):
    raise ValueError(f"Période invalide : « {periode} » (format AAAA-MM attendu)")

# COMMAND ----------

import pandas as pd

# Le référentiel est lu dans la table : une entité ajoutée au référentiel est acceptée immédiatement.
ref = spark.table(f"{cs}.ref_entites").toPandas()
entites_actives = set(ref.loc[ref["actif"], "code"])
entites_inactives = set(ref.loc[~ref["actif"], "code"])

try:
    brut = pd.read_excel(fichier, sheet_name=0, dtype={"compte": str, "mois": str})
except FileNotFoundError:
    raise ValueError(f"Fichier introuvable : {fichier}")

erreurs, propre = controler(brut, periode, entites_actives, entites_inactives)

if erreurs:
    # Le message de l'exception remonte dans le statut du run : le portail l'affichera tel quel.
    raise ValueError(f"{len(erreurs)} anomalie(s) dans le fichier :\n" + "\n".join(erreurs))

print(f"✅ Fichier conforme : {len(propre)} lignes")

# COMMAND ----------

from pyspark.sql import functions as F

donnees = (
    spark.createDataFrame(propre)
    .select(
        "entite",
        "compte",
        "libelle",
        "mois",
        F.col("montant").cast("decimal(18,2)").alias("montant"),
        F.lit(demande_id).cast("string").alias("demande_id"),
        F.current_timestamp().alias("date_chargement"),
    )
)

# Idempotent : réimporter une période REMPLACE ses lignes, sans doublon ni impact sur les autres mois.
(
    donnees.write.format("delta")
    .mode("overwrite")
    .option("replaceWhere", f"mois = '{periode}'")
    .saveAsTable(f"{cs}.{type_donnees}")
)
print(f"✅ {len(propre)} lignes écrites dans {cs}.{type_donnees} pour {periode}")

# COMMAND ----------

# Task values : des informations transmises aux tâches suivantes du job (et lisibles via l'API).
dbutils.jobs.taskValues.set(key="nb_lignes", value=len(propre))
dbutils.jobs.taskValues.set(key="total", value=float(propre["montant"].sum()))

dbutils.notebook.exit(f"{len(propre)} lignes {type_donnees} chargées pour {periode}")
