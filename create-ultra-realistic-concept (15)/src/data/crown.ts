import { hexToRgb } from "../lib/color";
import { DMC_ALL_THREADS, type DmcThread } from "./dmc";

function hsl(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: saturation, l: lightness };
}

/**
 * Toutes les références du catalogue, rangées en couronne : neutres du plus clair au plus foncé,
 * puis teintes par bandes de 10° (jaunes, verts, bleus, violets, roses, rouges, oranges), du clair au foncé.
 * Aucune référence n'est ajoutée ni inventée : c'est exactement DMC_ALL_THREADS, réordonné.
 */
export const CROWN_THREADS: DmcThread[] = (() => {
  const items = DMC_ALL_THREADS.map((thread) => ({ thread, ...hsl(thread.hex) }));
  const neutrals = items.filter((item) => item.s < 0.14).sort((a, b) => b.l - a.l);
  const chromatic = items
    .filter((item) => item.s >= 0.14)
    .map((item) => ({ ...item, band: Math.floor(((item.h - 50 + 360) % 360) / 10) }))
    .sort((a, b) => a.band - b.band || b.l - a.l);
  return [...neutrals, ...chromatic].map((item) => item.thread);
})();

export const CROWN_INDEX = new Map(CROWN_THREADS.map((thread, index) => [thread.code, index]));
