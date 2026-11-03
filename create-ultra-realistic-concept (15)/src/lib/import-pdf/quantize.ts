import { FLOSS, labOf, nearestFloss } from "./floss";

/**
 * Quantification de pixels vers le fil DMC le plus proche (copié de Point Zéro,
 * studio/src/lib/quantize.ts). Calcul pur, sans DOM.
 */
export interface QuantizeOptions {
  /** Nombre maximal de fils DMC différents. */
  maxColors: number;
  /** Ignore le fond blanc (laisse la toile nue). */
  dropWhite: boolean;
  /** Supprime les confettis (points isolés d'une seule case). */
  confetti?: boolean;
}

export function removeConfetti(cells: Int16Array, w: number, h: number, passes = 2): number {
  let changed = 0;
  for (let pass = 0; pass < passes; pass++) {
    let passChanged = 0; const prev = cells.slice();
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const i = r * w + c, value = prev[i]; if (value < 0) continue;
      const neighbours: number[] = [];
      if (c > 0) neighbours.push(prev[i - 1]); if (c < w - 1) neighbours.push(prev[i + 1]);
      if (r > 0) neighbours.push(prev[i - w]); if (r < h - 1) neighbours.push(prev[i + w]);
      if (neighbours.includes(value)) continue;
      const counts = new Map<number, number>(); for (const n of neighbours) counts.set(n, (counts.get(n) ?? 0) + 1);
      let best = -1, bestCount = 0; for (const [n, count] of counts) if (count > bestCount) { best = n; bestCount = count; }
      cells[i] = best; passChanged++;
    }
    changed += passChanged; if (!passChanged) break;
  }
  return changed;
}

export function quantizePixels(data: Uint8ClampedArray, w: number, h: number, opts: QuantizeOptions) {
  const cells = new Int16Array(w * h), cache = new Map<number, number>(), counts = new Map<number, number>();
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
    if (a < 128 || (opts.dropWhite && r > 232 && g > 232 && b > 232)) { cells[i] = -1; continue; }
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let idx = cache.get(key); if (idx === undefined) { idx = nearestFloss(labOf([r, g, b])); cache.set(key, idx); }
    cells[i] = idx; counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((v) => v[0]);
  if (ranked.length > opts.maxColors) {
    const keep = ranked.slice(0, opts.maxColors), kept = new Set(keep), remap = new Map<number, number>();
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i]; if (v < 0 || kept.has(v)) continue;
      let match = remap.get(v); if (match === undefined) { match = nearestFloss(FLOSS[v].lab, keep); remap.set(v, match); }
      cells[i] = match;
    }
  }
  if (opts.confetti !== false) removeConfetti(cells, w, h);
  const final = new Map<number, number>(); for (const v of cells) if (v >= 0) final.set(v, (final.get(v) ?? 0) + 1);
  return { cross: cells, palette: [...final.entries()].sort((a, b) => b[1] - a[1]).map((v) => v[0]) };
}
