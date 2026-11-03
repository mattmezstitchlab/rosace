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

export type WorkOrigin =
  | { kind: "rosace"; config: RosaceConfig }
  | { kind: "pdf"; provenance: ImportProvenance; montage: ImportMontage; lost: ImportLosses; importedAt: string; declaredSize?: { w: number; h: number } };

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
        kind: "pdf",
        provenance: grid.provenance,
        montage: grid.montage,
        lost: grid.lost,
        importedAt: new Date().toISOString(),
        declaredSize: grid.declaredSize,
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

/** Index linéaire d'une case : la primitive partagée par la progression et le mode Broder. */
export const workIndex = (work: Pick<StitchWork, "width">, x: number, y: number) => y * work.width + x;

export function isRosaceWork(work: StitchWork): work is StitchWork & { origin: { kind: "rosace"; config: RosaceConfig } } {
  return work.origin.kind === "rosace";
}
