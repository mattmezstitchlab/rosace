import { flossIndex, labOf, nearestFloss } from "./floss";
import { rectify, type Corners } from "./rectify";
import { openPdf, throwIfAborted, type PdfHandle } from "./pdfimport";
import { codeOfText } from "./pdfVector";
import { quantizePixels } from "./quantize";

/**
 * Analyse d'un patron PDF complet :
 * - pages de grille (parfois plusieurs grilles par page, découpées en blocs) ;
 * - codes DMC lus dans le texte du PDF (légende) ;
 * - symboles appariés une seule fois chacun à leur code (pas de nuage de paires) ;
 * - reconstitution en une grille unique, proportionnelle si elle dépasse la limite.
 */

export const MAX_DIM = 1000;
export const MAX_CELLS = 1_000_000;

export type PageKind = "cover" | "chart" | "legend" | "other";

export interface PdfBlock {
  id: string;
  page: number;
  /** Rectangle de la grille, en % de la page. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cols: number;
  rows: number;
  label: string;
}

export interface PageInfo {
  n: number;
  kind: PageKind;
  blocks: PdfBlock[];
  title: string;
  aspect: number;
  thumb: string;
}

export interface SymbolEntry {
  id: string;
  bits: Uint8Array;
  preview: string;
  count: number;
  code: string;
}

export interface PdfAnalysis {
  title: string;
  author: string;
  pages: PageInfo[];
  legendPage: number | null;
  legend: SymbolEntry[];
  /** Rapport largeur / hauteur du modèle couleur détecté sur la couverture. */
  modelAspect: number;
}

/** Symbole reconnu dans les grilles : code connu (légende) ou provisoire à vérifier. */
export interface RegEntry {
  id: string;
  bits: Uint8Array;
  preview: string;
  code: string;
  count: number;
}

/** Distance maximale (sur 144 bits) pour considérer deux cases comme le même symbole. */
const MATCH = 22;

const uid = () => `blk-${Math.random().toString(36).slice(2, 10)}`;
const clampInt = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v)));
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export const hamming = (a: Uint8Array, b: Uint8Array) => {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
};

/** Clé compacte (18 caractères) d'une signature 12 × 12. */
export function packKey(bits: Uint8Array): string {
  let s = "";
  for (let i = 0; i < 144; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    s += String.fromCharCode(v);
  }
  return s;
}

export function bitsPreview(bits: Uint8Array): string {
  const c = document.createElement("canvas");
  c.width = c.height = 12;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 12, 12);
  ctx.fillStyle = "#111";
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (bits[y * 12 + x]) ctx.fillRect(x, y, 1, 1);
  return c.toDataURL();
}

/** Signature 12 × 12 d'une case de 14 px (bordure de 2 px ignorée). */
export function cellBits(data: Uint8ClampedArray, width: number, x0: number, y0: number): Uint8Array {
  const bits = new Uint8Array(144);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const i = ((y0 + 2 + y) * width + x0 + 2 + x) * 4;
      bits[y * 12 + x] = data[i] + data[i + 1] + data[i + 2] < 380 ? 1 : 0;
    }
  }
  return bits;
}

export const cellInk = (bits: Uint8Array) => {
  let n = 0;
  for (let i = 0; i < 144; i++) n += bits[i];
  return n;
};

function signatureFrom(data: Uint8ClampedArray, width: number, x0: number, y0: number, bw: number, bh: number): Uint8Array {
  const bits = new Uint8Array(144);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const px = Math.min(width - 1, x0 + Math.floor((x * bw) / 12));
      const py = y0 + Math.floor((y * bh) / 12);
      const i = (py * width + px) * 4;
      bits[y * 12 + x] = data[i] + data[i + 1] + data[i + 2] < 380 ? 1 : 0;
    }
  }
  return bits;
}

/** Registre des symboles : chaque signature reçoit un index stable pendant toute la session. */
export class SymbolRegistry {
  entries: RegEntry[] = [];
  private cache = new Map<string, number>();

  addKnown(bits: Uint8Array, code: string): void {
    if (flossIndex(code) < 0) return;
    const key = packKey(bits);
    if (this.cache.has(key)) return;
    this.cache.set(key, this.entries.length);
    this.entries.push({ id: `r${this.entries.length}`, bits: bits.slice(), preview: bitsPreview(bits), code, count: 0 });
  }

  /** Cherche uniquement un symbole de légende connu. Ne crée jamais de fausse couleur. */
  matchKnown(bits: Uint8Array): number {
    let best = -1;
    let bestD = MATCH + 1;
    for (let i = 0; i < this.entries.length; i++) {
      const d = hamming(this.entries[i].bits, bits);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD <= MATCH) {
      this.entries[best].count++;
      return best;
    }
    return -1;
  }
}

/* ------------------------------ Grilles ------------------------------ */

export function rectifyBlock(canvas: HTMLCanvasElement, b: PdfBlock): HTMLCanvasElement {
  const corners: Corners = [
    { x: b.x0, y: b.y0 },
    { x: b.x1, y: b.y0 },
    { x: b.x1, y: b.y1 },
    { x: b.x0, y: b.y1 },
  ];
  return rectify(canvas, corners, b.cols, b.rows, 14);
}

/**
 * Groupe les traits d'une grille : chaque trait épais compte pour une seule ligne,
 * et un groupe devient une grille s'il compte au moins 5 lignes régulièrement espacées.
 */
const lineGroups = (counts: Uint32Array, threshold: number, maxGap: number) => {
  const centres: number[] = [];
  let run: number[] = [];
  const endRun = () => {
    if (run.length) {
      centres.push(run.reduce((a, b) => a + b, 0) / run.length);
      run = [];
    }
  };
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > threshold) {
      if (run.length && i - run[run.length - 1] > 1) endRun();
      run.push(i);
    }
  }
  endRun();

  const out: { start: number; end: number; lines: number; spacing: number }[] = [];
  let group: number[] = [];
  const flush = () => {
    if (group.length >= 5 && group[group.length - 1] - group[0] > 40) {
      const diffs: number[] = [];
      for (let i = 1; i < group.length; i++) diffs.push(group[i] - group[i - 1]);
      diffs.sort((a, b) => a - b);
      out.push({ start: group[0], end: group[group.length - 1], lines: group.length, spacing: diffs[diffs.length >> 1] || 14 });
    }
    group = [];
  };
  for (const c of centres) {
    if (group.length && c - group[group.length - 1] > maxGap) flush();
    group.push(c);
  }
  flush();
  return out;
};

export interface DetectedBlock {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  estCols: number;
  estRows: number;
}

/** Recherche toutes les grilles (réseaux de lignes) d'une page rendue. */
export function detectBlocks(canvas: HTMLCanvasElement): DetectedBlock[] {
  const w = canvas.width;
  const h = canvas.height;
  const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  const col = new Uint32Array(w);
  const row = new Uint32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] < 380) {
        col[x]++;
        row[y]++;
      }
    }
  }
  const xc = lineGroups(col, h * 0.22, w * 0.06);
  const yc = lineGroups(row, w * 0.22, h * 0.06);
  const out: DetectedBlock[] = [];
  for (const x of xc) {
    for (const y of yc) {
      let dark = 0;
      let total = 0;
      for (let yy = Math.floor(y.start); yy < y.end; yy += 10) {
        for (let xx = Math.floor(x.start); xx < x.end; xx += 10) {
          const i = (yy * w + xx) * 4;
          dark += data[i] + data[i + 1] + data[i + 2] < 380 ? 1 : 0;
          total++;
        }
      }
      if (total && dark / total < 0.07) continue;
      out.push({
        x0: (x.start / w) * 100,
        y0: (y.start / h) * 100,
        x1: (x.end / w) * 100,
        y1: (y.end / h) * 100,
        estCols: clampInt(x.lines - 1, 2, 300),
        estRows: clampInt(y.lines - 1, 2, 300),
      });
    }
  }
  out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  return out;
}

/** Rapport du rectangle réellement coloré : utile pour disposer automatiquement les pages. */
function coloredModelAspect(canvas: HTMLCanvasElement): number | null {
  const W = 180;
  const H = Math.max(1, Math.round((canvas.height / canvas.width) * W));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    if (chroma < 35 || (r > 245 && g > 245 && b > 245)) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); n++;
  }
  return n > W * H * .03 && y1 > y0 ? (x1 - x0 + 1) / (y1 - y0 + 1) : null;
}

/* ------------------------------ Texte ------------------------------ */

const codeOf = (str: string): string => codeOfText(str);

const isFlossCode = (code: string) => code !== "" && flossIndex(code) >= 0;

function colorfulness(canvas: HTMLCanvasElement) {
  const w = 80;
  const h = 80;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 45) n++;
  }
  return n / (w * h);
}

/* --------------------- Légende : chaque symbole, un seul code --------------------- */

async function legendEntries(handle: PdfHandle, pageN: number): Promise<SymbolEntry[]> {
  const canvas = await handle.render(pageN, 900);
  const text = await handle.text(pageN, 900);
  const w = canvas.width;
  const h = canvas.height;
  const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2] < 380) dark[i] = 1;

  // Les glyphes situés dans une zone de texte sont des lettres ou des chiffres, pas des symboles.
  const boxes = text.map((t) => ({
    x0: t.x - 2,
    x1: t.x + t.str.length * t.size * 0.6 + 2,
    y0: t.y - t.size - 2,
    y1: t.y + 3,
  }));
  const inText = (x: number, y: number) => boxes.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);

  const seen = new Uint8Array(w * h);
  const glyphs: { x0: number; y0: number; x1: number; y1: number; bits: Uint8Array }[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!dark[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    let x0 = w;
    let x1 = 0;
    let y0 = h;
    let y1 = 0;
    let size = 0;
    const push = (j: number) => {
      if (dark[j] && !seen[j]) {
        seen[j] = 1;
        stack.push(j);
      }
    };
    while (stack.length && size < 9000) {
      const j = stack.pop()!;
      size++;
      const x = j % w;
      const y = (j - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0) push(j - 1);
      if (x < w - 1) push(j + 1);
      if (y > 0) push(j - w);
      if (y < h - 1) push(j + w);
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    if (bw < 6 || bh < 6 || bw > 90 || bh > 90 || size < 25) continue;
    if (inText((x0 + x1) / 2, (y0 + y1) / 2)) continue;
    const bits = signatureFrom(data, w, x0, y0, bw, bh);
    const ink = cellInk(bits);
    if (ink < 6 || ink > 110) continue;
    glyphs.push({ x0, y0, x1, y1, bits });
  }

  const codes = text.map((t) => ({ code: codeOf(t.str), x: t.x, y: t.y })).filter((c) => isFlossCode(c.code));
  glyphs.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const used = new Set<number>();
  const keys = new Set<string>();
  const codesOut = new Set<string>();
  const out: SymbolEntry[] = [];

  for (const g of glyphs) {
    const bh = g.y1 - g.y0 + 1;
    const cy = (g.y0 + g.y1) / 2;
    const tol = Math.max(10, bh * 0.7);
    let best = -1;
    let cost = Infinity;
    codes.forEach((t, i) => {
      if (used.has(i)) return;
      const dx = t.x - g.x1;
      if (dx < 0 || dx > 300) return;
      const dy = Math.min(Math.abs(t.y - g.y1), Math.abs(t.y - cy));
      if (dy > tol) return;
      const c = dx + dy * 3;
      if (c < cost) {
        cost = c;
        best = i;
      }
    });
    if (best < 0) continue;
    const key = packKey(g.bits);
    if (keys.has(key) || codesOut.has(codes[best].code)) continue;
    used.add(best);
    keys.add(key);
    codesOut.add(codes[best].code);
    out.push({ id: key, bits: g.bits, preview: bitsPreview(g.bits), count: 1, code: codes[best].code });
  }
  return out;
}

/* ------------------------------ Analyse ------------------------------ */

/** Le handle est détruit si la lecture échoue ou qu'on l'interrompt par `signal` ; sinon il revient à l'appelant, qui le détruit. */
export async function analyzePdf(file: File, onProgress: (msg: string) => void, signal?: AbortSignal): Promise<{ analysis: PdfAnalysis; handle: PdfHandle }> {
  const handle = await openPdf(file, signal);
  try {
    return { analysis: await analyzePages(handle, file.name, onProgress, signal), handle };
  } catch (error) {
    handle.destroy();
    throw error;
  }
}

async function analyzePages(handle: PdfHandle, fileName: string, onProgress: (msg: string) => void, signal?: AbortSignal): Promise<PdfAnalysis> {
  const pages: PageInfo[] = [];
  let title = "";
  let author = "";
  let legendPage: number | null = null;
  const legend: SymbolEntry[] = [];
  let modelAspect = 1;
  let modelScore = 0;

  for (let n = 1; n <= handle.pages; n++) {
    throwIfAborted(signal);
    onProgress(`Analyse de la page ${n}/${handle.pages}…`);
    await tick();
    const canvas = await handle.render(n, 1400);
    const items = await handle.text(n, 1400);
    const blocks = detectBlocks(canvas);
    const codeItems = items.filter((it) => isFlossCode(codeOf(it.str)));
    const prefixed = items.filter((it) => /^DMC\s*[A-Z0-9]+$/i.test(it.str.trim())).length;
    const chartBlocks = blocks.filter((b) => b.estCols * b.estRows >= 64);
    const colorScore = colorfulness(canvas);

    let kind: PageKind;
    if (prefixed >= 3 || (codeItems.length >= 8 && chartBlocks.length === 0)) kind = "legend";
    else if (chartBlocks.length) kind = "chart";
    else if (colorScore > 0.2) kind = "cover";
    else kind = "other";

    const biggest = items.reduce((best, it) => (it.size > (best?.size ?? 0) ? it : best), null as null | (typeof items)[number]);
    if (!title && biggest && biggest.str.trim().length > 1) title = biggest.str.trim().slice(0, 80);
    if (!author) {
      const a = items.find((it) => /©|\(c\)|designed|cré|crédit|author/i.test(it.str) && it.str.trim().length < 90);
      if (a) author = a.str.trim();
    }

    const labelOf = (b: DetectedBlock) => {
      const top = (b.y0 / 100) * canvas.height;
      const candidates = items.filter(
        (it) =>
          it.y > top - 90 &&
          it.y < top &&
          it.x > (b.x0 / 100) * canvas.width - 60 &&
          it.x < (b.x1 / 100) * canvas.width + 60 &&
          it.str.trim().length <= 14,
      );
      return candidates.sort((a, c) => a.str.trim().length - c.str.trim().length)[0]?.str.trim() ?? "";
    };

    if (kind === "legend") {
      legendPage = n;
      legend.push(...(await legendEntries(handle, n)));
    }
    if (kind === "cover" && colorScore > modelScore) {
      modelScore = colorScore;
      modelAspect = coloredModelAspect(canvas) ?? modelAspect;
    }

    pages.push({
      n,
      kind,
      blocks: blocks.map((b) => ({
        id: uid(),
        page: n,
        x0: Math.max(0, b.x0),
        y0: Math.max(0, b.y0),
        x1: Math.min(100, b.x1),
        y1: Math.min(100, b.y1),
        cols: b.estCols,
        rows: b.estRows,
        label: labelOf(b),
      })),
      title: biggest?.str.trim().slice(0, 80) ?? "",
      aspect: canvas.height / canvas.width,
      thumb: canvas.toDataURL("image/jpeg", 0.72),
    });
  }

  return { title: title || fileName.replace(/\.pdf$/i, ""), author, pages, legendPage, legend, modelAspect };
}

/* ----------------------------- Conversion ----------------------------- */

/** Un bloc calé → index du registre pour chaque case (-1 = vide). */
/** Un bloc calé → index FLOSS pour chaque case (mode photo / couleur). */
export async function convertBlockColor(handle: PdfHandle, pageN: number, block: PdfBlock, maxColors: number): Promise<{ cells: Int16Array; colors: number[] }> {
  const canvas = await handle.render(pageN, 1600);
  const rect = rectifyBlock(canvas, block);
  const data = rect.getContext("2d")!.getImageData(0, 0, rect.width, rect.height).data;
  const { cross, palette } = quantizePixels(data, block.cols, block.rows, { maxColors, dropWhite: false, confetti: false });
  return { cells: cross, colors: palette };
}

export interface AutoBlockResult {
  cells: Int16Array;
  byColor: number;
  byLegend: number;
  unresolved: number;
}

/**
 * Lecture sûre d'une page colorée à symboles :
 * 1) couleur dominante sur un anneau intérieur de la case (hors grille/symbole) ;
 * 2) si le fond est blanc, symbole connu de la légende ;
 * 3) sinon vide. Aucune couleur provisoire n'est créée.
 */
export async function convertBlockAuto(handle: PdfHandle, pageN: number, block: PdfBlock, reg: SymbolRegistry): Promise<AutoBlockResult> {
  const canvas = await handle.render(pageN, 1600);
  const rect = rectifyBlock(canvas, block);
  const data = rect.getContext("2d")!.getImageData(0, 0, rect.width, rect.height).data;
  const out = new Int16Array(block.cols * block.rows).fill(-1);
  const pool = reg.entries.map((e) => flossIndex(e.code)).filter((v) => v >= 0);
  let byColor = 0, byLegend = 0, unresolved = 0;
  for (let r = 0; r < block.rows; r++) for (let c = 0; c < block.cols; c++) {
    const bits = cellBits(data, rect.width, c * 14, r * 14);
    const ink = cellInk(bits);
    const bg = backgroundOfCell(data, rect.width, c * 14, r * 14);
    let idx = -1;
    if (bg && bg.chromatic) {
      idx = nearestFloss(labOf(bg.rgb), pool.length ? pool : undefined);
      byColor++;
    } else if (ink >= 3) {
      const symbol = reg.matchKnown(bits);
      if (symbol >= 0) {
        idx = flossIndex(reg.entries[symbol].code);
        byLegend++;
      } else unresolved++;
    } else if (!bg?.neutral) {
      unresolved++;
    }
    out[r * block.cols + c] = idx;
  }
  return { cells: out, byColor, byLegend, unresolved };
}

/** Fond de case, pris sur l'anneau x/y=2,3,10,11 ; les symboles restent au centre. */
function backgroundOfCell(data: Uint8ClampedArray, width: number, x0: number, y0: number): { rgb: [number, number, number]; white: boolean; chromatic: boolean; neutral: boolean } | null {
  const hist = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = 2; y <= 11; y++) for (let x = 2; x <= 11; x++) {
    if (x > 3 && x < 10 && y > 3 && y < 10) continue;
    const i = ((y0 + y) * width + x0 + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (Math.round(r / 16) << 8) | (Math.round(g / 16) << 4) | Math.round(b / 16);
    const e = hist.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b; hist.set(key, e);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of hist.values()) if (!best || e.n > best.n) best = e;
  if (!best || best.n < 5) return null;
  const rgb: [number, number, number] = [best.r / best.n, best.g / best.n, best.b / best.n];
  const chroma = Math.max(...rgb) - Math.min(...rgb);
  const light = (rgb[0] + rgb[1] + rgb[2]) / 3;
  // Gris, noir et blanc sont l'encre/support d'un patron symbolique, pas
  // une preuve de la couleur du fil : il faut alors suivre la légende.
  return { rgb, white: light > 220 && chroma < 24, chromatic: chroma >= 24, neutral: chroma < 24 };
}

/**
 * Réduit proportionnellement une grille trop grande (majorité par zone), pour tenir
 * dans MAX_DIM × MAX_DIM et MAX_CELLS. Aucune dimension n'est tronquée.
 */
export function fitGrid(cells: Int16Array, W: number, H: number, maxDim = MAX_DIM, maxCells = MAX_CELLS) {
  const s = Math.min(1, maxDim / W, maxDim / H, Math.sqrt(maxCells / (W * H)));
  if (s >= 1) return { cells, w: W, h: H, scaled: false };
  const w = Math.max(1, Math.floor(W * s));
  const h = Math.max(1, Math.floor(H * s));
  const out = new Int16Array(w * h).fill(-1);
  const votes = new Map<number, number>();
  for (let ny = 0; ny < h; ny++) {
    const y0 = Math.floor((ny * H) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((ny + 1) * H) / h));
    for (let nx = 0; nx < w; nx++) {
      const x0 = Math.floor((nx * W) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((nx + 1) * W) / w));
      votes.clear();
      let filled = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = cells[y * W + x];
          if (v >= 0) {
            votes.set(v, (votes.get(v) ?? 0) + 1);
            filled++;
          }
        }
      }
      if (!filled) continue;
      let best = -1;
      let bestN = 0;
      for (const [v, n] of votes) {
        if (n > bestN) {
          bestN = n;
          best = v;
        }
      }
      out[ny * w + nx] = best;
    }
  }
  return { cells: out, w, h, scaled: true };
}
