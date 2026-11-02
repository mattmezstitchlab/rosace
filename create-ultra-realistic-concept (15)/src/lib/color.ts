import { getThread } from "../data/dmc";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((character) => character + character).join("") : normalized;
  const value = Number.parseInt(full, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function mix(hex: string, target: string, amount: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const channel = (start: number, end: number) => Math.round(start + (end - start) * amount);
  return `rgb(${channel(a.r, b.r)}, ${channel(a.g, b.g)}, ${channel(a.b, b.b)})`;
}

export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function linear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab({ r, g, b }: Rgb) {
  const R = linear(r);
  const G = linear(g);
  const B = linear(b);
  const transform = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = transform((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = transform(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = transform((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

/** Écart perceptuel CIE76 entre deux couleurs écran. */
export function deltaE(hexA: string, hexB: string) {
  const a = rgbToLab(hexToRgb(hexA));
  const b = rgbToLab(hexToRgb(hexB));
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

export interface PaletteWarning {
  kind: "threads" | "fabric";
  codes: string[];
  message: string;
}

const THREAD_THRESHOLD = 9;
// Un fil très clair sur une toile claire se perd : seuil élargi pour ce seul cas.
const FABRIC_THRESHOLD = 12;

/** Signale les fils presque indiscernables entre eux ou de la toile. Indicatif : les valeurs sont celles de l'écran. */
export function auditPalette(palette: string[], fabricHex: string, fabricName: string): PaletteWarning[] {
  const warnings: PaletteWarning[] = [];
  for (let i = 0; i < palette.length; i += 1) {
    for (let j = i + 1; j < palette.length; j += 1) {
      const distance = deltaE(getThread(palette[i]).hex, getThread(palette[j]).hex);
      if (distance < THREAD_THRESHOLD) {
        warnings.push({
          kind: "threads",
          codes: [palette[i], palette[j]],
          message: `DMC ${palette[i]} et DMC ${palette[j]} sont presque identiques à l'écran : leurs croix seront difficiles à distinguer.`,
        });
      }
    }
  }
  palette.forEach((code) => {
    if (deltaE(getThread(code).hex, fabricHex) < FABRIC_THRESHOLD) {
      warnings.push({
        kind: "fabric",
        codes: [code],
        message: `DMC ${code} est très proche du ${fabricName.toLowerCase()} : ses croix se verront à peine à l'écran, et difficilement à la broder.`,
      });
    }
  });
  return warnings;
}
