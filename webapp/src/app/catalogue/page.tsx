import Link from "next/link";
import { Suspense } from "react";
import { TRAITEMENTS } from "@/lib/catalogue/traitements";
import { getUtilisateur } from "@/lib/identite";
import { peut } from "@/lib/roles";

const LIBELLES_TYPES: Record<string, string> = {
  periode: "période",
  date: "date",
  fichier: "fichier",
  nombre: "nombre",
  booleen: "option",
  texte: "texte",
  liste: "liste",
  liste_multiple: "liste",
};

export default function Catalogue() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Catalogue des traitements</h1>
      <p className="mt-1 text-slate-600">Choisissez un traitement, renseignez ses paramètres, contrôlez votre demande.</p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Vérification de vos droits…</p>}>
        <Liste />
      </Suspense>
    </main>
  );
}

async function Liste() {
  const utilisateur = await getUtilisateur();
  if (!utilisateur || !peut(utilisateur.role, "consulter")) {
    return <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">Accès refusé.</p>;
  }

  return (
    <>
      {!peut(utilisateur.role, "soumettre_demande") && (
        <p className="mt-6 rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Votre rôle permet de consulter le catalogue, pas de soumettre des demandes.
        </p>
      )}
      <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TRAITEMENTS.map((t) => (
          <li key={t.cle}>
            <Link
              href={`/catalogue/${t.cle}`}
              className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-blue-700">{t.categorie}</span>
              <span className="mt-1 font-semibold">{t.titre}</span>
              <span className="mt-2 flex-1 text-sm text-slate-600">{t.description}</span>
              <span className="mt-4 flex flex-wrap gap-1.5">
                {t.champs.map((c) => (
                  <span key={c.nom} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {c.libelle.toLowerCase()} · {LIBELLES_TYPES[c.type]}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
