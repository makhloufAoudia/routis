/** Référentiels métier partagés par tout le site. */

export const SERVICES: Record<string, string> = {
  fret: "Transport de marchandises",
  pax: "Transport de personnes",
};

export const EQUIPEMENTS: Record<string, string> = {
  hayon: "Hayon élévateur",
  frigo: "Température dirigée",
  adr: "Matières dangereuses (ADR)",
  plateau: "Plateau / bâché",
  grue: "Grue auxiliaire",
  demenag: "Déménagement",
};

export const COUVERTURES: Record<string, string> = {
  locale: "Régionale",
  nationale: "Nationale",
  maghreb: "Maghreb",
  europe: "Europe",
  mondiale: "Mondiale",
};

export const CATEGORIES: Record<string, { nom: string; service: "fret" | "pax"; detail: string }> = {
  f3:  { nom: "Fourgon 3 m³",          service: "fret", detail: "Jusqu'à 800 kg" },
  f12: { nom: "Fourgon 12 m³",         service: "fret", detail: "Jusqu'à 1,2 t" },
  c20: { nom: "Camion 20 m³ + hayon",  service: "fret", detail: "Jusqu'à 3,5 t" },
  p19: { nom: "Porteur 19 t",          service: "fret", detail: "Jusqu'à 10 t" },
  sem: { nom: "Semi-remorque",         service: "fret", detail: "33 palettes" },
  ber: { nom: "Berline",               service: "pax",  detail: "4 passagers" },
  van: { nom: "Van",                   service: "pax",  detail: "7 passagers" },
  min: { nom: "Minibus",               service: "pax",  detail: "16 passagers" },
  bus: { nom: "Autocar",               service: "pax",  detail: "50 passagers" },
};

export const DOCUMENTS_REQUIS: Record<string, string> = {
  registre:  "Registre de commerce / immatriculation",
  licence:   "Licence de transport",
  assurance: "Attestation d'assurance",
  technique: "Contrôle technique",
  identite:  "Pièce d'identité du gérant",
};

export const STATUTS_DEMANDE: Record<string, string> = {
  ouverte:  "En attente de devis",
  devis:    "Devis reçus",
  acceptee: "Devis accepté",
  terminee: "Mission terminée",
  annulee:  "Annulée",
};

export const EFFECTIFS = ["", "1-4", "5-9", "10-49", "50-199", "200-499", "500+"];

/** Distance routière approchée entre deux points (haversine + 25 %). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return Math.max(4, Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))) * 1.25));
}

const SANS_DECIMALE = new Set(["DZD", "XOF", "XAF", "JPY", "VND", "IDR", "KRW"]);

export function montant(valeur: number | string, devise = "DZD"): string {
  const n = typeof valeur === "string" ? parseFloat(valeur) : valeur;
  const dec = SANS_DECIMALE.has(devise) ? 0 : 2;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " " + devise;
}

export function dateFr(v: string | Date | null | undefined, avecHeure = false): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "—";
  const j = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const base = `${j}/${m}/${d.getFullYear()}`;
  if (!avecHeure) return base;
  return `${base} à ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

export function noteAffichee(note: number | string, nbMissions = 0): string {
  const n = typeof note === "string" ? parseFloat(note) : note;
  if (!n || n <= 0) return nbMissions > 0 ? "Pas encore noté" : "Nouveau";
  return n.toFixed(1).replace(".", ",") + " / 5";
}

export function initiales(nom: string): string {
  const propre = nom.replace(/^(SARL|EURL|SPA|SNC|ETS|Groupe|Transports|Compagnie)\s+/i, "").trim();
  const mots = propre.split(/[\s&-]+/).filter(Boolean);
  const a = mots[0]?.[0] ?? "X";
  const b = mots[1]?.[0] ?? a;
  return (a + b).toUpperCase();
}

export function extrait(texte: string | null, n = 200): string {
  const t = (texte ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
}

/** Référence lisible d'une demande. */
export function nouvelleReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return "RTS-" + s;
}
