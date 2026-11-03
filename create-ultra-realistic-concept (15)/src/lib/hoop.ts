import { GRID_SIZES, generateRosace, normalizeConfig, type AidaCount, type RosaceConfig } from "./rosace";

/**
 * Sur mesure du tambour : pour un diamètre réel (cm) et un aïda, quelle échelle de rosace
 * remplit le cercle sans le déborder. Le calcul part des vraies dimensions du motif généré
 * (bornes des croix), pas de la taille de grille.
 */
export const HOOP_DIAMETERS_CM = [10, 12.5, 15, 18, 20, 23, 25, 30] as const;
/** Marge entre le motif et le bord intérieur du tambour, pour tendre et finir proprement. */
export const HOOP_MARGIN_CM = 1.5;

export interface HoopFit {
  scale: number;
  motifCm: number;
  /** Vrai si le motif tient dans le cercle avec la marge. */
  fits: boolean;
  /** Part du diamètre utile occupée par le motif (1 = rempli). */
  fill: number;
}

export function hoopFits(config: RosaceConfig, diameterCm: number): HoopFit[] {
  const usable = Math.max(1, diameterCm - HOOP_MARGIN_CM * 2);
  return GRID_SIZES.map((_, index) => {
    const scale = index + 1;
    const pattern = generateRosace(normalizeConfig({ ...config, scale }));
    const motifCm = Math.max(pattern.motifWidthCm, pattern.motifHeightCm);
    return { scale, motifCm, fits: motifCm <= usable, fill: motifCm / usable };
  });
}

/** La plus grande échelle qui tient ; sinon la plus petite, signalée comme trop grande. */
export function suggestScale(config: RosaceConfig, diameterCm: number): HoopFit & { aidaHint: AidaCount | null } {
  const fits = hoopFits(config, diameterCm);
  const best = [...fits].reverse().find((fit) => fit.fits) ?? fits[0];
  // Si même la plus petite échelle déborde, un aïda plus fin réduit le motif : on le suggère.
  let aidaHint: AidaCount | null = null;
  if (!best.fits) {
    for (const aida of [16, 18] as AidaCount[]) {
      if (aida <= config.aida) continue;
      const smallest = hoopFits({ ...config, aida }, diameterCm)[0];
      if (smallest.fits) { aidaHint = aida; break; }
    }
  }
  return { ...best, aidaHint };
}
