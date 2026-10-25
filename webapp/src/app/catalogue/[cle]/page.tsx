import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { FormulaireTraitement } from "@/components/catalogue/FormulaireTraitement";
import { TRAITEMENTS, trouverTraitement } from "@/lib/catalogue/traitements";
import { getEntites } from "@/lib/donnees";
import { getUtilisateur } from "@/lib/identite";
import { peut } from "@/lib/roles";

// Les traitements sont connus au build : une page est pré-générée pour chacun.
export function generateStaticParams() {
  return TRAITEMENTS.map((t) => ({ cle: t.cle }));
}

export default function PageTraitement({ params }: PageProps<"/catalogue/[cle]">) {
  // Avec le Partial Prefetching, params se lit DANS le <Suspense> : l'enveloppe de la page
  // (lien de retour) s'affiche instantanément, le contenu arrive ensuite.
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/catalogue" className="text-sm text-blue-700 hover:underline">
        ← Catalogue
      </Link>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Chargement…</p>}>
        <Contenu params={params} />
      </Suspense>
    </main>
  );
}

function moisPrecedent(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

async function Contenu({ params }: { params: PageProps<"/catalogue/[cle]">["params"] }) {
  const { cle } = await params;
  const traitement = trouverTraitement(cle);
  if (!traitement) notFound(); // affiche la page « introuvable » (statut 200 : limite du streaming)

  const utilisateur = await getUtilisateur(); // appelle connection() : on est bien au moment de la requête
  if (!utilisateur || !peut(utilisateur.role, "consulter")) {
    return <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">Accès refusé.</p>;
  }

  const entites = await chargerEntites();
  if (!entites) {
    return (
      <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Référentiel indisponible pour le moment.
      </p>
    );
  }

  const lectureSeule = !peut(utilisateur.role, "soumettre_demande");
  return (
    <>
      <span className="mt-4 block text-xs font-medium uppercase tracking-wide text-blue-700">{traitement.categorie}</span>
      <h1 className="text-2xl font-semibold">{traitement.titre}</h1>
      <p className="mt-1 text-slate-600">{traitement.description}</p>
      {lectureSeule && (
        <p className="mt-4 rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Lecture seule : votre rôle ne permet pas de soumettre ce traitement.
        </p>
      )}
      <div className="mt-6">
        <FormulaireTraitement
          cle={traitement.cle}
          ctx={{ entites: entites.filter((e) => e.actif).map(({ code, nom }) => ({ code, nom })) }}
          defauts={{ periode: moisPrecedent() }}
          lectureSeule={lectureSeule}
        />
      </div>
    </>
  );
}

async function chargerEntites() {
  try {
    return await getEntites();
  } catch (e) {
    unstable_rethrow(e);
    console.error("[catalogue] référentiel", e);
    return null;
  }
}
