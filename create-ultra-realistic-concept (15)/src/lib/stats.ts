import { computeMaterials, estimateTime } from "./materials";

/**
 * Mesures d'un ouvrage à partir de sa seule matrice de croix.
 *
 * Cette fonction est l'unique calcul de croix, de fils et de dimensions : elle sert
 * aussi bien à une rosace générée (`generateRosace`) qu'à un patron importé.
 * Elle ne connaît ni la recette, ni l'origine du motif : seulement la grille,
 * les codes de fils et les hypothèses textiles.
 */
export interface Stitch {
  x: number;
  y: number;
  color: number;
}

export interface ThreadUsage {
  paletteIndex: number;
  code: string;
  count: number;
  /** Longueur du faisceau enfilé, marge comprise. */
  meters: number;
  /** Somme de tous les brins individuels consommés. */
  strandMeters: number;
  skeins: number;
  usableNeedleMeters: number;
  symbol: string;
}

export interface TextileOptions {
  aida: number;
  strands: number;
  wastePercent: number;
}

export interface WorkStats {
  stitches: Stitch[];
  usage: ThreadUsage[];
  motifPoints: number;
  motifCm: number;
  cutCm: number;
  minutes: number;
  timeEstimate: { low: number; median: number; high: number; assumedRate: string };
  totalNeedleMeters: number;
  totalStrandMeters: number;
  totalSkeins: number;
  motifWidthCm: number;
  motifHeightCm: number;
}

export function computeWorkStats(
  cells: Int16Array,
  width: number,
  height: number,
  codes: string[],
  symbols: string[],
  textile: TextileOptions,
): WorkStats {
  const paletteLength = codes.length;
  const stitches: Stitch[] = [];
  const counts = new Array<number>(paletteLength).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const paletteIndex = cells[y * width + x];
      if (paletteIndex >= 0) {
        stitches.push({ x, y, color: paletteIndex });
        counts[paletteIndex] += 1;
      }
    }
  }

  const usage = counts.map((count, paletteIndex) => {
    const material = computeMaterials(count, { aida: textile.aida, strands: textile.strands, wastePercent: textile.wastePercent });
    return {
      paletteIndex,
      code: codes[paletteIndex],
      count,
      meters: material.needleMeters,
      strandMeters: material.strandMeters,
      skeins: material.skeins,
      usableNeedleMeters: material.skeinUsableNeedleMeters,
      symbol: symbols[paletteIndex],
    };
  });
  const pointsPerCm = textile.aida / 2.54;
  const bounds = stitches.reduce((extent, stitch) => ({
    minX: Math.min(extent.minX, stitch.x),
    maxX: Math.max(extent.maxX, stitch.x),
    minY: Math.min(extent.minY, stitch.y),
    maxY: Math.max(extent.maxY, stitch.y),
  }), { minX: width, maxX: 0, minY: height, maxY: 0 });
  const motifPoints = stitches.length ? Math.max(bounds.maxX - bounds.minX + 1, bounds.maxY - bounds.minY + 1) : Math.max(width, height);
  const motifCm = Math.round((motifPoints / pointsPerCm) * 10) / 10;
  const cutCm = Math.ceil(motifCm + 12);
  const timeEstimate = estimateTime(stitches.length);
  const minutes = timeEstimate.median;
  const totalNeedleMeters = Math.round(usage.reduce((sum, line) => sum + line.meters, 0) * 10) / 10;
  const totalStrandMeters = Math.round(usage.reduce((sum, line) => sum + line.strandMeters, 0) * 10) / 10;
  const totalSkeins = usage.reduce((sum, line) => sum + line.skeins, 0);
  const motifWidthCm = stitches.length ? Math.round(((bounds.maxX - bounds.minX + 1) / pointsPerCm) * 10) / 10 : 0;
  const motifHeightCm = stitches.length ? Math.round(((bounds.maxY - bounds.minY + 1) / pointsPerCm) * 10) / 10 : 0;

  return { stitches, usage, motifPoints, motifCm, cutCm, minutes, timeEstimate, totalNeedleMeters, totalStrandMeters, totalSkeins, motifWidthCm, motifHeightCm };
}
