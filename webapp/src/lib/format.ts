/** Mise en forme des nombres à la française (utilisable côté serveur et navigateur). */

const montant = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const pourcent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, signDisplay: "exceptZero" });

export const formatMontant = (n: number | null) => (n === null ? "—" : montant.format(n));
export const formatCompact = (n: number | null) => (n === null ? "—" : compact.format(n));
export const formatPourcent = (n: number | null) => (n === null ? "—" : `${pourcent.format(n)} %`);

/** « 2026-10 » → « octobre 2026 » */
export function libellePeriode(periode: string): string {
  const [annee, mois] = periode.split("-").map(Number);
  if (!annee || !mois) return periode;
  return new Date(Date.UTC(annee, mois - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
