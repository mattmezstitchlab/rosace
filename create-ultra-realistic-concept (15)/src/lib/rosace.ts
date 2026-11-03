import { DEFAULT_PALETTE, resolveThreadCode } from "../data/dmc";
import { computeMaterials, estimateTime } from "./materials";

export type FabricTone = "naturel" | "craie" | "brume";
export type AidaCount = 14 | 16 | 18;
export type DimensionKey = "structure" | "trace" | "density" | "scale" | "paletteShift" | "geometry";

export interface RosaceConfig {
  structure: number;
  trace: number;
  density: number;
  scale: number;
  paletteShift: number;
  /**
   * Famille géométrique : 1 = corolle classique, 2 = mandala, 3 = arabesque,
   * 4 = kaléidoscope, 5 = entrelacs, 6 = fractale. Indépendante des cinq structures
   * (6, 8, 10, 12, 14 pétales) et de tous les autres réglages.
   */
  geometry: number;
  /** Tourbillon : décalage angulaire progressif selon le rayon (0 = symétrie stricte). */
  twist: number;
  /** Ondulation : modulation radiale de la fleur, en éventail. */
  wave: number;
  seed: number;
  palette: string[];
  fabric: FabricTone;
  aida: AidaCount;
  /** Nombre de brins enfilés ensemble (1 à 6). N'affecte pas la géométrie. */
  strands: number;
  /** Marge de sécurité textile en pourcentage (0 à 50). N'affecte pas la géométrie. */
  wastePercent: number;
}

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

export interface RosacePattern {
  config: RosaceConfig;
  size: number;
  cells: Int16Array;
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
  /** Croix isolées involontaires retirées par le contrôle de brodabilité. */
  cleaned: number;
  /** Vrai lorsque la grille est exactement symétrique gauche-droite. */
  mirrorSymmetric: boolean;
}

export interface RosacePreset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  config: RosaceConfig;
}

export interface SavedRosace {
  id: string;
  name: string;
  config: RosaceConfig;
  createdAt: string;
  stitches: number;
}

export const DEFAULT_CONFIG: RosaceConfig = {
  structure: 2,
  trace: 3,
  density: 3,
  scale: 3,
  paletteShift: 1,
  geometry: 1,
  twist: 1,
  wave: 1,
  seed: 7,
  palette: [...DEFAULT_PALETTE],
  fabric: "naturel",
  aida: 14,
  strands: 2,
  wastePercent: 15,
};

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  structure: "Structure",
  trace: "Tracé",
  density: "Densité",
  scale: "Échelle",
  paletteShift: "Palette",
  geometry: "Géométrie",
};

export const DIMENSION_NAMES: Record<DimensionKey, string[]> = {
  structure: ["Sceau", "Étoile", "Rosace", "Vitrail", "Soleil"],
  trace: ["Corolle", "Gothique", "Courbe", "Herbier", "Céleste"],
  density: ["Ajourée", "Légère", "Équilibrée", "Riche", "Tapisserie"],
  scale: ["Miniature", "Fin", "Moyen", "Ample", "Monumental"],
  paletteShift: ["Douce", "Tournée", "Croisée", "Renversée", "Inversée"],
  geometry: ["Corolle", "Mandala", "Arabesque", "Kaléidoscope", "Entrelacs", "Fractale"],
};

export const STRUCTURE_NAMES = DIMENSION_NAMES.structure;
export const TRACE_NAMES = DIMENSION_NAMES.trace;
export const GEOMETRY_NAMES = DIMENSION_NAMES.geometry;
export const GEOMETRY_COUNT = GEOMETRY_NAMES.length;
export const SYMBOLS = ["×", "•", "◆", "■", "▲", "+"];
export const GRID_SIZES = [81, 91, 101, 111, 121];
export const FABRIC_COLORS: Record<FabricTone, { base: string; warp: string; name: string }> = {
  naturel: { base: "#eee8dc", warp: "#cfc5b3", name: "Lin naturel" },
  craie: { base: "#f8f6f0", warp: "#dedbd2", name: "Lin craie" },
  brume: { base: "#eee7e7", warp: "#d4c8ca", name: "Lin brume" },
};

const SYMMETRIES = [6, 8, 10, 12, 14];
const TAU = Math.PI * 2;

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

export function normalizeConfig(value: Partial<RosaceConfig> | null | undefined): RosaceConfig {
  const source = value ?? {};
  const palette = Array.isArray(source.palette)
    ? source.palette.map((code) => resolveThreadCode(code)).filter((code): code is string => code !== null).slice(0, 6)
    : [...DEFAULT_CONFIG.palette];
  const aida = [14, 16, 18].includes(Number(source.aida)) ? (Number(source.aida) as AidaCount) : 14;
  const wasteValue = Number(source.wastePercent ?? 15);
  const fabric = ["naturel", "craie", "brume"].includes(source.fabric ?? "")
    ? (source.fabric as FabricTone)
    : "naturel";
  return {
    structure: clampInt(source.structure, 1, 5, 3),
    trace: clampInt(source.trace, 1, 5, 3),
    density: clampInt(source.density, 1, 5, 3),
    scale: clampInt(source.scale, 1, 5, 3),
    paletteShift: clampInt(source.paletteShift, 1, 5, 1),
    geometry: clampInt(source.geometry, 1, GEOMETRY_COUNT, 1),
    twist: clampInt(source.twist, 1, 5, 1),
    wave: clampInt(source.wave, 1, 5, 1),
    seed: clampInt(source.seed, 1, 9999, 7),
    palette: palette.length >= 3 ? palette : [...DEFAULT_PALETTE],
    fabric,
    aida,
    strands: clampInt(source.strands, 1, 6, 2),
    wastePercent: Number.isFinite(wasteValue) ? Math.max(0, Math.min(50, Math.round(wasteValue / 5) * 5)) : 15,
  };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapCentered(angle: number, period: number) {
  return ((angle + period / 2) % period + period) % period - period / 2;
}

interface PetalField {
  inside: boolean;
  edge: boolean;
  t: number;
  band: number;
  width: number;
  u: number;
  v: number;
}

function petalField(
  radius: number,
  delta: number,
  start: number,
  end: number,
  maxWidth: number,
  exponent: number,
  unit: number,
  modulation: number,
): PetalField {
  const u = radius * Math.cos(delta);
  const v = radius * Math.sin(delta);
  const t = (u - start) / (end - start);
  if (t < 0 || t > 1) {
    return { inside: false, edge: false, t, band: 2, width: 0, u, v };
  }
  const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * t)), exponent);
  const width = maxWidth * envelope * (1 + modulation * Math.sin(3 * Math.PI * t));
  const distance = width - Math.abs(v);
  return {
    inside: distance >= 0,
    edge: distance >= 0 && (distance < unit * 0.92 || t < 0.018 || t > 0.985),
    t,
    band: width > 0 ? Math.abs(v) / width : 2,
    width,
    u,
    v,
  };
}

function roleToPalette(role: number, paletteLength: number, shift: number) {
  return (role + shift - 1) % paletteLength;
}

/** Fil de la palette qui joue un rôle donné (0 contours, 1 corolle secondaire, 2 dentelle, 3 perles, 4 lumières, 5 accent). */
export function paletteIndexForRole(config: RosaceConfig, role: number) {
  return roleToPalette(role, config.palette.length, config.paletteShift);
}

/**
 * Familles géométriques supplémentaires. Elles partagent le même moteur, la même
 * grille, les mêmes couleurs et le même contrôle de brodabilité que la corolle.
 * Les fonctions angulaires utilisent des cosinus entiers et des valeurs absolues :
 * la symétrie gauche-droite est conservée pour toutes les structures et tous les tracés.
 */
interface GeometryContext {
  geometry: number;
  symmetry: number;
  sector: number;
  trace: number;
  density: number;
  unit: number;
  phase: number;
  ringCount: number;
  weaveFrequency: number;
  fractalDepth: number;
  outerWidth: number;
  exponent: number;
  innerPhase: number;
  paletteLength: number;
}

function geometryRole(
  ctx: GeometryContext,
  radius: number,
  rg: number,
  theta: number,
  delta: number,
  otherDelta: number,
): number {
  const absDelta = Math.abs(delta);
  const fold = Math.min(1, absDelta / (ctx.sector / 2));
  const foldOther = Math.min(1, Math.abs(otherDelta) / (ctx.sector / 2));
  const rings = ctx.ringCount;
  const ringFloat = Math.max(0, Math.min(rings - 0.0001, rg * rings));
  const ring = Math.floor(ringFloat);
  const local = ringFloat - ring;
  const u = rg * Math.cos(absDelta);
  const v = rg * Math.sin(absDelta);
  const star = Math.abs(Math.cos(ctx.symmetry * theta / 2));
  const spoke = Math.abs(Math.cos(ctx.symmetry * theta));
  const lace = Math.sin(local * (8 + ctx.trace * 2) + fold * 5 + ctx.innerPhase);
  const accent = ctx.paletteLength > 5 ? 5 : 4;
  const outer = Math.max(radius, rg);
  let role = -1;

  if (ctx.geometry === 2) {
    // Mandala : anneaux, rayons et losanges concentriques.
    if (local < 0.12 + ctx.unit * 2 || local > 0.88 - ctx.unit * 2) role = 0;
    if (fold < 0.10 + ctx.density * 0.012) role = 1;
    const diamond = Math.abs(fold - 0.5) + Math.abs(local - 0.5);
    if (diamond < 0.28 + ctx.density * 0.02) role = 2;
    if (ctx.density >= 2 && lace > 0.15) role = 3;
    if (ctx.density >= 4 && fold > 0.25 && fold < 0.45) role = 1;
    if (ring % 2 === 0 && ctx.trace >= 3 && fold > 0.72) role = accent;
    if (rg < 0.09) role = accent;
    if (outer > 0.92) role = 0;
  } else if (ctx.geometry === 3) {
    // Arabesque : ogives entrecroisées et festons.
    const arc1 = Math.abs(rg - (0.60 + 0.10 * star));
    const arc2 = Math.abs(rg - (0.40 + 0.08 * spoke));
    if (arc1 < ctx.unit * 1.3) role = 0;
    if (arc2 < ctx.unit * 1.3) role = 1;
    if (foldOther < 0.12 + ctx.density * 0.008) role = 2;
    const petal = petalField(rg, absDelta, 0.16, 0.84, ctx.outerWidth * 0.9, ctx.exponent, ctx.unit, 0);
    if (petal.inside) {
      if (petal.edge) role = 0;
      else if (ctx.density >= 2 && Math.sin(petal.t * 14 + ctx.innerPhase) > 0.1) role = 3;
    }
    if (ctx.density >= 3 && lace > 0.3) role = 2;
    if (rg < 0.08) role = accent;
    if (outer > 0.93) role = 0;
  } else if (ctx.geometry === 4) {
    // Kaléidoscope : miroirs en coins, losanges et facettes alternées.
    const facet = Math.abs(Math.sin(ctx.symmetry * theta / 2));
    const diamond = Math.abs(fold - 0.5) + Math.abs(local - 0.5);
    if (Math.abs(local - 0.5) < 0.06 + ctx.unit) role = 0;
    if (fold < 0.07 || fold > 0.93) role = 1;
    if (diamond < 0.26 + ctx.trace * 0.01) role = 2;
    if (facet > 0.8 && ctx.density >= 2) role = accent;
    if (ctx.density >= 3 && lace > 0.55) role = 3;
    if (ctx.density === 5 && diamond < 0.14) role = accent;
    if (rg < 0.07) role = accent;
    if (outer > 0.93) role = 0;
  } else if (ctx.geometry === 5) {
    // Entrelacs : trame tissée, nœuds réguliers, croisements lumineux.
    const weaveA = Math.abs(Math.sin(u * ctx.weaveFrequency + ctx.phase));
    const weaveB = Math.abs(Math.sin(v * ctx.weaveFrequency - ctx.phase));
    const line = 0.16 + ctx.density * 0.012 + ctx.trace * 0.004;
    if (weaveA < line) role = 0;
    if (weaveB < line) role = 1;
    if (weaveA < line && weaveB < line) role = accent;
    if (ctx.density >= 2 && Math.sin((u + Math.abs(v)) * ctx.weaveFrequency * 0.6 + ctx.innerPhase) > 0.2) role = 2;
    if (ctx.density >= 4 && Math.abs(Math.sin((u - Math.abs(v)) * ctx.weaveFrequency * 0.5)) < 0.18) role = 3;
    if (rg < 0.07) role = accent;
    if (outer > 0.94) role = 0;
  } else {
    // Fractale : une étoile emboîtée, répétée à chaque changement d'échelle.
    const level = Math.min(ctx.fractalDepth - 1, Math.max(0, Math.floor(-Math.log2(Math.max(rg, 0.015)))));
    const scale = Math.pow(2, -level);
    const localRadius = Math.min(0.999, rg / scale);
    const starRadius = 0.26 + 0.24 * star + ctx.trace * 0.01;
    if (Math.abs(localRadius - starRadius) < 0.055 + ctx.unit * 1.5) role = level % 2 === 0 ? 0 : 1;
    if (fold < 0.06 + level * 0.008) role = 2;
    if (localRadius < starRadius && ctx.density >= 2 && lace > 0.45) role = 3;
    if (Math.abs(localRadius - 0.5) < 0.03) role = accent;
    if (ctx.density >= 4 && localRadius > starRadius && lace > 0.85) role = accent;
    if (rg < 0.04) role = accent;
    if (outer > 0.94) role = 0;
  }

  return Math.min(role, 5);
}

export function generateRosace(input: Partial<RosaceConfig>): RosacePattern {
  const config = normalizeConfig(input);
  const size = GRID_SIZES[config.scale - 1];
  const center = (size - 1) / 2;
  const unit = 1 / center;
  const cells = new Int16Array(size * size);
  cells.fill(-1);
  const roles = new Int8Array(size * size);
  roles.fill(-1);
  const random = seededRandom(config.seed * 7919 + config.structure * 131 + config.trace * 17);
  const symmetry = SYMMETRIES[config.structure - 1];
  const sector = TAU / symmetry;
  // Aucune rotation aléatoire : la rosace reste exactement symétrique gauche-droite, ce qui facilite le comptage.
  const vineAmplitude = 0.03 + random() * 0.05;
  const outerLength = 0.875 + random() * 0.045;
  const outerWidth = 0.125 + random() * 0.025;
  const exponent = [0.68, 1.08, 0.84, 0.74, 1.18][config.trace - 1];
  const modulation = (random() - 0.5) * 0.11;
  const innerPhase = random() * TAU;
  const ringOffset = (random() - 0.5) * 0.025;
  const beadRadius = 0.79 + random() * 0.035;
  const paletteLength = config.palette.length;
  const color = (role: number) => roleToPalette(role, paletteLength, config.paletteShift);

  // RNG séparé : les familles géométriques ne consomment pas la séquence aléatoire
  // de la corolle classique, donc la recette par défaut reste bit à bit identique.
  const geometryRandom = config.geometry === 1 ? null : seededRandom(config.seed * 104729 + config.geometry * 8191);
  const geometryContext: GeometryContext | null = geometryRandom
    ? {
        geometry: config.geometry,
        symmetry,
        sector,
        trace: config.trace,
        density: config.density,
        unit,
        phase: geometryRandom() * TAU,
        ringCount: 5 + config.trace + Math.floor(geometryRandom() * 2),
        weaveFrequency: 18 + Math.floor(geometryRandom() * 8),
        fractalDepth: 4 + Math.floor(geometryRandom() * 2),
        outerWidth,
        exponent,
        innerPhase,
        paletteLength,
      }
    : null;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x - center) * unit;
      const ny = (y - center) * unit;
      const radius = Math.hypot(nx, ny);
      if (radius > 0.965) continue;

      // Tourbillon : chaque rayon est tourné d'un peu plus que le précédent → spirale.
      const twist = (config.twist - 1) * 0.052;
      const baseTheta = Math.atan2(ny, nx) + Math.PI / 2;
      // Ondulation : le rayon respire en éventail, sans casser la symétrie.
      const ripple = 1 + (config.wave - 1) * 0.019 * Math.cos(symmetry * baseTheta * 2 + innerPhase);
      const theta = baseTheta + twist * radius;
      let rg = radius * ripple;
      let delta = wrapCentered(theta, sector);
      let otherDelta = delta >= 0 ? delta - sector / 2 : delta + sector / 2;
      let geometryTheta = baseTheta;
      if (geometryContext) {
        // Angle replié sur le demi-plan droit : les deux moitiés du tambour reçoivent
        // exactement la même consigne, sans approximation de virgule flottante.
        geometryTheta = Math.atan2(ny, Math.abs(nx)) + Math.PI / 2;
        // Les familles géométriques gardent une modulation radiale symétrique
        // et n'appliquent pas le décalage angulaire du tourbillon classique.
        delta = wrapCentered(geometryTheta, sector);
        otherDelta = delta >= 0 ? delta - sector / 2 : delta + sector / 2;
        const waveMod = 1 + (config.wave - 1) * 0.018 * Math.cos(symmetry * geometryTheta / 2);
        const twistMod = (config.twist - 1) * 0.03 * Math.cos(symmetry * geometryTheta);
        rg = Math.max(0, radius * waveMod + twistMod);
      }
      let role = -1;

      if (geometryContext) {
        role = geometryRole(geometryContext, radius, rg, geometryTheta, delta, otherDelta);
      } else {
      // Halo extérieur : croix isolées volontaires, perles et petites étoiles.
      const haloDelta = wrapCentered(theta, sector / 2);
      const haloDistance = Math.abs(radius - (beadRadius + 0.12 + ringOffset));
      if (haloDistance < unit * 0.72 && Math.abs(haloDelta) * radius < unit * 1.2) {
        role = paletteLength > 5 ? 5 : config.trace === 5 ? 4 : 3;
      }
      if (
        config.trace >= 3 &&
        Math.abs(radius - 0.865) < unit * 0.55 &&
        Math.abs(wrapCentered(theta + sector / 4, sector / 2)) * radius < unit * 0.75
      ) {
        role = 4;
      }

      // Liane festonnée reliant les pétales, visible dans les parties ajourées.
      const vineRadius = 0.69 + vineAmplitude * Math.cos(symmetry * theta * 2);
      if (Math.abs(rg - vineRadius) < unit * 0.55 && Math.abs(delta) > sector * 0.27) {
        role = config.trace === 4 ? 3 : 0;
      }

      // Corolle secondaire, décalée d'un demi-segment.
      const secondary = petalField(
        rg,
        otherDelta,
        0.15,
        0.665 + ringOffset,
        outerWidth * (config.trace === 2 ? 0.64 : 0.79),
        exponent * 0.92,
        unit,
        -modulation,
      );
      if (secondary.inside) {
        if (secondary.edge) role = 1;
        else if (secondary.t > 0.77 || secondary.band > 0.73) role = 1;
        else if (secondary.band < 0.17 && secondary.t > 0.22) role = 4;
        else if (config.density >= 2 && Math.sin(secondary.t * 19 + secondary.band * 5) > 0.16) role = 2;
        if (config.density >= 4 && secondary.band > 0.36 && secondary.band < 0.57 && secondary.t > 0.25) role = 1;
      }

      // Pétales principaux : contours, nervures et remplissages sont des décisions de point distinctes.
      const outer = petalField(rg, delta, 0.265, outerLength, outerWidth, exponent, unit, modulation);
      if (outer.inside) {
        if (outer.edge) role = 0;
        else if (outer.t > 0.81 || outer.band > 0.77) role = 0;
        else if (outer.t < 0.12) role = 1;
        else if (outer.band > 0.57) role = 1;
        else if (outer.band < 0.105 && outer.t > 0.18) role = config.trace === 4 ? 3 : 0;
        else {
          const lace = Math.sin(outer.t * (13 + config.trace * 2.2) + outer.band * 5 + innerPhase);
          if (config.density >= 2 && lace > 0.38) role = 2;
          if (config.density >= 3 && outer.band > 0.24 && outer.band < 0.43 && lace < -0.42) role = 1;
          if (config.density >= 4 && lace > -0.55 && outer.t > 0.23) role = 2;
          if (config.density === 5 && outer.band < 0.55 && Math.cos(outer.t * 37 + innerPhase) > 0.74) role = 4;
        }
      }

      // Fleur intérieure, dessinée en dernier pour garder la construction lisible.
      const inner = petalField(
        rg,
        delta,
        0.055,
        0.37 + ringOffset,
        outerWidth * 0.69,
        Math.max(0.62, exponent * 0.83),
        unit,
        -modulation * 0.5,
      );
      if (inner.inside) {
        if (inner.edge || inner.band > 0.72) role = 0;
        else if (inner.t > 0.68) role = 1;
        else if (inner.band < 0.22 && inner.t > 0.22) role = 4;
        else if (config.density > 1) role = inner.band > 0.43 ? 2 : 1;
      }

      // Anneaux perlés concentriques et bijou central serré.
      const middleBeads = Math.abs(rg - (0.435 + ringOffset));
      if (middleBeads < unit * 0.72 && Math.abs(wrapCentered(theta, sector / 2)) * radius < unit * 1.05) role = 4;
      if (Math.abs(rg - 0.115) < unit * 0.55 && Math.abs(wrapCentered(theta, sector)) * radius < unit * 1.4) role = 3;
      if (rg < 0.068 + 0.009 * Math.cos(symmetry * theta)) role = rg < 0.026 ? (paletteLength > 5 ? 5 : 4) : 0;
      if (rg > 0.07 && rg < 0.095 && Math.abs(delta) < sector * 0.14) role = 2;

      // Le tracé céleste ajoute une constellation ; l'herbier, de petites feuilles appariées.
      if (config.trace === 5 && rg > 0.48 && rg < 0.83) {
        const starDelta = Math.abs(wrapCentered(theta + sector / 2, sector));
        if (Math.abs(starDelta) * rg < unit * 0.65 && Math.abs(Math.sin(radius * 31 + innerPhase)) > 0.91) role = 4;
      }
      if (config.trace === 4 && outer.inside && !outer.edge && outer.t > 0.3 && outer.t < 0.75) {
        if (Math.abs(outer.band - (0.28 + 0.08 * Math.sin(outer.t * 22))) < 0.09) role = 3;
      }
      }

      if (role >= 0) {
        cells[y * size + x] = color(role);
        roles[y * size + x] = role;
      }
    }
  }

  // Brodabilité : une croix isolée asymétrique est un accident de calcul.
  // Les points isolés qui forment une paire miroir (ou le point central) sont des détails
  // volontaires : le nettoyage ne doit pas les retirer et donc pas détériorer le motif.
  let cleaned = 0;
  const isolated: number[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      if (cells[index] < 0 || roles[index] >= 3) continue;
      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dy && !dx) continue;
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= size || xx < 0 || xx >= size) continue;
          if (cells[yy * size + xx] >= 0) neighbours += 1;
        }
      }
      if (neighbours === 0) isolated.push(index);
    }
  }
  const isolatedSet = new Set(isolated);
  const preserved = new Set<number>();
  for (const index of isolated) {
    const x = index % size;
    const y = Math.floor(index / size);
    const mirrorIndex = y * size + (size - 1 - x);
    if (mirrorIndex === index || (isolatedSet.has(mirrorIndex) && roles[mirrorIndex] === roles[index])) {
      preserved.add(index);
    }
  }
  for (const index of isolated) {
    if (preserved.has(index)) continue;
    cells[index] = -1;
    cleaned += 1;
  }

  let mirrorSymmetric = true;
  for (let y = 0; y < size && mirrorSymmetric; y += 1) {
    for (let x = 0; x < center; x += 1) {
      if (cells[y * size + x] !== cells[y * size + (size - 1 - x)]) {
        mirrorSymmetric = false;
        break;
      }
    }
  }

  const stitches: Stitch[] = [];
  const counts = new Array<number>(paletteLength).fill(0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const paletteIndex = cells[y * size + x];
      if (paletteIndex >= 0) {
        stitches.push({ x, y, color: paletteIndex });
        counts[paletteIndex] += 1;
      }
    }
  }

  const usage = counts.map((count, paletteIndex) => {
    const material = computeMaterials(count, { aida: config.aida, strands: config.strands, wastePercent: config.wastePercent });
    return {
      paletteIndex,
      code: config.palette[paletteIndex],
      count,
      meters: material.needleMeters,
      strandMeters: material.strandMeters,
      skeins: material.skeins,
      usableNeedleMeters: material.skeinUsableNeedleMeters,
      symbol: SYMBOLS[paletteIndex],
    };
  });
  const pointsPerCm = config.aida / 2.54;
  const bounds = stitches.reduce((extent, stitch) => ({
    minX: Math.min(extent.minX, stitch.x),
    maxX: Math.max(extent.maxX, stitch.x),
    minY: Math.min(extent.minY, stitch.y),
    maxY: Math.max(extent.maxY, stitch.y),
  }), { minX: size, maxX: 0, minY: size, maxY: 0 });
  const motifPoints = stitches.length ? Math.max(bounds.maxX - bounds.minX + 1, bounds.maxY - bounds.minY + 1) : size;
  const motifCm = Math.round((motifPoints / pointsPerCm) * 10) / 10;
  const cutCm = Math.ceil(motifCm + 12);
  const timeEstimate = estimateTime(stitches.length);
  const minutes = timeEstimate.median;
  const totalNeedleMeters = Math.round(usage.reduce((sum, line) => sum + line.meters, 0) * 10) / 10;
  const totalStrandMeters = Math.round(usage.reduce((sum, line) => sum + line.strandMeters, 0) * 10) / 10;
  const totalSkeins = usage.reduce((sum, line) => sum + line.skeins, 0);
  const motifWidthCm = stitches.length ? Math.round(((bounds.maxX - bounds.minX + 1) / pointsPerCm) * 10) / 10 : 0;
  const motifHeightCm = stitches.length ? Math.round(((bounds.maxY - bounds.minY + 1) / pointsPerCm) * 10) / 10 : 0;

  return { config, size, cells, stitches, usage, motifPoints, motifCm, cutCm, minutes, timeEstimate, totalNeedleMeters, totalStrandMeters, totalSkeins, motifWidthCm, motifHeightCm, cleaned, mirrorSymmetric };
}

export function getSymmetry(config: RosaceConfig) {
  return SYMMETRIES[config.structure - 1];
}

export function getPatternName(config: RosaceConfig) {
  const base = `${getSymmetry(config)} pétales · tracé ${TRACE_NAMES[config.trace - 1].toLowerCase()}`;
  return config.geometry === 1 ? base : `${base} · ${GEOMETRY_NAMES[config.geometry - 1].toLowerCase()}`;
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${String(rest).padStart(2, "0")}` : `${rest} min`;
}

export const PRESETS: RosacePreset[] = [
  {
    id: "grenat",
    name: "Jardin de grenat",
    subtitle: "La rosace originelle",
    description: "Une corolle de grenat et de prune, ouverte par des veinures vert perroquet sur lin naturel.",
    config: { ...DEFAULT_CONFIG },
  },
  {
    id: "ciel",
    name: "Fleur du Ciel",
    subtitle: "Collection signature",
    description: "Douze pétales célestes, des étoiles de paille dorée et un dégradé de bleus profonds inspiré des vitraux nocturnes.",
    config: { ...DEFAULT_CONFIG, structure: 4, trace: 5, density: 4, scale: 4, seed: 42, palette: ["333", "340", "3755", "677", "3821"] },
  },
  {
    id: "aube",
    name: "Aube de lin",
    subtitle: "Étude en douceur",
    description: "Terre cuite claire, saumon et paille sur lin craie : une rosace souple pensée pour un petit tambour de débutante.",
    config: { ...DEFAULT_CONFIG, structure: 2, trace: 1, density: 2, scale: 2, seed: 18, palette: ["3778", "3716", "738", "3023", "3822"], fabric: "craie" },
  },
  {
    id: "herbier",
    name: "Herbier nocturne",
    subtitle: "Botanique dense",
    description: "Des feuillages avocat et chasseur traversent une architecture grenat, dans une version riche de dix pétales.",
    config: { ...DEFAULT_CONFIG, structure: 3, trace: 4, density: 5, scale: 4, seed: 108, palette: ["3345", "3347", "472", "902", "677"] },
  },
  {
    id: "cuivre",
    name: "Sable & cuivre",
    subtitle: "Géométrie solaire",
    description: "Quatorze rayons cuivrés et vieil or dessinent une rosace chaude, précise et légèrement ajourée.",
    config: { ...DEFAULT_CONFIG, structure: 5, trace: 2, density: 3, scale: 3, seed: 63, palette: ["918", "921", "3778", "676", "3823"] },
  },
  {
    id: "vitrail",
    name: "Vitrail d'hiver",
    subtitle: "Grand format",
    description: "Bleu marine, delft et violet composent un vitrail textile de douze pétales relevé de vieil or, à broder sur aïda 16.",
    config: { ...DEFAULT_CONFIG, structure: 4, trace: 3, density: 4, scale: 5, seed: 212, palette: ["823", "799", "3752", "550", "677"], aida: 16, fabric: "craie" },
  },
  {
    id: "mandala",
    name: "Mandala de brume",
    subtitle: "Géométrie · 1/5",
    description: "Anneaux concentriques et losanges répétés : une lecture radiale du cercle, disponible sur les cinq structures de pétales.",
    config: { ...DEFAULT_CONFIG, geometry: 2, structure: 3, trace: 2, density: 3, scale: 3, seed: 314, palette: ["3755", "340", "677", "822", "3023"], fabric: "brume" },
  },
  {
    id: "arabesque",
    name: "Arabesque cuivrée",
    subtitle: "Géométrie · 2/5",
    description: "Ogives entrecroisées et festons : une architecture souple qui conserve la symétrie du tambour.",
    config: { ...DEFAULT_CONFIG, geometry: 3, structure: 4, trace: 4, density: 4, scale: 4, seed: 418, palette: ["918", "921", "3778", "676", "3823"] },
  },
  {
    id: "kaleidoscope",
    name: "Kaléidoscope boréal",
    subtitle: "Géométrie · 3/5",
    description: "Facettes en diamant et miroirs successifs : chaque secteur répond au voisin comme un vitrail taillé.",
    config: { ...DEFAULT_CONFIG, geometry: 4, structure: 5, trace: 1, density: 5, scale: 4, seed: 520, palette: ["823", "799", "3752", "550", "677"], fabric: "craie" },
  },
  {
    id: "entrelacs",
    name: "Entrelacs de lin",
    subtitle: "Géométrie · 4/5",
    description: "Trame tissée et nœuds réguliers : une rosace pensée comme un ouvrage de passementerie.",
    config: { ...DEFAULT_CONFIG, geometry: 5, structure: 2, trace: 3, density: 3, scale: 3, seed: 626, palette: ["902", "3607", "3608", "907", "677"], fabric: "craie" },
  },
  {
    id: "fractale",
    name: "Fractale grenat",
    subtitle: "Géométrie · 5/5",
    description: "Étoiles emboîtées du centre vers la couronne : la même règle géométrique se répète à plusieurs échelles.",
    config: { ...DEFAULT_CONFIG, geometry: 6, structure: 3, trace: 5, density: 4, scale: 5, seed: 732, palette: ["902", "3607", "3608", "907", "310"] },
  },
];

/** Deux recettes sont identiques lorsque tous leurs paramètres normalisés le sont (graine et fils compris). */
export function sameRecipe(a: RosaceConfig, b: RosaceConfig) {
  return JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b));
}

/** Nom lisible d'une recette : celui de l'étude si c'en est une, sinon dérivé de sa structure et de son tracé. */
export function getRecipeTitle(config: RosaceConfig) {
  const preset = PRESETS.find((entry) => sameRecipe(entry.config, config));
  if (preset) return preset.name;
  const base = `${STRUCTURE_NAMES[config.structure - 1]} ${TRACE_NAMES[config.trace - 1].toLowerCase()}`;
  return config.geometry === 1 ? base : `${GEOMETRY_NAMES[config.geometry - 1]} ${base}`;
}

export function encodeConfig(config: RosaceConfig) {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function decodeConfig(encoded: string): RosaceConfig | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return normalizeConfig(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
