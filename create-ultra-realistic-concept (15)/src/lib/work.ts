import { resolveThreadCode } from "../data/dmc";
import { workFingerprint } from "./pattern-id";
import { SYMBOLS, type AidaCount, type FabricTone, type RosaceConfig, type RosacePattern } from "./rosace";
import { computeWorkStats, type WorkStats } from "./stats";

/**
 * StitchWork — l'ouvrage canonique de ROSACE.
 *
 * Une rosace générée et un patron importé partagent la même matrice de croix, les mêmes
 * mesures, la même empreinte et la même progression. Seule l'origine diffère :
 * - `rosace` : la recette (`RosaceConfig`) régénère la matrice à l'identique ;
 * - `pdf` : la matrice est le résultat figé d'un montage, sans recette.
 *
 * `fromRosace` enveloppe un `RosacePattern` sans copier sa matrice ; `fromImport` valide
 * une grille importée et ne fabrique jamais de recette.
 */
export const WORK_MAX_DIM = 1000;
export const WORK_MAX_CELLS = 1_000_000;

export interface WorkColor {
  code: string;
  symbol: string;
}

export interface ImportProvenance {
  file: string;
  title?: string;
  author?: string;
  pages: number;
  mode: "glyphes" | "vectoriel" | "auto" | "photo";
}

export interface ImportMontage {
  tiles: Array<{ page: number; x: number; y: number; width: number; height: number }>;
  overlaps: number;
  holes: number;
  scaled: boolean;
}

/** Ce que l'import n'a pas pu reprendre : jamais perdu en silence. */
export interface ImportLosses {
  halfStitches: number;
  quarterStitches: number;
  backstitches: number;
  knots: number;
  blends: number;
  unresolved: number;
}

/** Origines importées : un patron PDF recomposé, ou un texte brodé (même matrice, même progression, pas de recette). */
export type ImportedKind = "pdf" | "text" | "photo";
export interface ImportedOrigin {
  kind: ImportedKind;
  provenance: ImportProvenance;
  montage: ImportMontage;
  lost: ImportLosses;
  importedAt: string;
  declaredSize?: { w: number; h: number };
  /** Pour `text` : la phrase brodée, telle que saisie. */
  text?: string;
}
export type WorkOrigin =
  | { kind: "rosace"; config: RosaceConfig }
  | ImportedOrigin;

export interface WorkTextile {
  fabric: FabricTone;
  aida: AidaCount;
  strands: number;
  wastePercent: number;
}

export interface StitchWork extends WorkStats {
  origin: WorkOrigin;
  width: number;
  height: number;
  /** Index dans `palette`, −1 = case vide. Ligne par ligne, origine en haut à gauche. */
  cells: Int16Array;
  palette: WorkColor[];
  textile: WorkTextile;
  fingerprint: string;
}

/** Grille produite par le puzzle PDF : neutre, sans dépendance à ROSACE ni à Point Zéro. */
export interface ImportedGrid {
  /** `pdf` par défaut ; `text` pour un texte brodé. */
  kind?: ImportedKind;
  text?: string;
  width: number;
  height: number;
  cells: Int16Array;
  colors: Array<{ code: string; symbol: string; fromLegend: boolean }>;
  provenance: ImportProvenance;
  montage: ImportMontage;
  lost: ImportLosses;
  declaredSize?: { w: number; h: number };
}

export const DEFAULT_IMPORT_TEXTILE: WorkTextile = { fabric: "naturel", aida: 14, strands: 2, wastePercent: 15 };

export function fromRosace(pattern: RosacePattern): StitchWork {
  const { config, size, cells, cleaned: _cleaned, mirrorSymmetric: _mirror, ...stats } = pattern;
  return {
    origin: { kind: "rosace", config },
    width: size,
    height: size,
    cells,
    palette: config.palette.map((code, index) => ({ code, symbol: SYMBOLS[index] })),
    textile: { fabric: config.fabric, aida: config.aida, strands: config.strands, wastePercent: config.wastePercent },
    fingerprint: workFingerprint(size, size, cells, config.palette),
    ...stats,
  };
}

export type ImportOutcome =
  | { ok: true; work: StitchWork }
  | { ok: false; error: string };

/** Validation stricte d'une grille importée, puis construction de l'ouvrage. Aucune recette n'est inventée. */
export function fromImport(grid: ImportedGrid, textile: WorkTextile = DEFAULT_IMPORT_TEXTILE): ImportOutcome {
  const { width, height } = grid;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return { ok: false, error: "La grille importée n'a pas de dimensions entières valides." };
  }
  if (width > WORK_MAX_DIM || height > WORK_MAX_DIM || width * height > WORK_MAX_CELLS) {
    return { ok: false, error: `La grille importée dépasse ${WORK_MAX_DIM} cases de côté ou ${WORK_MAX_CELLS.toLocaleString("fr-FR")} cases.` };
  }
  if (grid.cells.length !== width * height) {
    return { ok: false, error: "La matrice importée ne correspond pas à ses dimensions." };
  }
  if (grid.colors.length === 0) {
    return { ok: false, error: "La grille importée ne contient aucun fil." };
  }
  const palette: WorkColor[] = [];
  const seen = new Set<string>();
  for (const color of grid.colors) {
    const code = resolveThreadCode(color.code);
    if (!code) return { ok: false, error: `Référence DMC inconnue : « ${color.code} ».` };
    if (seen.has(code)) return { ok: false, error: `Référence DMC en double : « ${code} ».` };
    seen.add(code);
    palette.push({ code, symbol: color.symbol || "·" });
  }
  const cells = new Int16Array(width * height);
  let used = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const value = grid.cells[i];
    if (value < 0) {
      cells[i] = -1;
      continue;
    }
    if (!Number.isInteger(value) || value >= palette.length) {
      return { ok: false, error: `La case ${i} référence un fil absent de la palette (${value}).` };
    }
    cells[i] = value;
    used += 1;
  }
  if (used === 0) return { ok: false, error: "La grille importée ne contient aucune croix." };

  const stats = computeWorkStats(cells, width, height, palette.map((entry) => entry.code), palette.map((entry) => entry.symbol), textile);
  return {
    ok: true,
    work: {
      origin: {
        kind: grid.kind ?? "pdf",
        provenance: grid.provenance,
        montage: grid.montage,
        lost: grid.lost,
        importedAt: new Date().toISOString(),
        declaredSize: grid.declaredSize,
        text: grid.text,
      },
      width,
      height,
      cells,
      palette,
      textile,
      fingerprint: workFingerprint(width, height, cells, palette.map((entry) => entry.code)),
      ...stats,
    },
  };
}

/** Accepte indifféremment un patron généré ou un ouvrage : les couches de rendu et de progression ne voient que `StitchWork`. */
export function toWork(source: RosacePattern | StitchWork): StitchWork {
  return "origin" in source ? source : fromRosace(source);
}

/** Matrice → texte base64 (2 octets par case, petit-boutiste), pour le projet v3 et le stockage local. */
export function encodeCells(cells: Int16Array): string {
  const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function decodeCells(encoded: string, expectedLength: number): Int16Array | null {
  try {
    const binary = atob(encoded);
    if (binary.length !== expectedLength * 2) return null;
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Int16Array(bytes.buffer, 0, expectedLength);
  } catch {
    return null;
  }
}

/** Forme sérialisable d'un ouvrage importé : tout ce qu'il faut pour le reconstruire sans recette. */
export interface ImportedWorkRecord {
  kind?: ImportedKind;
  text?: string;
  width: number;
  height: number;
  cells: string;
  palette: WorkColor[];
  textile: WorkTextile;
  provenance: ImportProvenance;
  montage: ImportMontage;
  lost: ImportLosses;
  importedAt: string;
  declaredSize?: { w: number; h: number };
}

export function serializeImportedWork(work: StitchWork): ImportedWorkRecord | null {
  if (work.origin.kind === "rosace") return null;
  return {
    kind: work.origin.kind,
    text: work.origin.text,
    width: work.width,
    height: work.height,
    cells: encodeCells(work.cells),
    palette: work.palette.map((entry) => ({ ...entry })),
    textile: { ...work.textile },
    provenance: work.origin.provenance,
    montage: work.origin.montage,
    lost: work.origin.lost,
    importedAt: work.origin.importedAt,
    declaredSize: work.origin.declaredSize,
  };
}

/** Reconstruit un ouvrage importé depuis sa forme sérialisée, par le même validateur que l'import. */
export function restoreImportedWork(record: unknown): ImportOutcome {
  const source = record as Partial<ImportedWorkRecord> | null;
  if (!source || typeof source !== "object" || typeof source.cells !== "string" || !Array.isArray(source.palette)) {
    return { ok: false, error: "L'ouvrage importé enregistré est illisible." };
  }
  const width = Number(source.width);
  const height = Number(source.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return { ok: false, error: "Dimensions de l'ouvrage importé invalides." };
  }
  const cells = decodeCells(source.cells, width * height);
  if (!cells) return { ok: false, error: "La matrice de l'ouvrage importé est corrompue." };
  const textile: WorkTextile = {
    fabric: ["naturel", "craie", "brume"].includes(source.textile?.fabric ?? "") ? source.textile!.fabric : DEFAULT_IMPORT_TEXTILE.fabric,
    aida: [14, 16, 18].includes(Number(source.textile?.aida)) ? (Number(source.textile!.aida) as AidaCount) : DEFAULT_IMPORT_TEXTILE.aida,
    strands: Math.max(1, Math.min(6, Math.round(Number(source.textile?.strands) || DEFAULT_IMPORT_TEXTILE.strands))),
    wastePercent: Math.max(0, Math.min(50, Math.round(Number(source.textile?.wastePercent ?? DEFAULT_IMPORT_TEXTILE.wastePercent)))),
  };
  const outcome = fromImport({
    kind: source.kind === "text" ? "text" : source.kind === "photo" ? "photo" : "pdf",
    text: typeof source.text === "string" ? source.text : undefined,
    width,
    height,
    cells,
    colors: source.palette.map((entry) => ({ code: String(entry?.code ?? ""), symbol: String(entry?.symbol ?? ""), fromLegend: false })),
    provenance: source.provenance ?? { file: "inconnu", pages: 0, mode: "auto" },
    montage: source.montage ?? { tiles: [], overlaps: 0, holes: 0, scaled: false },
    lost: source.lost ?? { halfStitches: 0, quarterStitches: 0, backstitches: 0, knots: 0, blends: 0, unresolved: 0 },
    declaredSize: source.declaredSize,
  }, textile);
  if (!outcome.ok) return outcome;
  if (outcome.work.origin.kind !== "rosace" && typeof source.importedAt === "string") outcome.work.origin.importedAt = source.importedAt;
  return outcome;
}

/** Index linéaire d'une case : la primitive partagée par la progression et le mode Broder. */
export const workIndex = (work: Pick<StitchWork, "width">, x: number, y: number) => y * work.width + x;

export function isRosaceWork(work: StitchWork): work is StitchWork & { origin: { kind: "rosace"; config: RosaceConfig } } {
  return work.origin.kind === "rosace";
}
