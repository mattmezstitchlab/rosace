import { DMC_ALL_THREADS, getThread, type DmcThread } from "../data/dmc";
import { deltaE, hexToRgb } from "./color";

/**
 * Harmonies de couleur calculées en OKLCH, puis ramenées aux fils DMC réels.
 * Références : formules classiques du cercle chromatique appliquées au wheel OKLCH
 * (complémentaire 180°, analogue ±30°, triade 120/240°, complémentaire divisée 150/210°)
 * et mesure perceptuelle CIEDE2000 pour trouver l'échevette la plus proche.
 */
export type Harmony = "analogue" | "complementaire" | "triade" | "split" | "monochrome";

export const HARMONY_LABELS: Record<Harmony, string> = {
  analogue: "Analogue",
  complementaire: "Complémentaire",
  triade: "Triade",
  split: "Rompue",
  monochrome: "Monochrome",
};

export const HARMONY_HINT: Record<Harmony, string> = {
  analogue: "Des voisines de teinte : une famille calme.",
  complementaire: "La teinte opposée : le contraste le plus franc.",
  triade: "Trois tiers du cercle : une palette vive.",
  split: "Deux voisines de la complémentaire : du contraste sans heurt.",
  monochrome: "Une seule teinte, du plus sombre au plus clair.",
};

/** Décalages de teinte par rôle : 0 contours, 1 corolle, 2 corps, 3 perles, 4 lumières. */
const OFFSETS: Record<Harmony, number[]> = {
  analogue: [-24, -10, 0, 16, 30],
  complementaire: [0, 12, 0, 180, 195],
  triade: [240, 120, 0, 120, 240],
  split: [0, 150, 0, 210, 45],
  monochrome: [0, 0, 0, 0, 0],
};

interface Oklch { l: number; c: number; h: number }

function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex);
  const lin = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

function oklchToRgb({ l, c, h }: Oklch) {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const R = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const G = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const B = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  const gam = (value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(255, Math.max(0, srgb * 255)));
  };
  return { r: gam(R), g: gam(G), b: gam(B) };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function toHex(color: Oklch) {
  return rgbToHex(oklchToRgb(color));
}

/** CIEDE2000 : distance perceptuelle de référence pour rapprocher une cible d'un fil réel. */
export function ciede2000(hexA: string, hexB: string) {
  const lab = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const lin = (value: number) => {
      const v = value / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const R = lin(r);
    const G = lin(g);
    const B = lin(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X);
    const fy = f(Y);
    const fz = f(Z);
    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  };
  const A = lab(hexA);
  const B = lab(hexB);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(A.a, A.b);
  const C2 = Math.hypot(B.a, B.b);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1 = (1 + G) * A.a;
  const a2 = (1 + G) * B.a;
  const C1p = Math.hypot(a1, A.b);
  const C2p = Math.hypot(a2, B.b);
  const hp = (b: number, ap: number) => {
    if (b === 0 && ap === 0) return 0;
    const h = (Math.atan2(b, ap) / rad + 360) % 360;
    return h;
  };
  const h1 = hp(A.b, a1);
  const h2 = hp(B.b, a2);
  const dL = B.L - A.L;
  const dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p !== 0) {
    dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * rad) / 2);
  const Lbar = (A.L + B.L) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbar = h1 + h2;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1 - h2) <= 180) hbar = (h1 + h2) / 2;
    else if (h1 + h2 < 360) hbar = (h1 + h2 + 360) / 2;
    else hbar = (h1 + h2 - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hbar - 30) * rad) + 0.24 * Math.cos(2 * hbar * rad) + 0.32 * Math.cos((3 * hbar + 6) * rad) - 0.2 * Math.cos((4 * hbar - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

export interface HarmonyStop {
  role: number;
  code: string;
  thread: DmcThread;
  label: string;
}

export const ROLE_LABELS = ["Contours", "Corolle", "Corps", "Perles", "Lumières"];
const ROLE_L = [0.34, 0.46, null, 0.76, 0.88] as const;
const ROLE_C = [1, 0.98, null, 0.72, 0.5] as const;

function nearestThread(target: string, used: Set<string>, fabricHex: string, mustRead: boolean) {
  const ranked = DMC_ALL_THREADS
    .filter((thread) => !used.has(thread.code))
    .map((thread) => {
      const fabricDistance = deltaE(thread.hex, fabricHex);
      const penalty = mustRead && fabricDistance < 14 ? (14 - fabricDistance) * 2.2 : 0;
      return { thread, score: ciede2000(target, thread.hex) + penalty };
    })
    .sort((a, b) => a.score - b.score);
  return ranked[0]?.thread ?? getThread("310");
}

/**
 * Construit une palette de cinq vrais fils DMC à partir d'un fil de départ et d'une harmonie.
 * Le fil cliqué devient le corps du motif (rôle le plus rempli) : un clic suffit donc à
 * voir la rosace dans la couleur choisie, entourée de sa complémentaire ou de ses analogues.
 */
export function buildHarmonyPalette(baseCode: string, harmony: Harmony, fabricHex: string): HarmonyStop[] {
  const base = getThread(baseCode);
  const source = hexToOklch(base.hex);
  const offsets = OFFSETS[harmony];
  const used = new Set<string>([baseCode]);
  const stops: HarmonyStop[] = [];

  // Le rôle 2 reçoit exactement le fil choisi.
  for (let role = 0; role < 5; role += 1) {
    if (role === 2) {
      stops.push({ role, code: base.code, thread: base, label: ROLE_LABELS[role] });
      continue;
    }
    const l = ROLE_L[role] ?? source.l;
    const chroma = Math.min(0.19, Math.max(0.035, source.c * (ROLE_C[role] ?? 1)));
    const hue = (source.h + offsets[role] + 360) % 360;
    const target = toHex({ l, c: chroma, h: hue });
    const thread = nearestThread(target, used, fabricHex, role >= 3);
    used.add(thread.code);
    stops.push({ role, code: thread.code, thread, label: ROLE_LABELS[role] });
  }
  return stops;
}

export function harmonyFromPalette(palette: string[], fabricHex: string, harmony: Harmony) {
  const base = palette[2] ?? palette[0];
  return buildHarmonyPalette(base, harmony, fabricHex);
}

/** Palette DMC d'une harmonie, dans l'ordre des rôles du moteur. */
export function harmonyCodes(baseCode: string, harmony: Harmony, fabricHex: string) {
  return buildHarmonyPalette(baseCode, harmony, fabricHex).map((stop) => stop.code);
}
