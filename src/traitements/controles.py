"""
Contrôles de conformité des fichiers budget / réel.

Ce module est du Python « pur » (pandas, sans Spark) : on peut donc le TESTER
sur son ordinateur avec pytest, sans Databricks. Le notebook d'import l'importe
et se contente d'orchestrer : lire le fichier, appeler controler(), écrire la table.
"""

from __future__ import annotations

import re

import pandas as pd

COLONNES = ["entite", "compte", "libelle", "mois", "montant"]
MAX_ERREURS = 50
RE_PERIODE = re.compile(r"\d{4}-(0[1-9]|1[0-2])")
RE_COMPTE = re.compile(r"\d{4}")


def periode_valide(periode: str) -> bool:
    return bool(RE_PERIODE.fullmatch(periode or ""))


def _texte(valeur) -> str:
    return "" if pd.isna(valeur) else str(valeur).strip()


def _nombre(valeur):
    """« 1 234,50 » → 1234.5 ; renvoie la valeur telle quelle si ce n'est pas du texte."""
    if isinstance(valeur, str):
        return valeur.replace(" ", "").replace(" ", "").replace(",", ".")
    return valeur


def _lignes(numeros: list[int], max_affiche: int = 10) -> str:
    texte = ", ".join(str(n) for n in numeros[:max_affiche])
    return texte + (f"… (+{len(numeros) - max_affiche})" if len(numeros) > max_affiche else "")


def controler(
    df: pd.DataFrame,
    periode: str,
    entites_actives: set[str],
    entites_inactives: set[str],
) -> tuple[list[str], pd.DataFrame | None]:
    """
    Contrôle un fichier et renvoie (erreurs, données_nettoyées).
    Toutes les erreurs sont collectées, pour que l'utilisateur corrige tout en une fois.
    Si la liste d'erreurs n'est pas vide, les données ne doivent PAS être chargées.
    """
    df = df.rename(columns=lambda c: str(c).strip().lower())

    manquantes = [c for c in COLONNES if c not in df.columns]
    if manquantes:
        return [f"Colonne(s) manquante(s) : {', '.join(manquantes)}"], None

    df = df[COLONNES].dropna(how="all").reset_index(drop=True)
    if df.empty:
        return ["Le fichier ne contient aucune ligne de données"], None

    for col in ["entite", "compte", "libelle", "mois"]:
        df[col] = df[col].map(_texte)
    df["entite"] = df["entite"].str.upper()
    montants = pd.to_numeric(df["montant"].map(_nombre), errors="coerce")

    erreurs: list[str] = []
    mauvais_mois: list[int] = []

    for i, ligne in df.iterrows():
        num = i + 2  # numéro de ligne Excel (ligne 1 = en-têtes)

        entite = ligne["entite"]
        if not entite:
            erreurs.append(f"Ligne {num} : entité vide")
        elif entite in entites_inactives:
            erreurs.append(f"Ligne {num} : l'entité {entite} est inactive")
        elif entite not in entites_actives:
            erreurs.append(f"Ligne {num} : l'entité {entite} est inconnue du référentiel")

        if not RE_COMPTE.fullmatch(ligne["compte"]):
            erreurs.append(f"Ligne {num} : compte « {ligne['compte']} » invalide (4 chiffres attendus)")

        if ligne["mois"] != periode:
            mauvais_mois.append(num)

        montant = montants[i]
        if pd.isna(montant):
            brut = _texte(df.at[i, "montant"]) or "vide"
            erreurs.append(f"Ligne {num} : montant « {brut} » n'est pas un nombre")
        elif montant < 0:
            erreurs.append(f"Ligne {num} : montant négatif ({montant})")

    # Un seul message pour les mois incohérents, plutôt qu'une erreur par ligne
    if mauvais_mois:
        erreurs.insert(
            0,
            f"{len(mauvais_mois)} ligne(s) ne concernent pas la période {periode} : lignes {_lignes(mauvais_mois)}",
        )

    doublons = df[df.duplicated(subset=["entite", "compte"], keep="first")]
    for i, ligne in doublons.iterrows():
        erreurs.append(f"Ligne {i + 2} : doublon entité {ligne['entite']} / compte {ligne['compte']}")

    if len(erreurs) > MAX_ERREURS:
        reste = len(erreurs) - MAX_ERREURS
        erreurs = erreurs[:MAX_ERREURS] + [f"… et {reste} autre(s) anomalie(s)"]

    df["montant"] = montants
    return erreurs, (None if erreurs else df)
