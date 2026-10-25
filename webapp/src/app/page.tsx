import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { CarteUtilisateur } from "@/components/CarteUtilisateur";
import { Indicateurs } from "@/components/Indicateurs";
import { ListeEntites } from "@/components/ListeEntites";
import { SelecteurPeriode } from "@/components/SelecteurPeriode";
import { TableEcarts } from "@/components/TableEcarts";
import { getEntites, getPeriodes, getPrincipauxEcarts, getSynthese } from "@/lib/donnees";
import { libellePeriode } from "@/lib/format";
import { getUtilisateur } from "@/lib/identite";
import { peut } from "@/lib/roles";

/**
 * Tableau de bord. Le titre est statique (affiché tout de suite) ; tout ce qui dépend
 * de l'utilisateur ou des données arrive en streaming derrière <Suspense>.
 */
export default function TableauDeBord({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      <p className="mt-1 text-slate-600">Budget, réel et écarts de la clôture mensuelle.</p>
      <div className="mt-6">
        <Suspense fallback={<Squelette />}>
          <Contenu searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Contenu({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const utilisateur = await getUtilisateur();
  if (!utilisateur) {
    return <Message titre="Utilisateur non identifié">Ouvrez l&apos;application depuis Databricks.</Message>;
  }
  if (!peut(utilisateur.role, "consulter")) {
    return (
      <>
        <CarteUtilisateur utilisateur={utilisateur} />
        <Message titre="Accès refusé">
          Vous n&apos;appartenez à aucun groupe du portail. Demandez à être ajouté au groupe correspondant à votre rôle.
        </Message>
      </>
    );
  }

  const donnees = await charger(searchParams);

  if (donnees.etat === "erreur") {
    return (
      <Message titre="Données indisponibles">
        Impossible de lire les données pour le moment. Si le problème persiste, contactez l&apos;administrateur.
      </Message>
    );
  }
  if (donnees.etat === "vide") {
    return (
      <>
        <CarteUtilisateur utilisateur={utilisateur} />
        <Message titre="Aucune donnée">Aucun écart n&apos;a encore été calculé. Importez un budget puis un réel.</Message>
      </>
    );
  }

  const { periode, periodes, entites, synthese, ecarts } = donnees;
  return (
    <div className="space-y-6">
      <CarteUtilisateur utilisateur={utilisateur} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold capitalize">{libellePeriode(periode)}</h2>
        <SelecteurPeriode periodes={periodes} actuelle={periode} />
      </div>

      <Indicateurs s={synthese} />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section>
          <h3 className="mb-2 font-medium">Principaux écarts</h3>
          <TableEcarts lignes={ecarts} />
        </section>
        <section>
          <h3 className="mb-2 font-medium">Entités du référentiel</h3>
          <ListeEntites entites={entites} />
        </section>
      </div>
    </div>
  );
}

/**
 * Chargement des données, séparé de l'affichage : on gère les erreurs ici,
 * et le composant ne fait qu'afficher le résultat (bonne pratique React).
 */
async function charger(searchParams: PageProps<"/">["searchParams"]) {
  try {
    // Requêtes indépendantes : lancées EN PARALLÈLE, pas l'une après l'autre.
    const [params, periodes, entites] = await Promise.all([searchParams, getPeriodes(), getEntites()]);

    // On n'accepte que les périodes qui existent : une valeur bricolée dans l'URL est ignorée.
    const demandee = typeof params.periode === "string" ? params.periode : undefined;
    const periode = demandee && periodes.includes(demandee) ? demandee : periodes[0];
    if (!periode) return { etat: "vide" as const };

    const [synthese, ecarts] = await Promise.all([getSynthese(periode), getPrincipauxEcarts(periode, 10)]);
    return { etat: "ok" as const, periode, periodes, entites, synthese, ecarts };
  } catch (e) {
    // Next.js utilise des erreurs internes pour piloter le rendu : on ne doit pas les avaler.
    unstable_rethrow(e);
    console.error("[tableau-de-bord]", e); // le détail technique part dans les logs de l'app
    return { etat: "erreur" as const };
  }
}

function Squelette() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-14 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}

function Message({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <h2 className="font-semibold">{titre}</h2>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
