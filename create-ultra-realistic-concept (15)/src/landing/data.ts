import { getThread } from "../data/dmc";
import { DEFAULT_CONFIG, PRESETS, formatDuration, generateRosace, type RosacePattern } from "../lib/rosace";

/**
 * Les ouvrages de la présentation sont de vrais patrons : ils sortent du même moteur
 * que l'atelier. Aucune image decorative, aucun chiffre inventé — les croix, les
 * centimètres et les durées affichés sont calculés.
 */
function preset(id: string) {
  const entry = PRESETS.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Étude inconnue : ${id}`);
  return entry.config;
}

export const HERO_PATTERN = generateRosace(DEFAULT_CONFIG);

export interface ShapeVariant {
  id: string;
  label: string;
  note: string;
  pattern: RosacePattern;
}

export const SHAPE_VARIANTS: ShapeVariant[] = [
  {
    id: "delicate",
    label: "Délicate",
    note: "Deux pétales, densité basse",
    pattern: generateRosace(preset("aube")),
  },
  {
    id: "dense",
    label: "Dense",
    note: "Dix pétales, trame serrée",
    pattern: generateRosace(preset("herbier")),
  },
  {
    id: "florale",
    label: "Florale",
    note: "Corolle de grenat et de prune",
    pattern: generateRosace(DEFAULT_CONFIG),
  },
  {
    id: "geometrique",
    label: "Géométrique",
    note: "Facettes en kaléidoscope",
    pattern: generateRosace(preset("kaleidoscope")),
  },
];

export const PALETTE = HERO_PATTERN.config.palette.map((code) => getThread(code));

export const USED_THREADS = HERO_PATTERN.usage.filter((usage) => usage.count > 0);

export const HERO_STATS = {
  stitches: HERO_PATTERN.stitches.length,
  threads: USED_THREADS.length,
  widthCm: HERO_PATTERN.motifWidthCm,
  minutes: HERO_PATTERN.minutes,
  duration: formatDuration(HERO_PATTERN.minutes),
  grid: HERO_PATTERN.size,
  aida: HERO_PATTERN.config.aida,
  skeins: HERO_PATTERN.totalSkeins,
  meters: HERO_PATTERN.totalNeedleMeters,
};

export const nombre = (value: number) => value.toLocaleString("fr-FR");
/** Les mesures françaises gardent la virgule décimale. */
export const decimal = (value: number) => String(value).replace(".", ",");
