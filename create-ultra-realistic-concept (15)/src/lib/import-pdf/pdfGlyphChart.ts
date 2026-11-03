import { flossIndex } from "./floss";
import { codeOfText } from "./pdfVector";
import type { PdfHandle, RawItem } from "./pdfimport";

/**
 * Lecture fidèle des patrons dont chaque case est un glyphe d'une police PDF.
 * Exemple de structure supportée : 12 pages de 49/53/53/38 colonnes
 * par 68/68/64 rangées, plus une légende symbole → DMC.
 *
 * Même les cases de fond sont présentes dans le PDF : on ne les confond
 * jamais avec des couleurs, et aucune zone de page n'est ignorée.
 */
export interface CompleteGlyphTile {
  page: number;
  cols: number;
  rows: number;
  cells: Int16Array;
  mapped: number;
  empty: number;
  unresolved: number;
  /** Zone approchée de la vraie grille pour le calage visuel (% de page). */
  bounds: { x0: number; y0: number; x1: number; y1: number };
}
export interface CompleteGlyphChart {
  ok: boolean;
  reason: string;
  tiles: CompleteGlyphTile[];
  columns: number;
  width: number;
  height: number;
  declared: { w: number; h: number } | null;
  legendCount: number;
  mapped: number;
  blank: number;
  unresolved: number;
}

const GLYPH = /^[\uE000-\uF8FF]$/u;
const BLANK = "\uf020";
type Glyph = { str: string; x: number; y: number; size: number; w: number };

function glyphsOf(items: RawItem[]): Glyph[] {
  const out: Glyph[] = [];
  for (const item of items) {
    if (!item.str) continue;
    const chars = Array.from(item.str);
    // Conserver les libellés ordinaires, et les lignes de code DMC.
    if (!chars.every(ch => GLYPH.test(ch))) continue;
    const step = item.w > 0 ? item.w / chars.length : item.size;
    chars.forEach((str, i) => out.push({ str, x: item.x + i * step, y: item.y, size: item.size, w: step }));
  }
  return out;
}

function rowsOf(glyphs: Glyph[]): Glyph[][] {
  const sorted = glyphs.slice().sort((a, b) => a.y - b.y);
  const rows: Glyph[][] = [];
  for (const glyph of sorted) {
    const prev = rows[rows.length - 1];
    // Ordonnées de la ligne de base de pdf.js. Tolérance inférieure au
    // pas d'une rangée ; compatible avec des fontes à hauteurs différentes.
    if (prev && Math.abs(glyph.y - prev[prev.length - 1].y) <= Math.max(2, glyph.size * .28)) prev.push(glyph);
    else rows.push([glyph]);
  }
  rows.forEach(row => row.sort((a, b) => a.x - b.x));
  return rows;
}

function findDimensions(items: RawItem[][]) {
  for (const page of items) for (const item of page) {
    const m = /(?:^|[^\d.])(\d{2,4})\s*[x×]\s*(\d{2,4})(?![\d.])/i.exec(item.str);
    if (!m) continue;
    const w = Number(m[1]), h = Number(m[2]);
    if (w >= 10 && h >= 10 && w <= 1000 && h <= 1000) return { w, h };
  }
  return null;
}

function symbolLegend(items: RawItem[][]): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const page of items) {
    const allGlyphs = glyphsOf(page).filter(g => g.str !== BLANK);
    if (allGlyphs.length > 250) continue; // une grille, pas un tableau de légende
    const codes = page
      .map(it => ({ ...it, code: codeOfText(it.str) }))
      .filter(it => !!it.code);
    if (codes.length < 4 || allGlyphs.length < 4) continue;
    for (const c of codes) {
      const nearby = allGlyphs
        .filter(g => g.x < c.x && c.x - g.x <= 250 &&
          Math.abs(g.y - c.y) <= Math.max(5, g.size * .65))
        .sort((a, b) => b.x - a.x);
      const g = nearby[0];
      if (!g) continue;
      const v = votes.get(g.str) ?? new Map<string, number>();
      v.set(c.code, (v.get(c.code) ?? 0) + 1);
      votes.set(g.str, v);
    }
  }
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const [char, candidates] of [...votes].sort((a, b) => Math.max(...b[1].values()) - Math.max(...a[1].values()))) {
    const best = [...candidates].sort((a, b) => b[1] - a[1])[0];
    if (!best || used.has(best[0]) || flossIndex(best[0]) < 0) continue;
    used.add(best[0]);
    map.set(char, best[0]);
  }
  return map;
}

function chooseColumns(tiles: CompleteGlyphTile[], declared: { w: number; h: number } | null) {
  const solutions: { n: number; width: number; height: number }[] = [];
  for (let n = 1; n <= tiles.length; n++) {
    if (tiles.length % n !== 0) continue;
    const nRows = tiles.length / n;
    const widths = tiles.slice(0, n).map(t => t.cols);
    let h = 0, valid = true;
    for (let row = 0; row < nRows; row++) {
      const line = tiles.slice(row * n, (row + 1) * n);
      if (line.length !== n ||
          line.some((tile, col) => tile.cols !== widths[col] || tile.rows !== line[0].rows)) {
        valid = false;
        break;
      }
      h += line[0].rows;
    }
    const w = widths.reduce((a, b) => a + b, 0);
    if (valid && (!declared || declared.w === w && declared.h === h)) {
      solutions.push({ n, width: w, height: h });
    }
  }
  // Pour un découpage multi-pages, il faut une solution non ambiguë.
  return solutions.length === 1 ? solutions[0] : null;
}

export async function readCompleteGlyphChart(handle: PdfHandle): Promise<CompleteGlyphChart> {
  const fail = (reason: string): CompleteGlyphChart => ({
    ok: false, reason, tiles: [], columns: 0, width: 0, height: 0,
    declared: null, legendCount: 0, mapped: 0, blank: 0, unresolved: 0,
  });
  if (handle.pages < 2 || handle.pages > 200) return fail("Ce document ne contient pas un patron vectoriel multipage reconnu.");
  const pages: RawItem[][] = [];
  const sizes: { w: number; h: number }[] = [];
  for (let n = 1; n <= handle.pages; n++) {
    const [items, dims] = await Promise.all([handle.rawText(n, 1000), handle.dims(n)]);
    pages.push(items);
    sizes.push(dims);
  }
  const declared = findDimensions(pages);
  const legend = symbolLegend(pages);
  if (legend.size < 4) return fail("Aucune légende de symboles DMC suffisamment fiable.");
  const tiles: CompleteGlyphTile[] = [];
  let mapped = 0, blank = 0, unresolved = 0;
  for (let i = 0; i < pages.length; i++) {
    const all = glyphsOf(pages[i]);
    if (all.length < 200) continue;
    const rows = rowsOf(all);
    if (rows.length < 8 || rows.length > 1000) continue;
    const cols = rows[0]?.length ?? 0;
    if (cols < 8 || cols > 1000 || rows.some(r => r.length !== cols)) continue;
    const cells = new Int16Array(cols * rows.length).fill(-1);
    let pageMapped = 0, pageBlank = 0, pageUnresolved = 0;
    rows.forEach((row, y) => row.forEach((g, x) => {
      const at = y * cols + x;
      if (g.str === BLANK) { pageBlank++; return; }
      const code = legend.get(g.str);
      const idx = code ? flossIndex(code) : -1;
      if (idx < 0) { pageUnresolved++; return; }
      cells[at] = idx;
      pageMapped++;
    }));
    const xs = all.map(g => g.x), ys = all.map(g => g.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pitchX = cols > 1 ? (maxX - minX) / (cols - 1) : 0;
    const pitchY = rows.length > 1 ? (maxY - minY) / (rows.length - 1) : 0;
    const pxH = sizes[i].h / sizes[i].w * 1000;
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    tiles.push({
      page: i + 1, cols, rows: rows.length, cells,
      mapped: pageMapped, empty: pageBlank, unresolved: pageUnresolved,
      bounds: {
        x0: clamp((minX - pitchX / 2) / 10),
        y0: clamp((minY - pitchY / 2) / pxH * 100),
        x1: clamp((maxX + pitchX / 2) / 10),
        y1: clamp((maxY + pitchY / 2) / pxH * 100),
      },
    });
    mapped += pageMapped;
    blank += pageBlank;
    unresolved += pageUnresolved;
  }
  if (!tiles.length) return fail("Aucune grille de glyphes avec cases complètes.");
  const arrangement = chooseColumns(tiles, declared);
  if (!arrangement) return fail("Le découpage des pages ne concorde pas avec les dimensions du patron.");
  if (arrangement.width * arrangement.height > 1_000_000) return fail("Patron trop grand pour l'atelier.");
  const ratio = (mapped + blank) / Math.max(1, mapped + blank + unresolved);
  if (ratio < .99 || mapped < 50) return fail("Correspondance incomplète entre les symboles du PDF et les références DMC.");
  return {
    ok: true, reason: "", tiles, columns: arrangement.n,
    width: arrangement.width, height: arrangement.height,
    declared, legendCount: legend.size, mapped, blank, unresolved,
  };
}
