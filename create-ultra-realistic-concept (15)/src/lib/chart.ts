/**
 * Découpe imprimable du patron. Les régions sont rectangulaires, couvrent
 * exactement chaque croix une seule fois, et restent valides pour les grilles paires
 * comme impaires. C'est la source utilisée par le PDF ET par les tests de couverture.
 */
export interface ChartRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `chartRegions(size)` découpe une grille carrée ; `chartRegions(width, height)` une grille
 * rectangulaire (patron importé). Les deux formes produisent la même découpe en quatre
 * quadrants, chaque case appartenant à exactement une planche.
 */
export function chartRegions(width: number, height: number = width): ChartRegion[] {
  if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) return [];
  const cutX = Math.ceil(width / 2);
  const cutY = Math.ceil(height / 2);
  return [
    { x: 0, y: 0, width: cutX, height: cutY },
    { x: cutX, y: 0, width: width - cutX, height: cutY },
    { x: 0, y: cutY, width: cutX, height: height - cutY },
    { x: cutX, y: cutY, width: width - cutX, height: height - cutY },
  ].filter((region) => region.width > 0 && region.height > 0);
}

export function regionContains(region: ChartRegion, x: number, y: number) {
  return x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height;
}

export function countRegionStitches(regions: ChartRegion[], points: Array<{ x: number; y: number }>) {
  return regions.reduce((total, region) => total + points.filter((point) => regionContains(region, point.x, point.y)).length, 0);
}
