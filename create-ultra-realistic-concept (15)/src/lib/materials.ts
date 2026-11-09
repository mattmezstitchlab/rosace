/**
 * Consommation textile — modèle explicite, distinct des données du motif.
 *
 * Un fil Mouliné DMC est vendu en échevette de 8 m composée de 6 brins :
 * 48 mètres de brins au total, soit 24 m de longueur utile si l'on brode en 2 brins.
 * Le métrage « aiguille » est la longueur du faisceau de brins enfilé ; le métrage
 * « brins » est la somme de tous les brins individuels consommés (faisceau × nombre de brins).
 *
 * La longueur de faisceau par croix part d'un repère pratique de 2,5 cm sur Aïda 14, puis évolue
 * proportionnellement au pas de toile (14 / comptage). Elle ne dépend pas du nombre de brins :
 * un faisceau de 1 ou de 6 brins parcourt le même chemin. Le nombre de brins ne multiplie donc
 * que le métrage « brins », et par lui le nombre d'échevettes (48 m de brins chacune).
 * Ce n'est pas une mesure officielle DMC : la tension, les arrêts et le cheminement
 * au dos font varier la consommation réelle.
 */
export interface MaterialOptions {
  aida: number;
  strands: number;
  /** Marge de sécurité en pourcentage (fils perdus, erreurs, arrêts). */
  wastePercent: number;
}

export interface MaterialLine {
  /** Longueur du faisceau enfilé, marge comprise. */
  needleMeters: number;
  /** Somme des longueurs de tous les brins individuels, marge comprise. */
  strandMeters: number;
  /** Échevettes commerciales de 8 m à acheter, arrondies par couleur. */
  skeins: number;
  /** Longueur utile d'un faisceau dans une échevette, pour le nombre de brins choisi. */
  skeinUsableNeedleMeters: number;
}

export const SKEIN_STRAND_METERS = 8 * 6;
/** Repère de 2,5 cm de faisceau par croix sur Aïda 14, relevé pour 2 brins (réglage par défaut) et valable pour tout nombre de brins. */
export const SKEIN_NEEDLE_CM_14CT_2_STRANDS = 2.5;

/**
 * Longueur de faisceau enfilé par croix, en mètres : elle ne dépend que du comptage de l'Aïda.
 * Le nombre de brins est accepté pour ne pas casser les appels existants, mais n'intervient plus.
 */
export function perStitchNeedleMeters(aida: number, _strands?: number): number {
  const safeAida = Math.max(6, aida);
  return (SKEIN_NEEDLE_CM_14CT_2_STRANDS / 100) * (14 / safeAida);
}

export function computeMaterials(count: number, options: MaterialOptions): MaterialLine {
  const strands = Math.max(1, Math.min(6, Math.round(options.strands)));
  const waste = 1 + Math.min(50, Math.max(0, options.wastePercent)) / 100;
  const needleMeters = count > 0 ? count * perStitchNeedleMeters(options.aida) * waste : 0;
  const strandMeters = needleMeters * strands;
  const usable = SKEIN_STRAND_METERS / strands;
  return {
    needleMeters: Math.round((needleMeters + 1e-9) * 10) / 10,
    strandMeters: Math.round((strandMeters + 1e-9) * 10) / 10,
    // Le − 1e-9 évite qu'une erreur d'arrondi sur un total exact (48 m, 96 m…) réclame une échevette de plus.
    skeins: count > 0 ? Math.max(1, Math.ceil(strandMeters / SKEIN_STRAND_METERS - 1e-9)) : 0,
    skeinUsableNeedleMeters: Math.round(usable * 10) / 10,
  };
}

/** Estimation de temps : plage 100–200 croix/h, surcoût de 40 %, arrondie à la minute. */
export function estimateTime(stitches: number) {
  const low = Math.max(1, Math.round((stitches / 200) * 1.4 * 60 + 15));
  const high = Math.max(1, Math.round((stitches / 100) * 1.4 * 60 + 25));
  const median = Math.max(1, Math.round((stitches / 150) * 1.4 * 60 + 20));
  return { low, median, high, assumedRate: "100–200 croix/h, surcoût 40 %" };
}
