"""Tests des contrôles, exécutables en local : pytest tests/"""

import sys
from pathlib import Path

import pandas as pd
import pytest

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE / "src" / "traitements"))

from controles import controler, periode_valide  # noqa: E402

ACTIVES = {"CASA", "RABAT", "TANGER", "MARRAKECH", "FES"}
INACTIVES = {"AGADIR"}


def lire(nom: str) -> pd.DataFrame:
    return pd.read_excel(RACINE / "donnees_test" / nom, dtype={"compte": str, "mois": str})


def test_budget_valide():
    erreurs, df = controler(lire("budget_2026_10.xlsx"), "2026-10", ACTIVES, INACTIVES)
    assert erreurs == []
    assert len(df) == 24


def test_reel_valide():
    erreurs, _ = controler(lire("reel_2026_10.xlsx"), "2026-10", ACTIVES, INACTIVES)
    assert erreurs == []


def test_fichier_errone_detecte_toutes_les_anomalies():
    erreurs, df = controler(lire("reel_2026_10_errone.xlsx"), "2026-10", ACTIVES, INACTIVES)
    texte = "\n".join(erreurs)
    assert df is None  # rien ne doit être chargé
    assert "AGADIR est inactive" in texte
    assert "OUJDA est inconnue" in texte
    assert "ne concernent pas la période 2026-10" in texte
    assert "« beaucoup » n'est pas un nombre" in texte
    assert "doublon" in texte


def test_mauvaise_periode_un_seul_message():
    erreurs, _ = controler(lire("budget_2026_10.xlsx"), "2026-11", ACTIVES, INACTIVES)
    assert len(erreurs) == 1
    assert "24 ligne(s)" in erreurs[0]


def test_colonnes_manquantes():
    erreurs, df = controler(pd.DataFrame({"entite": ["CASA"]}), "2026-10", ACTIVES, INACTIVES)
    assert df is None
    assert "Colonne(s) manquante(s)" in erreurs[0]


def test_montant_format_francais():
    df = pd.DataFrame([{"entite": "casa", "compte": "6061", "libelle": "x", "mois": "2026-10", "montant": "1 234,50"}])
    erreurs, propre = controler(df, "2026-10", ACTIVES, INACTIVES)
    assert erreurs == []
    assert propre.loc[0, "montant"] == pytest.approx(1234.5)
    assert propre.loc[0, "entite"] == "CASA"  # normalisé en majuscules


@pytest.mark.parametrize("p,ok", [("2026-10", True), ("2026-13", False), ("26-10", False), ("", False)])
def test_periode_valide(p, ok):
    assert periode_valide(p) is ok
