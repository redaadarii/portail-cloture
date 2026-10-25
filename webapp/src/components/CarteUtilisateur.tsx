import { LIBELLES_ROLES, type Utilisateur } from "@/lib/roles";

const SOURCES: Record<Utilisateur["source"], string> = {
  "token-utilisateur": "token de l'utilisateur (autorisation utilisateur)",
  application: "recherche par le service principal de l'application",
  "dev-local": "simulation locale (.env.local)",
};

/** Bandeau « connecté en tant que », avec le détail utile pour comprendre son rôle. */
export function CarteUtilisateur({ utilisateur }: { utilisateur: Utilisateur }) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Connecté en tant que <strong>{utilisateur.nom}</strong>
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            utilisateur.role ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-700"
          }`}
        >
          {utilisateur.role ? LIBELLES_ROLES[utilisateur.role] : "Aucun rôle"}
        </span>
      </div>
      <details className="mt-2 text-slate-600">
        <summary className="cursor-pointer select-none">Pourquoi ce rôle ?</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-slate-500">E-mail</dt>
          <dd>{utilisateur.email}</dd>
          <dt className="text-slate-500">Groupes</dt>
          <dd>{utilisateur.groupes.length ? utilisateur.groupes.join(", ") : "aucun"}</dd>
          <dt className="text-slate-500">Source</dt>
          <dd>{SOURCES[utilisateur.source]}</dd>
        </dl>
      </details>
    </div>
  );
}
