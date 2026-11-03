import { DMC_ALL_THREADS } from "../../data/dmc";

/**
 * Catalogue de fils vu par les moteurs d'import PDF.
 *
 * Point Zéro indexe ses cases par position dans un tableau `FLOSS` ; ROSACE indexe les
 * siennes par position dans la palette de l'ouvrage. Ce fichier donne aux moteurs copiés
 * leur `FLOSS` attendu, construit depuis l'unique catalogue ROSACE (489 références,
 * MakeBead craft-color-codes, CC BY 4.0) : une seule source de couleurs dans l'application.
 *
 * Différence volontaire avec Point Zéro : aucun `registerBlend`. Un mélange de fils
 * (`mix:a/n+b/m`) n'est pas reconnu : il est compté parmi les pertes (`lost.blends`) et
 * signalé avant validation, jamais aplati en silence.
 */
type Lab = [number, number, number];

export interface Floss {
  code: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
  lab: Lab;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function srgbToLab(rgb: [number, number, number]): Lab {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = lin(rgb[0]);
  const G = lin(rgb[1]);
  const B = lin(rgb[2]);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const FLOSS: readonly Floss[] = DMC_ALL_THREADS.map((thread) => {
  const rgb = hexToRgb(thread.hex);
  return { code: thread.code, name: thread.name, hex: thread.hex, rgb, lab: srgbToLab(rgb) };
});

const BY_CODE = new Map(FLOSS.map((floss, index) => [floss.code, index] as const));
const BY_LOWER = new Map(FLOSS.map((floss, index) => [floss.code.toLowerCase(), index] as const));

/** Index du fil dans `FLOSS`, −1 si inconnu (les mélanges sont inconnus). */
export function flossIndex(code: string): number {
  const trimmed = code.trim();
  return BY_CODE.get(trimmed) ?? BY_LOWER.get(trimmed.toLowerCase()) ?? -1;
}

export const isBlendCode = (code: string) => /^mix:/i.test(code.trim());

export function labOf(rgb: [number, number, number]): Lab {
  return srgbToLab(rgb);
}

// CIEDE2000, Sharma, Wu & Dalal (2005). Copié de Point Zéro (studio/src/lib/colorScience.ts).
const rad = (v: number) => v * Math.PI / 180;
const hue = (a: number, b: number) => a === 0 && b === 0 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
export function deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2), C = (c1 + c2) / 2;
  const g = .5 * (1 - Math.sqrt(C ** 7 / (C ** 7 + 25 ** 7)));
  const ap1 = a1 * (1 + g), ap2 = a2 * (1 + g);
  const cp1 = Math.hypot(ap1, b1), cp2 = Math.hypot(ap2, b2);
  const h1 = hue(ap1, b1), h2 = hue(ap2, b2);
  let dh = cp1 * cp2 === 0 ? 0 : h2 - h1;
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin(rad(dh / 2));
  const lp = (L1 + L2) / 2, cp = (cp1 + cp2) / 2;
  let hp = h1 + h2;
  if (cp1 * cp2 !== 0) { if (Math.abs(h1 - h2) > 180) hp += hp < 360 ? 360 : -360; hp /= 2; }
  const T = 1 - .17 * Math.cos(rad(hp - 30)) + .24 * Math.cos(rad(2 * hp)) + .32 * Math.cos(rad(3 * hp + 6)) - .2 * Math.cos(rad(4 * hp - 63));
  const sl = 1 + .015 * (lp - 50) ** 2 / Math.sqrt(20 + (lp - 50) ** 2);
  const sc = 1 + .045 * cp, sh = 1 + .015 * cp * T;
  const rt = -2 * Math.sqrt(cp ** 7 / (cp ** 7 + 25 ** 7)) * Math.sin(rad(60 * Math.exp(-(((hp - 275) / 25) ** 2))));
  const dl = (L2 - L1) / sl, dc = (cp2 - cp1) / sc, d = dH / sh;
  return Math.sqrt(dl * dl + dc * dc + d * d + rt * dc * d);
}

/** Les `limit` fils les plus proches par CIEDE2000, du plus petit écart au plus grand. */
export function nearestFlossList(lab: Lab, limit = 3, pool?: number[]): { idx: number; deltaE: number }[] {
  const indices = pool ?? FLOSS.map((_, i) => i);
  return indices
    .map((idx) => ({ idx, deltaE: deltaE2000(lab, FLOSS[idx].lab) }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, Math.max(0, limit));
}

/** Fil le plus proche par CIEDE2000, éventuellement dans un sous-ensemble. */
export function nearestFloss(lab: Lab, pool?: number[]): number {
  return nearestFlossList(lab, 1, pool)[0]?.idx ?? 0;
}
