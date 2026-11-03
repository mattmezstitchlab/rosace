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

/* ---------- Les deux autres portes de l'atelier, elles aussi calculées ---------- */
import { fromImport, fromRosace, type StitchWork } from "../lib/work";
import { textGrid } from "../lib/text";
import { computeRhythm, forecast, recordStitches } from "../lib/sessions";
import { suggestScale } from "../lib/hoop";

/** La rosace du hero, sous sa forme canonique (celle que Broder, l'import et les exports partagent). */
export const HERO_WORK: StitchWork = fromRosace(HERO_PATTERN);

/** Un texte brodé avec la police de l'atelier, dans deux fils de la palette du hero. */
const textGridResult = textGrid({ text: "ROSACE", code: HERO_PATTERN.config.palette[0], shadowCode: HERO_PATTERN.config.palette[2], margin: 2, align: "center" });
if ("error" in textGridResult) throw new Error(`Texte brodé de la présentation invalide : ${textGridResult.error}`);
const textOutcome = fromImport(textGridResult);
if (!textOutcome.ok) throw new Error(`Texte brodé de la présentation invalide : ${textOutcome.error}`);
export const TEXT_WORK: StitchWork = textOutcome.work;

/** Une prévision calculée par le vrai moteur de séances, sur des séances d'exemple explicitement fictives. */
const t0 = new Date("2026-10-20T20:00:00Z");
let demoSessions = recordStitches([], 0, t0);
/* Quatre soirées de 40 minutes, une quinzaine de croix toutes les cinq minutes : un rythme de brodeuse, pas de machine. */
for (const day of [0, 1, 3, 5]) {
  for (let step = 0; step <= 8; step += 1) {
    demoSessions = recordStitches(demoSessions, step === 0 ? 0 : 14 + ((day + step) % 3), new Date(t0.getTime() + day * 86_400_000 + step * 5 * 60_000));
  }
}
const demoRhythm = computeRhythm(demoSessions);
const demoDone = demoSessions.reduce((sum, session) => sum + session.stitches, 0);
export const DEMO_FORECAST = {
  done: demoDone,
  rhythm: demoRhythm,
  forecast: forecast(demoRhythm, HERO_PATTERN.stitches.length - demoDone, demoSessions, new Date(t0.getTime() + 6 * 86_400_000)),
};

/** Le tambour de 20 cm : l'échelle la plus grande qui y tient, calculée. */
export const DEMO_HOOP = suggestScale(HERO_PATTERN.config, 20);
