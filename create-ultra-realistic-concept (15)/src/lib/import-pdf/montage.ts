import { fitGrid, type PdfBlock } from "./pdfAnalysis";

/**
 * Table de montage : placement, aimantation et assemblage des morceaux de grille.
 *
 * Porté de Point Zéro (studio/src/components/PdfPrep.tsx : `positionsPuzzle`,
 * l'aimantation du glisser et `assembleFromTileLayout`), sorti du composant pour être
 * testable, avec trois changements de comportement :
 * - une tuile porte ses propres dimensions de cases (`cols`/`rows`) : modifier le calage
 *   d'un bloc ne mélange plus les cases d'une page lue en glyphes ;
 * - l'aimantation choisit la cible la plus proche, pas la dernière rencontrée ;
 * - l'assemblage compte les recouvrements, les conflits et les trous au lieu de les taire.
 */
export interface Tile {
  id: string;
  page: number;
  /** Dimensions réelles de la matrice `cells`. */
  cols: number;
  rows: number;
  /** Index FLOSS (voir floss.ts), −1 = vide. */
  cells: Int16Array;
  byColor: number;
  byLegend: number;
  unresolved: number;
}

export interface TilePlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Position { x: number; y: number }

/** Positions sans chevauchement en rangées régulières, même si les blocs ont des dimensions différentes. */
export function positionsPuzzle(
  blocks: Pick<PdfBlock, "id" | "cols" | "rows">[],
  columns: number,
  uniformSizes: boolean,
  size: { cols: number; rows: number },
): Record<string, Position> {
  const positions: Record<string, Position> = {};
  const n = Math.max(1, columns);
  let x = 0, y = 0, rowHeight = 0;
  blocks.forEach((block, index) => {
    if (index > 0 && index % n === 0) {
      y += rowHeight; x = 0; rowHeight = 0;
    }
    positions[block.id] = { x, y };
    x += uniformSizes ? size.cols : block.cols;
    rowHeight = Math.max(rowHeight, uniformSizes ? size.rows : block.rows);
  });
  return positions;
}

/** Médianes des dimensions, utilisées quand les cartes sont uniformisées. */
export function uniformDimensions(blocks: Pick<PdfBlock, "cols" | "rows">[]) {
  if (!blocks.length) return { cols: 50, rows: 60 };
  const cols = blocks.map((b) => b.cols).sort((a, b) => a - b);
  const rows = blocks.map((b) => b.rows).sort((a, b) => a - b);
  return { cols: cols[cols.length >> 1] || 50, rows: rows[rows.length >> 1] || 60 };
}

export function tilesOverlap(a: TilePlacement, b: TilePlacement) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: { x?: number; y?: number };
  /** Identifiants des cartes que la position retenue recouvre. */
  overlaps: string[];
}

/**
 * Aimantation d'une carte en mouvement aux bords des autres cartes et à l'origine.
 * Parmi tous les bords à portée, c'est le plus proche qui gagne, sur chaque axe.
 */
export function snapPosition(
  moving: TilePlacement,
  others: TilePlacement[],
  snapDist: number,
  enabled = true,
): SnapResult {
  let x = Math.max(0, moving.x);
  let y = Math.max(0, moving.y);
  const guides: { x?: number; y?: number } = {};
  if (enabled) {
    let bestX: { value: number; guide: number; distance: number } | null = null;
    let bestY: { value: number; guide: number; distance: number } | null = null;
    const consider = (axis: "x" | "y", value: number, guide: number) => {
      const distance = Math.abs((axis === "x" ? x : y) - value);
      if (distance > snapDist) return;
      const best = axis === "x" ? bestX : bestY;
      if (!best || distance < best.distance) {
        const candidate = { value, guide, distance };
        if (axis === "x") bestX = candidate; else bestY = candidate;
      }
    };
    for (const o of others) {
      if (o.id === moving.id) continue;
      consider("x", o.x + o.w, o.x + o.w);      // bord gauche contre bord droit du voisin
      consider("x", o.x - moving.w, o.x);        // bord droit contre bord gauche du voisin
      consider("x", o.x, o.x);                   // alignement des bords gauches
      consider("y", o.y + o.h, o.y + o.h);
      consider("y", o.y - moving.h, o.y);
      consider("y", o.y, o.y);
    }
    consider("x", 0, 0);
    consider("y", 0, 0);
    if (bestX) { x = Math.max(0, (bestX as { value: number; guide: number }).value); guides.x = (bestX as { guide: number }).guide; }
    if (bestY) { y = Math.max(0, (bestY as { value: number; guide: number }).value); guides.y = (bestY as { guide: number }).guide; }
  }
  const placed = { ...moving, x, y };
  const overlaps = others.filter((o) => o.id !== moving.id && tilesOverlap(placed, o)).map((o) => o.id);
  return { x, y, guides, overlaps };
}

export interface Assembly {
  cells: Int16Array;
  width: number;
  height: number;
  rawWidth: number;
  rawHeight: number;
  scaled: boolean;
  tiles: number;
  byColor: number;
  byLegend: number;
  unresolved: number;
  /** Cases couvertes par deux cartes ou plus. */
  overlaps: number;
  /** Cases couvertes par deux cartes portant des valeurs différentes (la dernière carte a gagné). */
  conflicts: number;
  /** Cases du plateau qu'aucune carte ne couvre. */
  holes: number;
  /** Paires de cartes qui se recouvrent. */
  overlappingPairs: Array<[string, string]>;
}

/**
 * Assemble les cartes aux coordonnées de la table de montage. Une carte peut être
 * rééchantillonnée (tailles uniformisées) au plus proche voisin. Le résultat est réduit
 * par `fitGrid` s'il dépasse les plafonds, et chaque anomalie est comptée.
 */
export function assembleTiles(tiles: Tile[], layout: TilePlacement[]): Assembly {
  if (!tiles.length) throw new Error("Aucun bloc à assembler.");
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const placements = layout.filter((item) => byId.has(item.id));
  if (!placements.length) throw new Error("Aucune carte placée.");
  let maxX = 1;
  let maxY = 1;
  for (const t of placements) {
    maxX = Math.max(maxX, t.x + t.w);
    maxY = Math.max(maxY, t.y + t.h);
  }
  const W = Math.max(1, Math.ceil(maxX));
  const H = Math.max(1, Math.ceil(maxY));
  if (W * H > 8_000_000) throw new Error("Grille trop grande : réduisez les blocs ou le nombre de pages.");
  const raw = new Int16Array(W * H).fill(-1);
  const coverage = new Uint8Array(W * H);
  let conflicts = 0;
  let byColor = 0;
  let byLegend = 0;
  let unresolved = 0;

  for (const t of placements) {
    const tile = byId.get(t.id)!;
    byColor += tile.byColor;
    byLegend += tile.byLegend;
    unresolved += tile.unresolved;
    for (let r = 0; r < t.h; r++) {
      for (let c = 0; c < t.w; c++) {
        const srcX = Math.min(tile.cols - 1, Math.floor(c * tile.cols / t.w));
        const srcY = Math.min(tile.rows - 1, Math.floor(r * tile.rows / t.h));
        const gx = t.x + c;
        const gy = t.y + r;
        if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
        const index = gy * W + gx;
        const value = tile.cells[srcY * tile.cols + srcX];
        coverage[index] = Math.min(255, coverage[index] + 1);
        if (value >= 0) {
          if (raw[index] >= 0 && raw[index] !== value) conflicts += 1;
          raw[index] = value;
        }
      }
    }
  }

  let overlaps = 0;
  let holes = 0;
  for (let i = 0; i < coverage.length; i += 1) {
    if (coverage[i] === 0) holes += 1;
    else if (coverage[i] > 1) overlaps += 1;
  }
  const overlappingPairs: Array<[string, string]> = [];
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      if (tilesOverlap(placements[i], placements[j])) overlappingPairs.push([placements[i].id, placements[j].id]);
    }
  }

  const fit = fitGrid(raw, W, H);
  return {
    cells: fit.cells,
    width: fit.w,
    height: fit.h,
    rawWidth: W,
    rawHeight: H,
    scaled: fit.scaled,
    tiles: placements.length,
    byColor,
    byLegend,
    unresolved,
    overlaps,
    conflicts,
    holes,
    overlappingPairs,
  };
}
