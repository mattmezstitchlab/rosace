import { resolveThreadCode } from "../data/dmc";
import type { ImportedGrid } from "./work";

/**
 * Texte brodé : une phrase devient une grille de croix avec une police bitmap 5 × 7 (capitales,
 * chiffres, accents courants, ponctuation). Un ou deux fils : le texte, et une ombre portée
 * facultative décalée d'une case. Produit un `ImportedGrid` que `fromImport` valide comme les autres.
 *
 * La police est dessinée ici, libre de droits ; chaque glyphe est 5 colonnes × 7 rangées,
 * lu ligne par ligne, « # » = croix.
 *
 * Le texte est d'abord normalisé (`normalizeText`) : composition Unicode NFC, espaces insécables et
 * tabulations ramenés à l'espace, apostrophes, guillemets, tirets et points de suspension
 * typographiques ramenés à leur équivalent de la police, « œ » et « æ » développés en « OE » et « AE ».
 * Ce que la police ne connaît toujours pas est remplacé par un espace et annoncé par `unsupportedChars`.
 */
export const TEXT_MAX_CHARS = 48;
export const TEXT_MAX_LINES = 4;

const GLYPHS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  "'": [".##..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "&": [".##..", "#..#.", "#..#.", ".##..", "#.#.#", "#..#.", ".##.#"],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "♥": [".....", ".#.#.", "#####", "#####", ".###.", "..#..", "....."],
  "É": ["..#..", "#####", "#....", "####.", "#....", "#....", "#####"],
  "È": [".#...", "#####", "#....", "####.", "#....", "#....", "#####"],
  "Ê": [".###.", "#####", "#....", "####.", "#....", "#....", "#####"],
  "À": [".#...", ".###.", "#...#", "#####", "#...#", "#...#", "#...#"],
  "Â": [".###.", ".###.", "#...#", "#####", "#...#", "#...#", "#...#"],
  "Ç": [".###.", "#...#", "#....", "#....", "#...#", ".###.", "..##."],
  "Ô": [".###.", ".###.", "#...#", "#...#", "#...#", "#...#", ".###."],
  "Î": [".###.", "#####", "..#..", "..#..", "..#..", "..#..", "#####"],
  "Û": ["..#..", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "Ù": [".#...", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "Ë": ["#...#", "#####", "#....", "####.", "#....", "#....", "#####"],
  "Ï": ["#...#", "#####", "..#..", "..#..", "..#..", "..#..", "#####"],
};
const GLYPH_W = 5;
const GLYPH_H = 7;
const GAP = 1;
const LINE_GAP = 2;

export interface TextOptions {
  text: string;
  /** Code DMC du texte. */
  code: string;
  /** Code DMC de l'ombre (décalée d'une case en bas à droite), facultatif. */
  shadowCode?: string | null;
  /** Marge de cases vides autour du texte. */
  margin?: number;
  align?: "left" | "center";
}

export function supportedTextChar(char: string) {
  return char.toUpperCase() in GLYPHS;
}

/** Variantes typographiques (clavier de téléphone, copier-coller) ramenées à un caractère de la police. */
const TEXT_SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/[\u2018\u2019\u201B\u02BC\u2032]/g, "'"],
  [/[\u00AB\u00BB\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/[\u2010-\u2015\u2212]/g, "-"],
  [/\u2026/g, "..."],
  [/\u0152/g, "OE"],
  [/\u00C6/g, "AE"],
  [/\u2764/g, "\u2665"],
];

/**
 * Texte prêt à dessiner : une chaîne par ligne, sans ligne vide en tête ni en queue, au plus
 * `TEXT_MAX_LINES` lignes de `TEXT_MAX_CHARS` caractères (comptés en points de code, jamais
 * coupés au milieu d'une paire de substitution).
 */
export function normalizeText(text: string) {
  let clean = text
    .normalize("NFC")
    .replace(/[\u00AD\u200B-\u200F\u2060\uFEFF\uFE0E\uFE0F]/g, "")
    .replace(/\r\n?|[\u2028\u2029]/g, "\n")
    .replace(/[^\S\n]/g, " ")
    .toUpperCase();
  for (const [pattern, replacement] of TEXT_SUBSTITUTIONS) clean = clean.replace(pattern, replacement);
  const lines = clean.split("\n");
  const first = lines.findIndex((line) => line.trim());
  if (first < 0) return [];
  const kept = lines.slice(first, first + TEXT_MAX_LINES);
  while (!kept[kept.length - 1].trim()) kept.pop();
  return kept.map((line) => Array.from(line).slice(0, TEXT_MAX_CHARS).join(""));
}

/** Caractères que la police ne connaît pas : remplacés par un espace, mais annoncés. */
export function unsupportedChars(text: string): string[] {
  const out: string[] = [];
  for (const line of normalizeText(text)) for (const char of line) if (!supportedTextChar(char) && !out.includes(char)) out.push(char);
  return out;
}

export function textGrid(options: TextOptions): ImportedGrid | { error: string } {
  const lines = normalizeText(options.text).map((line) => line.replace(/\s+$/g, ""));
  if (!lines.some((line) => line.trim())) return { error: "Écrivez au moins une lettre." };
  const code = resolveThreadCode(options.code);
  if (!code) return { error: `Référence DMC inconnue : « ${options.code} ».` };
  const shadow = options.shadowCode ? resolveThreadCode(options.shadowCode) : null;
  if (options.shadowCode && !shadow) return { error: `Référence DMC inconnue pour l'ombre : « ${options.shadowCode} ».` };
  if (shadow === code) return { error: "L'ombre doit être d'un autre fil que le texte." };
  const margin = Math.max(0, Math.min(10, Math.round(options.margin ?? 2)));
  const lineWidths = lines.map((line) => Math.max(0, [...line].length * (GLYPH_W + GAP) - GAP));
  const textWidth = Math.max(...lineWidths, 1);
  const textHeight = lines.length * GLYPH_H + (lines.length - 1) * LINE_GAP;
  const extra = shadow ? 1 : 0;
  const width = textWidth + margin * 2 + extra;
  const height = textHeight + margin * 2 + extra;
  const cells = new Int16Array(width * height).fill(-1);
  const put = (x: number, y: number, value: number) => { if (x >= 0 && y >= 0 && x < width && y < height) cells[y * width + x] = value; };
  lines.forEach((line, row) => {
    const offsetX = margin + (options.align === "center" ? Math.floor((textWidth - lineWidths[row]) / 2) : 0);
    const offsetY = margin + row * (GLYPH_H + LINE_GAP);
    [...line].forEach((char, col) => {
      const glyph = GLYPHS[char.toUpperCase()] ?? GLYPHS[" "];
      for (let gy = 0; gy < GLYPH_H; gy += 1) for (let gx = 0; gx < GLYPH_W; gx += 1) {
        if (glyph[gy][gx] !== "#") continue;
        const x = offsetX + col * (GLYPH_W + GAP) + gx;
        const y = offsetY + gy;
        if (shadow) { const i = (y + 1) * width + (x + 1); if (cells[i] < 0) put(x + 1, y + 1, 1); }
      }
    });
  });
  // Le texte passe au-dessus de l'ombre.
  lines.forEach((line, row) => {
    const offsetX = margin + (options.align === "center" ? Math.floor((textWidth - lineWidths[row]) / 2) : 0);
    const offsetY = margin + row * (GLYPH_H + LINE_GAP);
    [...line].forEach((char, col) => {
      const glyph = GLYPHS[char.toUpperCase()] ?? GLYPHS[" "];
      for (let gy = 0; gy < GLYPH_H; gy += 1) for (let gx = 0; gx < GLYPH_W; gx += 1) {
        if (glyph[gy][gx] === "#") put(offsetX + col * (GLYPH_W + GAP) + gx, offsetY + gy, 0);
      }
    });
  });
  const colors = [{ code, symbol: "×", fromLegend: true }];
  if (shadow) colors.push({ code: shadow, symbol: "•", fromLegend: true });
  return {
    kind: "text",
    text: lines.join(" / "),
    width,
    height,
    cells,
    colors,
    provenance: { file: `Texte : ${lines.join(" / ")}`, title: lines.join(" / "), pages: 0, mode: "glyphes" },
    montage: { tiles: [], overlaps: 0, holes: 0, scaled: false },
    lost: { halfStitches: 0, quarterStitches: 0, backstitches: 0, knots: 0, blends: 0, unresolved: 0 },
  };
}
