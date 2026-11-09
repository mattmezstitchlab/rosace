/**
 * Session live « Broder ensemble » (version locale) : les brodeuses d'un même navigateur
 * s'échangent leur curseur et leurs croix par BroadcastChannel.
 *
 * Tout message reçu est non fiable : il est validé ici et jamais utilisé tel quel
 * (type, identifiant, nom, plage des coordonnées, longueur des plages de croix).
 */
import { parseRuns } from "./progress";

/** Au-delà, une brodeuse qui n'a rien envoyé est considérée comme partie. */
export const LIVE_STALE_MS = 12_000;
export const LIVE_NAME_MAX = 24;
export const LIVE_MAX_PEERS = 12;
/** Couleurs des curseurs : toutes portent une étiquette blanche (contraste ≥ 5:1) et se distinguent du vert-bleu du calque d'amie. */
export const LIVE_COLORS = ["#be123c", "#1d4ed8", "#c2410c", "#15803d", "#0b7285", "#475569"];

export interface LiveGrid { width: number; height: number }
export type LiveCursor = { x: number; y: number };

/** Message envoyé : la couleur n'y figure pas, chaque récepteur attribue la sienne. */
export interface LiveOutgoing {
  kind: "state" | "leave";
  sender: string;
  name: string;
  cursor: LiveCursor | null;
  completedRuns: string;
}

export type LiveIncoming =
  | { kind: "leave"; sender: string }
  | { kind: "state"; sender: string; name: string; cursor: LiveCursor | null; completed: Set<number> };

const SENDER_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
// Contrôles, séparateurs invisibles et surcharges de sens d'écriture : inutiles dans un prénom, utiles pour usurper.
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

/** Identifiant propre à cette page : deux onglets du même navigateur ne doivent jamais partager le leur. */
export function newClientId(): string {
  try {
    const id = globalThis.crypto?.randomUUID?.();
    if (id) return id;
  } catch { /* contexte non sécurisé : repli ci-dessous */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12).padEnd(10, "0")}`;
}

/** Code de salle : minuscules sans accent, lettres, chiffres et tirets seulement. */
export function sanitizeRoom(value: string): string {
  const cleaned = value
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
    .slice(0, 32)
    .replace(/^-+|-+$/g, "");
  return cleaned || "atelier";
}

export function sanitizeName(value: unknown, fallback = "Brodeuse"): string {
  if (typeof value !== "string") return fallback;
  // Tabulations et retours à la ligne deviennent des espaces avant que les autres contrôles ne soient retirés.
  const flat = value.replace(/[\t\n\r\u2028\u2029]/g, " ").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  const cleaned = [...flat].slice(0, LIVE_NAME_MAX).join("").trim();
  return cleaned || fallback;
}

/**
 * Valide un message de la salle. Renvoie `null` pour tout ce qui n'est pas exactement attendu,
 * y compris les messages que cette page s'est envoyés à elle-même.
 */
export function parseLiveMessage(data: unknown, self: string, grid: LiveGrid): LiveIncoming | null {
  if (!data || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  const sender = message.sender;
  // Les noms hérités d'Object (constructor, toString…) respectent le format mais fausseraient les recherches dans la table des brodeuses.
  if (typeof sender !== "string" || !SENDER_PATTERN.test(sender) || sender in Object.prototype || sender === self) return null;
  if (message.kind === "leave") return { kind: "leave", sender };
  if (message.kind !== "state") return null;

  const cells = Math.max(0, grid.width * grid.height);
  const runs = typeof message.completedRuns === "string" && message.completedRuns.length <= cells * 8 + 64 ? message.completedRuns : "";
  let cursor: LiveCursor | null = null;
  const rawCursor = message.cursor;
  if (rawCursor && typeof rawCursor === "object") {
    const { x, y } = rawCursor as { x?: unknown; y?: unknown };
    if (typeof x === "number" && typeof y === "number" && Number.isInteger(x) && Number.isInteger(y)
      && x >= 0 && y >= 0 && x < grid.width && y < grid.height) cursor = { x, y };
  }
  return { kind: "state", sender, name: sanitizeName(message.name), cursor, completed: parseRuns(runs, cells) };
}

/** Première couleur libre ; au-delà de la palette, une couleur stable déduite de l'identifiant. */
export function pickPeerColor(taken: readonly string[], id: string): string {
  const free = LIVE_COLORS.find((color) => !taken.includes(color));
  if (free) return free;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return LIVE_COLORS[Math.abs(hash) % LIVE_COLORS.length];
}

/** Noms affichés : deux brodeuses qui portent le même nom (ou le vôtre) reçoivent un suffixe court pour rester distinguables. */
export function displayNames(peers: ReadonlyArray<{ id: string; name: string }>, ownName: string): Record<string, string> {
  const counts = new Map<string, number>();
  const key = (name: string) => name.toLocaleLowerCase("fr");
  counts.set(key(ownName), 1);
  for (const peer of peers) counts.set(key(peer.name), (counts.get(key(peer.name)) ?? 0) + 1);
  const labels: Record<string, string> = {};
  for (const peer of peers) labels[peer.id] = (counts.get(key(peer.name)) ?? 0) > 1 ? `${peer.name} · ${peer.id.slice(0, 3)}` : peer.name;
  return labels;
}
