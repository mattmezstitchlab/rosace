import { resolveThreadCode } from "../data/dmc";
import { generateRosace, normalizeConfig, type RosaceConfig, type RosacePattern } from "./rosace";
import { patternFingerprint } from "./pattern-id";

/**
 * Progression de broderie : elle vit à côté du patron, indexée par son empreinte.
 * Le patron reste immuable. Une progression importée n'est acceptée que si le fichier
 * et le patron régénéré portent exactement la même empreinte.
 */
export const PROGRESS_STORAGE_PREFIX = "aime-rosace-progress-v2:";
/** Anciennes clés locales susceptibles d'exister dans un navigateur ayant connu une version 1. */
export const LEGACY_PROGRESS_STORAGE_PREFIXES = [
  "aime-rosace-progress-v1:",
  "aime-rosace-progress:",
  "rosace-progress-v1:",
] as const;
export const PROJECT_FORMAT = "rosace-project";
export const PROJECT_VERSION = 2;
export const LEGACY_PROJECT_VERSION = 1;
export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 8;

export const progressStorageKey = (fingerprint: string) => `${PROGRESS_STORAGE_PREFIX}${fingerprint}`;

export interface Viewport {
  k: number;
  x: number;
  y: number;
}

export interface EmbroideryProgress {
  version: 2;
  fingerprint: string;
  completedRuns: string;
  selectedCode: string | null;
  viewport: Viewport;
  /** Journal des dernières opérations (ajout/retrait) pour restaurer Annuler. */
  journal?: Array<{ index: number; added: boolean }>;
  updatedAt: string;
}

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  fingerprint: string;
  config: RosaceConfig;
  progress: {
    completedRuns: string;
    selectedCode: string | null;
    viewport: Viewport;
    journal: Array<{ index: number; added: boolean }>;
    updatedAt: string;
  };
}

type JournalEntry = { index: number; added: boolean };
type LegacyProgressLike = {
  completed?: unknown;
  completedRuns?: unknown;
  completedIndices?: unknown;
  selectedCode?: unknown;
  viewport?: unknown;
  journal?: unknown;
  updatedAt?: unknown;
};

const finite = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const timestamp = (value: unknown) => {
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const newest = (a: unknown, b: unknown) => (timestamp(a) >= timestamp(b) ? String(a) : String(b));

/** Unique bornage de la vue Broderie, partagé par la sauvegarde locale et l'import de projet. */
export function clampViewport(view: Partial<Viewport> | null | undefined): Viewport {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finite(view?.k, 1)));
  const limit = 900 * k;
  return {
    k,
    x: Math.max(-limit, Math.min(limit, finite(view?.x, 0))),
    y: Math.max(-limit, Math.min(limit, finite(view?.y, 0))),
  };
}

/** Seules les cases réellement brodées du patron peuvent appartenir à une progression. */
function isStitchIndex(pattern: RosacePattern, index: number) {
  return Number.isInteger(index) && index >= 0 && index < pattern.cells.length && pattern.cells[index] >= 0;
}

function sanitizeJournal(pattern: RosacePattern, journal: unknown): JournalEntry[] {
  if (!Array.isArray(journal)) return [];
  return journal
    .filter((entry): entry is JournalEntry =>
      Boolean(entry) && isStitchIndex(pattern, Number((entry as JournalEntry).index)) && typeof (entry as JournalEntry).added === "boolean")
    .map((entry) => ({ index: Number(entry.index), added: entry.added }))
    .slice(-100);
}

function mergeJournals(existing: unknown, incoming: unknown): JournalEntry[] {
  const merged: JournalEntry[] = [];
  const seen = new Set<string>();
  for (const entry of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (!entry || typeof entry !== "object") continue;
    const index = Number((entry as JournalEntry).index);
    const added = (entry as JournalEntry).added;
    if (!Number.isInteger(index) || typeof added !== "boolean") continue;
    const key = `${index}:${added}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ index, added });
  }
  return merged.slice(-100);
}

/** Une progression vide, au format canonique, pour un patron donné. */
export function emptyProgress(pattern: RosacePattern): EmbroideryProgress {
  return {
    version: 2,
    fingerprint: patternFingerprint(pattern),
    completedRuns: "",
    selectedCode: pattern.config.palette[0] ?? null,
    viewport: { k: 1, x: 0, y: 0 },
    journal: [],
    updatedAt: new Date().toISOString(),
  };
}

export function serializeRuns(indices: Iterable<number>): string {
  const sorted = [...new Set(indices)].filter((value) => Number.isInteger(value) && value >= 0).sort((a, b) => a - b);
  const runs: string[] = [];
  let start = -1;
  let previous = -1;
  for (const value of sorted) {
    if (start < 0) {
      start = value;
      previous = value;
    } else if (value === previous + 1) {
      previous = value;
    } else {
      runs.push(start === previous ? `${start}` : `${start}-${previous}`);
      start = value;
      previous = value;
    }
  }
  if (start >= 0) runs.push(start === previous ? `${start}` : `${start}-${previous}`);
  return runs.join(",");
}

export function parseRuns(runs: string): Set<number> {
  const set = new Set<number>();
  if (!runs) return set;
  for (const part of runs.split(",")) {
    const [from, to] = part.split("-").map((value) => Number(value));
    if (!Number.isInteger(from) || from < 0) continue;
    const end = Number.isInteger(to) ? to : from;
    for (let i = from; i <= end && i - from < 100000; i += 1) set.add(i);
  }
  return set;
}

export const stitchIndex = (size: number, x: number, y: number) => y * size + x;

/**
 * Fusion à trois états pour éviter les écrasements silencieux entre onglets.
 * `base` est la progression connue au chargement ; `existing` est l'état actuel du stockage.
 * Les suppressions locales restent des suppressions, les ajouts distants sont conservés.
 */
export function reconcileProgress(
  existing: EmbroideryProgress,
  incoming: EmbroideryProgress,
  base?: EmbroideryProgress | null,
): EmbroideryProgress {
  const baseSet = base ? parseRuns(String(base.completedRuns ?? "")) : new Set<number>();
  const localSet = parseRuns(String(incoming.completedRuns ?? ""));
  const remoteSet = parseRuns(String(existing.completedRuns ?? ""));
  const localDeletions = new Set([...baseSet].filter((index) => !localSet.has(index)));
  const merged = new Set([...remoteSet, ...localSet].filter((index) => !localDeletions.has(index)));
  return {
    ...incoming,
    completedRuns: serializeRuns(merged),
    journal: mergeJournals(existing.journal, incoming.journal),
    updatedAt: newest(existing.updatedAt, incoming.updatedAt),
  };
}

function canonicalSelection(code: unknown, palette: string[]): string | null {
  if (typeof code !== "string") return null;
  const canonical = resolveThreadCode(code) ?? code;
  return palette.includes(canonical) ? canonical : null;
}

/** Migration explicite d'un enregistrement de progression v1 vers le format v2. */
export function migrateLegacyProgressRecord(raw: unknown, pattern: RosacePattern): { progress: EmbroideryProgress; warning?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as LegacyProgressLike;
  let runs = "";
  if (typeof source.completedRuns === "string") runs = source.completedRuns;
  else if (typeof source.completed === "string") runs = source.completed;
  else if (Array.isArray(source.completed)) runs = serializeRuns(source.completed.filter((value): value is number => Number.isInteger(value) && value >= 0));
  else if (Array.isArray(source.completedIndices)) runs = serializeRuns(source.completedIndices.filter((value): value is number => Number.isInteger(value) && value >= 0));
  else return null;

  const parsed = [...parseRuns(runs)];
  const valid = parsed.filter((index) => isStitchIndex(pattern, index));
  const dropped = parsed.length - valid.length;
  const fingerprint = patternFingerprint(pattern);
  return {
    progress: {
      version: 2,
      fingerprint,
      completedRuns: serializeRuns(valid),
      selectedCode: canonicalSelection(source.selectedCode, pattern.config.palette) ?? pattern.config.palette[0] ?? null,
      viewport: clampViewport(source.viewport as Partial<Viewport> | null | undefined),
      journal: sanitizeJournal(pattern, source.journal),
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
    },
    warning: dropped > 0 ? `${dropped} case(s) v1 ignorée(s) : elles n'appartiennent pas au patron.` : undefined,
  };
}

export function loadProgress(fingerprint: string): EmbroideryProgress | null {
  try {
    const raw = window.localStorage.getItem(progressStorageKey(fingerprint));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EmbroideryProgress>;
    if (parsed?.version !== 2 || parsed.fingerprint !== fingerprint) return null;
    return {
      version: 2,
      fingerprint,
      completedRuns: String(parsed.completedRuns ?? ""),
      selectedCode: typeof parsed.selectedCode === "string" ? parsed.selectedCode : null,
      viewport: clampViewport(parsed.viewport),
      journal: Array.isArray(parsed.journal) ? parsed.journal : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Recherche et migration automatique d'une ancienne clé locale v1, sans supprimer la source. */
function loadLegacyProgress(pattern: RosacePattern): EmbroideryProgress | null {
  const fingerprint = patternFingerprint(pattern);
  for (const prefix of LEGACY_PROGRESS_STORAGE_PREFIXES) {
    try {
      const raw = window.localStorage.getItem(`${prefix}${fingerprint}`);
      if (!raw) continue;
      const migrated = migrateLegacyProgressRecord(JSON.parse(raw), pattern);
      if (!migrated) continue;
      try { window.localStorage.setItem(progressStorageKey(fingerprint), JSON.stringify(migrated.progress)); } catch { /* quota : la session reste utilisable */ }
      return migrated.progress;
    } catch { /* clé illisible : on essaie la suivante */ }
  }
  return null;
}

/** Chargement validé : progression v2 nettoyée, sinon ancienne progression v1 migrée. */
export function loadPatternProgress(pattern: RosacePattern): EmbroideryProgress | null {
  const fingerprint = patternFingerprint(pattern);
  const saved = loadProgress(fingerprint);
  const source = saved ?? loadLegacyProgress(pattern);
  if (!source) return null;
  const completed = [...parseRuns(String(source.completedRuns ?? ""))].filter((index) => isStitchIndex(pattern, index));
  return {
    version: 2,
    fingerprint,
    completedRuns: serializeRuns(completed),
    selectedCode: canonicalSelection(source.selectedCode, pattern.config.palette) ?? pattern.config.palette[0] ?? null,
    viewport: clampViewport(source.viewport),
    journal: sanitizeJournal(pattern, source.journal),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
  };
}

/**
 * Écriture canonique. Si un autre onglet a écrit depuis le chargement (`base`),
 * les deux progressions sont fusionnées au lieu d'être écrasées silencieusement.
 * Retourne l'enregistrement réellement stocké, pour mettre à jour la base locale.
 */
export function saveProgress(progress: EmbroideryProgress, base?: EmbroideryProgress | null): EmbroideryProgress {
  const key = progressStorageKey(progress.fingerprint);
  const existing = loadProgress(progress.fingerprint);
  const record = existing && (!base || existing.updatedAt !== base.updatedAt)
    ? reconcileProgress(existing, progress, base)
    : progress;
  window.localStorage.setItem(key, JSON.stringify(record));
  return record;
}

export function deleteProgress(fingerprint: string) {
  window.localStorage.removeItem(progressStorageKey(fingerprint));
}

/** Unique constructeur de fichier projet : recette exacte + progression nettoyée contre la matrice. */
export function buildProject(pattern: RosacePattern, progress: EmbroideryProgress): ProjectFile {
  const fingerprint = patternFingerprint(pattern);
  if (progress.fingerprint !== fingerprint) throw new Error("La progression ne correspond pas au patron.");
  const completed = [...parseRuns(String(progress.completedRuns ?? ""))].filter((index) => isStitchIndex(pattern, index));
  const selectedCode = canonicalSelection(progress.selectedCode, pattern.config.palette);
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    fingerprint,
    config: { ...pattern.config, palette: [...pattern.config.palette] },
    progress: {
      completedRuns: serializeRuns(completed),
      selectedCode,
      viewport: clampViewport(progress.viewport),
      journal: sanitizeJournal(pattern, progress.journal),
      updatedAt: typeof progress.updatedAt === "string" ? progress.updatedAt : new Date().toISOString(),
    },
  };
}

export type ImportResult =
  | { ok: true; config: RosaceConfig; progress: EmbroideryProgress; migratedFrom?: 1; warning?: string }
  | { ok: false; error: string };

/** Migration d'un projet version 1 : recette régénérée, ancienne empreinte recalculée. */
function migrateProjectV1(raw: unknown): ImportResult {
  const project = raw as Partial<ProjectFile> & { progress?: unknown; config?: unknown; fingerprint?: unknown };
  if (!project || typeof project !== "object") {
    return { ok: false, error: "Projet ROSACE version 1 détecté, mais le fichier est illisible : migration impossible." };
  }
  if (project.format && project.format !== PROJECT_FORMAT) {
    return { ok: false, error: "Projet version 1 détecté, mais son format est inconnu : migration impossible." };
  }
  if (!project.config || typeof project.config !== "object") {
    return { ok: false, error: "Projet ROSACE version 1 détecté, mais la recette est absente : migration impossible." };
  }
  try {
    const config = normalizeConfig(project.config as RosaceConfig);
    const regenerated = generateRosace(config);
    const fingerprint = patternFingerprint(regenerated);
    const migrated = migrateLegacyProgressRecord(project.progress ?? project, regenerated);
    if (!migrated) {
      return { ok: false, error: "Projet ROSACE version 1 détecté, mais la progression est dans un format inconnu : migration impossible." };
    }
    const notes = ["Projet version 1 migré au format version 2."];
    if (typeof project.fingerprint === "string" && project.fingerprint !== fingerprint) notes.push("L'ancienne empreinte a été recalculée à partir de la recette.");
    if (migrated.warning) notes.push(migrated.warning);
    return { ok: true, config, progress: migrated.progress, migratedFrom: 1, warning: notes.join(" ") };
  } catch {
    return { ok: false, error: "Projet ROSACE version 1 détecté, mais la recette est invalide : migration impossible." };
  }
}

/** Unique validateur de projet : v2 strict, v1 migré explicitement, sinon message clair. */
export function importProject(raw: unknown): ImportResult {
  try {
    const probe = raw as { version?: unknown; format?: unknown } | null;
    if (!probe || typeof probe !== "object") {
      return { ok: false, error: "Le fichier n'est pas un projet ROSACE lisible." };
    }
    if (probe.version === LEGACY_PROJECT_VERSION) return migrateProjectV1(raw);
    const project = raw as Partial<ProjectFile>;
    if (project.format !== PROJECT_FORMAT || project.version !== PROJECT_VERSION) {
      return { ok: false, error: "Ce fichier n'est pas un projet ROSACE version 2. Les projets version 1 sont migrés automatiquement." };
    }
    if (!project.config || typeof project.fingerprint !== "string" || !project.progress) {
      return { ok: false, error: "Le fichier projet est incomplet." };
    }
    const config = normalizeConfig(project.config);
    const regenerated = generateRosace(config);
    const fingerprint = patternFingerprint(regenerated);
    if (fingerprint !== project.fingerprint) {
      return { ok: false, error: "L'empreinte du patron ne correspond pas à sa recette : import refusé." };
    }
    const completed = [...parseRuns(String(project.progress.completedRuns ?? ""))];
    if (completed.some((index) => !isStitchIndex(regenerated, index))) {
      return { ok: false, error: "La progression contient des cases vides ou hors de la grille : import refusé." };
    }
    const selectedCode = canonicalSelection(project.progress.selectedCode, config.palette);
    return {
      ok: true,
      config,
      progress: {
        version: 2,
        fingerprint,
        completedRuns: serializeRuns(completed),
        selectedCode,
        viewport: clampViewport(project.progress.viewport),
        journal: sanitizeJournal(regenerated, project.progress.journal),
        updatedAt: typeof project.progress.updatedAt === "string" ? project.progress.updatedAt : new Date().toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "Fichier illisible ou JSON invalide." };
  }
}

export function remainingByColor(pattern: RosacePattern, completed: Set<number>) {
  const remaining = pattern.config.palette.map((code) => ({ code, total: 0, remaining: 0 }));
  for (const stitch of pattern.stitches) {
    const line = remaining[stitch.color];
    if (!line) continue;
    line.total += 1;
    if (!completed.has(stitchIndex(pattern.size, stitch.x, stitch.y))) line.remaining += 1;
  }
  return remaining;
}

export function progressPercent(pattern: RosacePattern, completed: Set<number>) {
  const done = pattern.stitches.reduce((total, stitch) => total + (completed.has(stitchIndex(pattern.size, stitch.x, stitch.y)) ? 1 : 0), 0);
  return { done, total: pattern.stitches.length, percent: pattern.stitches.length ? Math.round((done / pattern.stitches.length) * 1000) / 10 : 0 };
}
