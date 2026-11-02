import { generateRosace, normalizeConfig, type RosaceConfig, type RosacePattern } from "./rosace";
import { patternFingerprint } from "./pattern-id";

/**
 * Progression de broderie : elle vit à côté du patron, indexée par son empreinte.
 * Le patron reste immuable. Une progression importée n'est acceptée que si le fichier
 * et le patron régénéré portent exactement la même empreinte.
 */
export const PROGRESS_STORAGE_PREFIX = "aime-rosace-progress-v2:";
export const PROJECT_FORMAT = "rosace-project";
export const PROJECT_VERSION = 2;

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

export function loadProgress(fingerprint: string): EmbroideryProgress | null {
  try {
    const raw = window.localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}${fingerprint}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmbroideryProgress;
    if (parsed?.version !== 2 || parsed.fingerprint !== fingerprint) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProgress(progress: EmbroideryProgress) {
  window.localStorage.setItem(`${PROGRESS_STORAGE_PREFIX}${progress.fingerprint}`, JSON.stringify(progress));
}

export function deleteProgress(fingerprint: string) {
  window.localStorage.removeItem(`${PROGRESS_STORAGE_PREFIX}${fingerprint}`);
}

export function buildProject(pattern: RosacePattern, progress: EmbroideryProgress): ProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    fingerprint: patternFingerprint(pattern),
    config: { ...pattern.config, palette: [...pattern.config.palette] },
    progress: {
      completedRuns: progress.completedRuns,
      selectedCode: progress.selectedCode,
      viewport: progress.viewport,
      journal: progress.journal ?? [],
      updatedAt: progress.updatedAt,
    },
  };
}

export type ImportResult =
  | { ok: true; config: RosaceConfig; progress: EmbroideryProgress }
  | { ok: false; error: string };

export function importProject(raw: unknown): ImportResult {
  try {
    const project = raw as Partial<ProjectFile>;
    if (!project || project.format !== PROJECT_FORMAT || project.version !== PROJECT_VERSION) {
      return { ok: false, error: "Ce fichier n'est pas un projet ROSACE version 2." };
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
    const completed = parseRuns(String(project.progress.completedRuns ?? ""));
    if ([...completed].some((index) => index < 0 || index >= regenerated.cells.length)) {
      return { ok: false, error: "La progression contient des cases hors de la grille : import refusé." };
    }
    return {
      ok: true,
      config,
      progress: {
        version: 2,
        fingerprint,
        completedRuns: serializeRuns(completed),
        selectedCode: typeof project.progress.selectedCode === "string" ? project.progress.selectedCode : null,
        viewport: {
          k: Math.min(8, Math.max(1, Number(project.progress.viewport?.k) || 1)),
          x: Number(project.progress.viewport?.x) || 0,
          y: Number(project.progress.viewport?.y) || 0,
        },
        journal: Array.isArray(project.progress.journal) ? project.progress.journal.filter((entry) => entry && Number.isInteger(entry.index) && typeof entry.added === "boolean").slice(-100) : [],
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
