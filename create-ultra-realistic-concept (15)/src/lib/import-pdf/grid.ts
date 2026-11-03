import type { ImportedGrid, ImportLosses, ImportMontage, ImportProvenance } from "../work";
import { FLOSS, flossIndex, nearestFlossList } from "./floss";
import { fitGrid } from "./pdfAnalysis";
import type { VectorResult } from "./pdfVector";

/**
 * Du résultat des moteurs (cases en index FLOSS) à la grille importée neutre que ROSACE
 * valide avec `fromImport`. Remplace `patternFromVector` / `remapImportedPalette` de
 * Point Zéro (studio/src/lib/pdfColorImport.ts), qui produisaient un `Pattern` Point Zéro.
 */

/**
 * Symboles attribués aux fils d'un patron importé, dans l'ordre d'apparition.
 * Les symboles d'origine d'un PDF sont rarement récupérables (glyphes de polices privées) ;
 * comme dans Point Zéro, ROSACE en attribue de lisibles, distincts à l'impression.
 */
export const IMPORT_SYMBOLS = [
  "×", "•", "◆", "■", "▲", "+", "○", "□", "△", "◇", "★", "☆", "♦", "♥", "♠", "♣",
  "▼", "▽", "◀", "▶", "◁", "▷", "●", "◐", "◑", "◒", "◓", "◈", "◉", "◎", "⊕", "⊗",
  "⊙", "⊚", "⊞", "⊠", "⊡", "⊿", "⋄", "⌂", "⌘", "⌧", "⍟", "⎔", "⏢", "⏣", "⏤", "⏥",
  "═", "╬", "╳", "▣", "▤", "▥", "▦", "▧", "▨", "▩", "▪", "▫", "▬", "▭", "▮", "▯",
  "◊", "◌", "◍", "◔", "◕", "◖", "◗", "◘", "◙", "◚", "◛", "◜", "◝", "◞", "◟", "◠",
  "◡", "◢", "◣", "◤", "◥", "◦", "◧", "◨", "◩", "◪", "◫", "◬", "◭", "◮", "◯", "✓",
  "✕", "✚", "✛", "✜", "✝", "✠", "✢", "✣", "✤", "✥", "✦", "✧", "✩", "✪", "✫", "✬",
  "✭", "✮", "✯", "✰", "✱", "✲", "✳", "✴", "✵", "✶", "✷", "✸", "✹", "✺", "✻", "✼",
] as const;

export function importSymbol(index: number) {
  return IMPORT_SYMBOLS[index % IMPORT_SYMBOLS.length] + (index >= IMPORT_SYMBOLS.length ? String(Math.floor(index / IMPORT_SYMBOLS.length) + 1) : "");
}

export interface FlossCells {
  cells: Int16Array;
  width: number;
  height: number;
}

/** Cases en index FLOSS → grille importée à palette locale (index 0..n−1), codes DMC canoniques. */
export function gridFromFlossCells(
  source: FlossCells,
  provenance: ImportProvenance,
  montage: ImportMontage,
  lost: ImportLosses,
  declaredSize?: { w: number; h: number },
  legendCodes: ReadonlySet<string> = new Set(),
): ImportedGrid {
  const order: number[] = [];
  const local = new Map<number, number>();
  const cells = new Int16Array(source.width * source.height);
  for (let i = 0; i < cells.length; i += 1) {
    const value = source.cells[i];
    if (value < 0 || !FLOSS[value]) {
      cells[i] = -1;
      continue;
    }
    let index = local.get(value);
    if (index === undefined) {
      index = order.length;
      order.push(value);
      local.set(value, index);
    }
    cells[i] = index;
  }
  return {
    width: source.width,
    height: source.height,
    cells,
    colors: order.map((flossIdx, index) => ({
      code: FLOSS[flossIdx].code,
      symbol: importSymbol(index),
      fromLegend: legendCodes.has(FLOSS[flossIdx].code),
    })),
    provenance,
    montage,
    lost,
    declaredSize,
  };
}

/**
 * Cases vectorielles à coordonnées absolues → cases FLOSS. Les cases manquantes restent
 * vides. Porté de `patternFromVector` (Point Zéro), sans fabriquer de `Pattern`.
 */
export function flossCellsFromVector(result: VectorResult): (FlossCells & { mapped: number; scaled: boolean }) | null {
  if (!result.ok || !result.bounds || !result.cells.size) return null;
  const { minC, minR, maxC, maxR } = result.bounds;
  const W = maxC - minC + 1, H = maxR - minR + 1;
  if (![W, H, minC, minR].every(Number.isSafeInteger) || W < 1 || H < 1 || W > 12000 || H > 12000 || W * H > 8_000_000) return null;
  const cells = new Int16Array(W * H).fill(-1);
  let mapped = 0;
  for (const [key, code] of result.cells) {
    const [x, y] = key.split(",").map(Number);
    const idx = flossIndex(code);
    if (idx < 0 || !Number.isInteger(x) || !Number.isInteger(y) || x < minC || x > maxC || y < minR || y > maxR) continue;
    cells[(y - minR) * W + x - minC] = idx;
    mapped++;
  }
  if (!mapped) return null;
  const fit = fitGrid(cells, W, H);
  return { cells: fit.cells, width: fit.w, height: fit.h, mapped, scaled: fit.scaled };
}

/**
 * Remplacement simultané de codes DMC dans la palette d'une grille importée (une
 * transposition A→B, B→A est sûre). Calque non destructif : la grille d'origine est intacte.
 */
export function remapGridPalette(grid: ImportedGrid, changes: Record<string, string>): ImportedGrid {
  const resolved = new Map<string, string>();
  for (const [fromCode, toCode] of Object.entries(changes)) {
    const from = flossIndex(fromCode);
    const to = flossIndex(toCode);
    if (from >= 0 && to >= 0 && from !== to) resolved.set(FLOSS[from].code, FLOSS[to].code);
  }
  if (!resolved.size) return grid;
  const newCodes = grid.colors.map((color) => resolved.get(color.code) ?? color.code);
  // Deux fils remplacés par le même code fusionnent : une seule entrée, cases réindexées.
  const merged: Array<{ code: string; symbol: string; fromLegend: boolean }> = [];
  const target = new Map<string, number>();
  const reindex = newCodes.map((code, oldIndex) => {
    let index = target.get(code);
    if (index === undefined) {
      index = merged.length;
      merged.push({ code, symbol: grid.colors[oldIndex].symbol, fromLegend: grid.colors[oldIndex].fromLegend });
      target.set(code, index);
    }
    return index;
  });
  const cells = new Int16Array(grid.cells.length);
  for (let i = 0; i < cells.length; i += 1) cells[i] = grid.cells[i] < 0 ? -1 : reindex[grid.cells[i]];
  return { ...grid, cells, colors: merged };
}

/** Les `count` fils les plus proches d'un code, par CIEDE2000. */
export function closestDmcAlternatives(code: string, count = 4) {
  const idx = flossIndex(code);
  const floss = FLOSS[idx];
  if (!floss) return [];
  return nearestFlossList(floss.lab, count + 1).filter((item) => item.idx !== idx).slice(0, count).map((item) => ({ code: FLOSS[item.idx].code, deltaE: item.deltaE }));
}
