import { FLOSS, deltaE2000, labOf, nearestFloss, type Lab } from "./import-pdf/floss";
import { removeConfetti } from "./import-pdf/quantize";
import { gridFromFlossCells } from "./import-pdf/grid";
import type { ImportedGrid } from "./work";

/**
 * Import photo : une image devient une grille de croix en fils DMC.
 *
 * Trois étapes, toutes honnêtes :
 * 1. réduction — chaque case reçoit la couleur moyenne de ses pixels, calculée en lumière
 *    linéaire (pas sur les valeurs sRGB brutes, qui assombrissent les moyennes) ;
 * 2. tri des fils — chaque case prend le fil DMC le plus proche (ΔE2000 dans CIELAB), puis la
 *    palette est ramenée au nombre de fils demandé en reportant les fils rares sur le plus proche
 *    des fils gardés ;
 * 3. nettoyage des confettis — les croix isolées (aucune voisine du même fil) prennent le fil
 *    majoritaire autour d'elles, et leur nombre est rapporté.
 *
 * Le rapport de couleurs donne, pour chaque fil, la couleur moyenne de la photo (sRGB) et la
 * couleur d'écran de la référence DMC (sRGB, celle du nuancier) avec leur écart ΔE2000.
 * Ce sont des valeurs d'écran : le fil réel reste la référence.
 */
export interface PhotoOptions {
  /** Largeur de la grille en cases ; la hauteur suit les proportions de l'image. */
  width: number;
  /** Nombre maximal de fils DMC. */
  maxColors: number;
  /** Laisse la toile nue sous les pixels quasi blancs. */
  dropWhite: boolean;
  /** Nettoyage des confettis. */
  confetti: boolean;
  /** Nom du fichier, pour la provenance. */
  file: string;
}

export const PHOTO_LIMITS = { width: { min: 20, max: 240 }, colors: { min: 2, max: 60 } } as const;

export interface PhotoColorLine {
  code: string;
  name: string;
  /** Couleur d'écran de la référence DMC (sRGB, nuancier). */
  threadHex: string;
  /** Couleur moyenne des pixels de la photo affectés à ce fil (sRGB). */
  photoHex: string;
  /** Écart ΔE2000 entre les deux, dans CIELAB. */
  deltaE: number;
  count: number;
}

export interface PhotoResult {
  grid: ImportedGrid;
  colors: PhotoColorLine[];
  /** Croix isolées remplacées par le fil voisin majoritaire. */
  confettiRemoved: number;
  /** Fils distincts avant la réduction de palette. */
  threadsBeforeReduction: number;
  /** Cases laissées nues (fond blanc ou transparence). */
  blank: number;
}

const toLinear = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
const toSrgb = (v: number) => { const x = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(x * 255))); };
const hex = (rgb: [number, number, number]) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** Réduction par moyenne en lumière linéaire : chaque case = la moyenne de ses pixels. */
export function averageCells(data: Uint8ClampedArray, srcW: number, srcH: number, width: number, height: number): { rgb: Uint8ClampedArray; alpha: Float32Array } {
  const rgb = new Uint8ClampedArray(width * height * 3);
  const alpha = new Float32Array(width * height);
  for (let cy = 0; cy < height; cy += 1) {
    const y0 = Math.floor((cy * srcH) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * srcH) / height));
    for (let cx = 0; cx < width; cx += 1) {
      const x0 = Math.floor((cx * srcW) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * srcW) / width));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
        const o = (y * srcW + x) * 4;
        const w = data[o + 3] / 255;
        r += toLinear(data[o]) * w; g += toLinear(data[o + 1]) * w; b += toLinear(data[o + 2]) * w; a += w; n += 1;
      }
      const i = cy * width + cx;
      if (a > 0) { rgb[i * 3] = toSrgb(r / a); rgb[i * 3 + 1] = toSrgb(g / a); rgb[i * 3 + 2] = toSrgb(b / a); }
      alpha[i] = n ? a / n : 0;
    }
  }
  return { rgb, alpha };
}

export function photoGrid(data: Uint8ClampedArray, srcW: number, srcH: number, options: PhotoOptions): PhotoResult | { error: string } {
  if (srcW < 2 || srcH < 2 || data.length < srcW * srcH * 4) return { error: "Image illisible." };
  const width = Math.max(PHOTO_LIMITS.width.min, Math.min(PHOTO_LIMITS.width.max, Math.round(options.width)));
  const height = Math.max(2, Math.round((width * srcH) / srcW));
  if (height > PHOTO_LIMITS.width.max * 2) return { error: "Image trop haute pour cette largeur : réduisez la largeur ou recadrez." };
  const maxColors = Math.max(PHOTO_LIMITS.colors.min, Math.min(PHOTO_LIMITS.colors.max, Math.round(options.maxColors)));

  const { rgb, alpha } = averageCells(data, srcW, srcH, width, height);
  const cells = new Int16Array(width * height);
  const labs: Lab[] = new Array(width * height);
  const cache = new Map<number, number>();
  const counts = new Map<number, number>();
  let blank = 0;
  for (let i = 0; i < width * height; i += 1) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    if (alpha[i] < 0.5 || (options.dropWhite && r > 236 && g > 236 && b > 236)) { cells[i] = -1; blank += 1; continue; }
    const lab = labOf([r, g, b]);
    labs[i] = lab;
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let idx = cache.get(key);
    if (idx === undefined) { idx = nearestFloss(lab); cache.set(key, idx); }
    cells[i] = idx;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  if (!counts.size) return { error: "Aucune case à broder : l'image est vide, transparente ou entièrement blanche." };
  const threadsBeforeReduction = counts.size;
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);
  if (ranked.length > maxColors) {
    const keep = ranked.slice(0, maxColors);
    const kept = new Set(keep);
    const remap = new Map<number, number>();
    for (let i = 0; i < cells.length; i += 1) {
      const value = cells[i];
      if (value < 0 || kept.has(value)) continue;
      let match = remap.get(value);
      if (match === undefined) { match = nearestFloss(FLOSS[value].lab, keep); remap.set(value, match); }
      cells[i] = match;
    }
  }
  const confettiRemoved = options.confetti ? removeConfetti(cells, width, height) : 0;

  // Rapport de couleurs : la moyenne de la photo par fil, contre la couleur d'écran du fil.
  const sums = new Map<number, { r: number; g: number; b: number; n: number; de: number }>();
  for (let i = 0; i < cells.length; i += 1) {
    const value = cells[i];
    if (value < 0) continue;
    const entry = sums.get(value) ?? { r: 0, g: 0, b: 0, n: 0, de: 0 };
    entry.r += toLinear(rgb[i * 3]); entry.g += toLinear(rgb[i * 3 + 1]); entry.b += toLinear(rgb[i * 3 + 2]); entry.n += 1;
    entry.de += labs[i] ? deltaE2000(labs[i], FLOSS[value].lab) : 0;
    sums.set(value, entry);
  }
  const colors: PhotoColorLine[] = [...sums.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([idx, sum]) => ({
      code: FLOSS[idx].code,
      name: FLOSS[idx].name,
      threadHex: FLOSS[idx].hex,
      photoHex: hex([toSrgb(sum.r / sum.n), toSrgb(sum.g / sum.n), toSrgb(sum.b / sum.n)]),
      deltaE: Math.round((sum.de / sum.n) * 10) / 10,
      count: sum.n,
    }));

  const grid = gridFromFlossCells(
    { cells, width, height },
    { file: options.file, title: options.file.replace(/\.[a-z0-9]+$/i, ""), pages: 1, mode: "photo" },
    { tiles: [], overlaps: 0, holes: 0, scaled: false },
    { halfStitches: 0, quarterStitches: 0, backstitches: 0, knots: 0, blends: 0, unresolved: 0 },
  );
  return { grid: { ...grid, kind: "photo" }, colors, confettiRemoved, threadsBeforeReduction, blank };
}

/** Couleur d'écran d'une référence DMC (sRGB, nuancier) et sa position CIELAB, pour l'affichage. */
export function threadScreenColor(code: string) {
  const floss = FLOSS.find((entry) => entry.code === code);
  return floss ? { hex: floss.hex, rgb: floss.rgb, lab: floss.lab } : null;
}
