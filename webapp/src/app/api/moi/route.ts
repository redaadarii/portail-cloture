import { NextResponse } from "next/server";
import { getUtilisateur } from "@/lib/identite";

/** GET /api/moi → identité, groupes et rôle de la personne connectée (utile pour déboguer). */
export async function GET() {
  const utilisateur = await getUtilisateur();
  if (!utilisateur) {
    return NextResponse.json({ erreurs: [{ message: "Utilisateur non identifié" }] }, { status: 401 });
  }
  return NextResponse.json(utilisateur);
}
