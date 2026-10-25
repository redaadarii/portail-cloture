import { NextResponse } from "next/server";
import { recapitulatif, valider } from "@/lib/catalogue/schema";
import { controlerDonneesFinancieres, type ResumeFichier } from "@/lib/catalogue/excel";
import { trouverTraitement } from "@/lib/catalogue/traitements";
import { getEntites } from "@/lib/donnees";
import { erreurServeur, exiger } from "@/lib/http";

/**
 * POST /api/catalogue/:cle/controle
 * Contrôle complet d'une demande SANS rien lancer : paramètres (Zod généré) puis contenu du fichier.
 * Renvoie le récapitulatif et les paramètres qui seront transmis au job.
 * La phase 5 ajoutera l'enregistrement de la demande et son workflow de validation.
 */
export async function POST(request: Request, { params }: { params: Promise<{ cle: string }> }) {
  const acces = await exiger("soumettre_demande");
  if (!acces.ok) return acces.reponse;

  const traitement = trouverTraitement((await params).cle);
  if (!traitement) {
    return NextResponse.json({ erreurs: [{ message: "Traitement inconnu" }] }, { status: 404 });
  }

  let entites;
  try {
    entites = await getEntites(); // le référentiel fait foi : lu à chaque contrôle, jamais en dur
  } catch (e) {
    console.error("[catalogue] lecture du référentiel", e);
    return erreurServeur("Référentiel indisponible, réessayez dans un instant");
  }
  const ctx = { entites: entites.filter((e) => e.actif) };

  // 1. Paramètres : EXACTEMENT le même schéma que dans le navigateur
  const resultat = valider(traitement, ctx, await request.formData());
  if (!resultat.ok) return NextResponse.json({ erreurs: resultat.erreurs }, { status: 400 });
  const { valeurs } = resultat;

  // 2. Contenu des fichiers (seulement si la configuration le demande)
  let resumeFichier: ResumeFichier | undefined;
  for (const champ of traitement.champs) {
    const fichier = valeurs[champ.nom];
    if (champ.type === "fichier" && champ.contenu === "donnees_financieres" && fichier instanceof File) {
      const { erreurs, resume } = await controlerDonneesFinancieres(
        await fichier.arrayBuffer(),
        String(valeurs.periode),
        entites, // toutes les entités, pour distinguer « inactive » de « inconnue »
      );
      if (erreurs.length) return NextResponse.json({ erreurs }, { status: 422 });
      resumeFichier = resume;
    }
  }

  return NextResponse.json({
    traitement: traitement.titre,
    recapitulatif: recapitulatif(traitement, ctx, valeurs),
    fichier: resumeFichier,
    job: {
      cle: traitement.job.cle,
      parametres: traitement.job.parametres(valeurs, "(chemin attribué lors de la soumission)"),
    },
  });
}
