import { flossIndex } from "./floss";
import type { PdfHandle, RawItem } from "./pdfimport";

/**
 * Lecture vectorielle d'un patron à symboles, adaptée aux PDF découpés en pages :
 * les symboles sont des caractères de police, la légende du texte, les axes des nombres.
 *
 *  1. Légende : lignes de texte contenant un code DMC ; le symbole est le caractère
 *     isolé à sa gauche, sans autre code entre les deux (les quantités de points,
 *     à droite, ne votent jamais). Résolution 1:1 : un symbole = un code.
 *  2. Grilles : les caractères isolés situés dans les blocs calés sont des points.
 *  3. Axes : nombres alignés multiples de 5, linéaires avec la position. Le pas
 *     vient des axes (distance / écart de valeurs), pas de la densité des symboles.
 *  4. Orientation : les coordonnées sont normalisées pour que la gauche et le haut
 *     visuels restent à gauche et en haut, que la numérotation monte ou descende.
 * Chaque page est ainsi placée à sa position absolue : l'ordre des pages se déduit
 * de la numérotation, sans mosaïque à deviner.
 */

export interface GridBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface VectorPageReport {
  n: number;
  glyphs: number;
  labelsH: number;
  labelsV: number;
  anchored: boolean;
  mapped: number;
  unmapped: number;
  cols: [number, number] | null;
  rows: [number, number] | null;
}

export interface VectorResult {
  ok: boolean;
  reason: string;
  /** Clé "colonne,rangée" en coordonnées normalisées (0,0 = haut-gauche visuel) → code DMC. */
  cells: Map<string, string>;
  bounds: { minC: number; minR: number; maxC: number; maxR: number } | null;
  pages: VectorPageReport[];
  legendChars: number;
  legendPairs: number;
  unmapped: Record<string, number>;
  conflicts: number;
}

interface Anchor {
  pos: number;
  v: number;
}

export function codeOfText(str: string): string {
  // Légendes usuelles : "DMC 310", "DMC #310", "310", "310 Black",
  // "B5200 Blanc" ; refuser les nombres d'axes non associés à un symbole.
  const normalized = str.trim().toUpperCase().replace(/^DMC\s*[:#-]?\s*/, "");
  const token = /^(B5200|ECRU|BLANC|\d{1,4})(?=$|[\s,:;–-])/.exec(normalized);
  return token && flossIndex(token[1]) >= 0 ? token[1] : "";
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

const cxOf = (it: RawItem) => it.x + it.w / 2;
const cyOf = (it: RawItem) => it.y - it.size * 0.35;
const isSingle = (it: RawItem) => it.str.trim().length === 1 && !/\s/.test(it.str);

/** PDF.js sometimes emits an entire custom-font symbol run as a single text item. */
function splitRuns(items: RawItem[], keep: (x: number, y: number) => boolean): RawItem[] {
  const out: RawItem[] = [];
  for (const item of items) {
    const chars = [...item.str];
    // Preserve code labels as intact strings; split only glyph runs.
    if (chars.length <= 1 || codeOfText(item.str)) {
      out.push(item);
      continue;
    }
    const advance = item.w > 0 ? item.w / chars.length : item.size;
    // Some exporters combine a symbol, its DMC label and the colour name into
    // a single text run. Restore valid DMC tokens at their actual text positions,
    // then prevent their letters/digits being mistaken for neighbouring symbols.
    const ranges: [number, number][] = [];
    const re = /(?:DMC\s*)?(B5200|ECRU|BLANC|\d{2,4})/gi;
    for (const match of item.str.matchAll(re)) {
      const raw = match[1];
      const code = raw.toUpperCase();
      if (flossIndex(code) < 0 || match.index === undefined) continue;
      const start = match.index;
      const end = start + match[0].length;
      ranges.push([start, end]);
      const labelAdvance = item.w > 0 ? item.w / item.str.length : item.size;
      const codeOffset = start + (match[0].toUpperCase().startsWith("DMC") ? match[0].toUpperCase().indexOf(code) : 0);
      const synthetic = { ...item, str: code, x: item.x + codeOffset * labelAdvance, w: code.length * labelAdvance };
      if (keep(cxOf(synthetic), cyOf(synthetic))) out.push(synthetic);
    }
    chars.forEach((str, i) => {
      if (ranges.some(([a, b]) => i >= a && i < b)) return;
      if (!str.trim()) return;
      const glyph = { ...item, str, x: item.x + advance * i, w: advance };
      if (keep(cxOf(glyph), cyOf(glyph))) out.push(glyph);
    });
  }
  return out;
}

function cluster<T>(items: T[], key: (t: T) => number, tol: number): T[][] {
  const sorted = [...items].sort((a, b) => key(a) - key(b));
  const out: T[][] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && key(it) - key(last[last.length - 1]) <= tol) last.push(it);
    else out.push([it]);
  }
  return out;
}

/** Un axe valide : au moins 3 nombres, variation strictement linéaire avec la position. */
function linearAxis(list: Anchor[]): Anchor[] {
  const s = [...list].sort((a, b) => a.pos - b.pos);
  if (s.length < 3) return [];
  const r: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const dp = s[i].pos - s[i - 1].pos;
    if (dp < 2) return [];
    r.push((s[i].v - s[i - 1].v) / dp);
  }
  const m = median(r.map(Math.abs));
  if (m === 0) return [];
  if (!r.every((x) => Math.sign(x) === Math.sign(r[0]) && Math.abs(Math.abs(x) - m) <= m * 0.15)) return [];
  return s;
}

/** Pas d'une case : distance entre graduations / écart de valeurs. */
function pitchFromAxis(list: Anchor[]): number {
  if (list.length < 2) return 0;
  const s = [...list].sort((a, b) => a.pos - b.pos);
  const pitches: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const dv = Math.abs(s[i].v - s[i - 1].v);
    if (dv > 0) pitches.push(Math.abs(s[i].pos - s[i - 1].pos) / dv);
  }
  return median(pitches);
}

interface BoxPx {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const inside = (b: BoxPx, x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const insideAny = (boxes: BoxPx[], x: number, y: number) => boxes.some((b) => inside(b, x, y));

export async function readVectorChart(
  handle: PdfHandle,
  boxesByPage: Map<number, GridBox[]>,
  width = 1000,
): Promise<VectorResult> {
  interface PageData {
    n: number;
    items: RawItem[];
    boxes: BoxPx[];
  }
  const pages: PageData[] = [];
  for (let n = 1; n <= handle.pages; n++) {
    const [items, dims] = await Promise.all([handle.rawText(n, width), handle.dims(n)]);
    const hPx = (dims.h / dims.w) * width;
    const toPx = (b: GridBox): BoxPx => ({ x0: (b.x0 / 100) * width, y0: (b.y0 / 100) * hPx, x1: (b.x1 / 100) * width, y1: (b.y1 / 100) * hPx });
    pages.push({ n, items, boxes: (boxesByPage.get(n) ?? []).map(toPx) });
  }

  /* ---------- 1. Légende : une ligne = un symbole + son code ---------- */
  const votes = new Map<string, Map<string, number>>();
  let legendPairs = 0;
  for (const p of pages) {
    const outside = splitRuns(p.items, (x, y) => !insideAny(p.boxes, x, y));
    for (const row of cluster(outside, (it) => it.y, 5)) {
      // Les graduations 0, 5, 10... au-dessus des grilles sont parfois
      // elles-mêmes des codes DMC existants. Ne jamais les interpréter
      // comme des paires « symbole → couleur ».
      if (row.length >= 3 && row.every(it => /^-?\d{1,4}$/.test(it.str.trim()))) continue;
      const codes = row
        .map((it) => ({ it, code: codeOfText(it.str) }))
        .filter((c) => c.code && flossIndex(c.code) >= 0)
        .sort((a, b) => a.it.x - b.it.x);
      if (!codes.length) continue;
      const singles = row.filter((it) => isSingle(it));
      for (const { it: c, code } of codes) {
        const left = singles.filter((s) => s.x + s.w <= c.x + 1).sort((a, b) => b.x - a.x)[0];
        if (!left) continue;
        if (left.x + left.w < c.x - 220) continue;
        // Un autre code entre les deux ? C'est une quantité, pas le fil du symbole.
        if (codes.some((o) => o.it !== c && o.it.x > left.x + left.w && o.it.x < c.x)) continue;
        legendPairs++;
        const m = votes.get(left.str) ?? new Map<string, number>();
        m.set(code, (m.get(code) ?? 0) + 1);
        votes.set(left.str, m);
      }
    }
  }
  // 1:1 : le symbole garde son code majoritaire ; un code garde son meilleur symbole.
  const charBest = new Map<string, { code: string; n: number }>();
  for (const [ch, m] of votes) {
    let code = "";
    let n = 0;
    for (const [c, k] of m) {
      if (k > n) {
        n = k;
        code = c;
      }
    }
    if (code) charBest.set(ch, { code, n });
  }
  const codeBest = new Map<string, { ch: string; n: number }>();
  for (const [ch, v] of charBest) {
    const prev = codeBest.get(v.code);
    if (!prev || v.n > prev.n) codeBest.set(v.code, { ch, n: v.n });
  }
  const legend = new Map<string, string>();
  for (const [, v] of codeBest) {
    const entry = charBest.get(v.ch);
    if (entry) legend.set(v.ch, entry.code);
  }

  /* ---------- 2. Grilles : symboles placés par les axes ---------- */
  const cells = new Map<string, string>();
  const unmapped: Record<string, number> = {};
  const reports: VectorPageReport[] = [];
  let conflicts = 0;
  let chartPages = 0;
  let anchoredPages = 0;
  let glyphsOnAnchored = 0;
  let mappedOnAnchored = 0;

  for (const p of pages) {
    if (!p.boxes.length) continue;
    // Un seul TextItem PDF peut contenir toute une rangée de glyphes d'une police
    // de point de croix. Le découper en caractères évite de perdre ces cases.
    const glyphs = splitRuns(p.items, (x, y) => insideAny(p.boxes, x, y)).filter((g) => isSingle(g) && insideAny(p.boxes, cxOf(g), cyOf(g)));
    if (glyphs.length < 10) continue;
    chartPages++;
    // Graduations : nombres hors grille, multiples de 5 (les petits chiffres isolés sont exclus).
    const nums = p.items.filter((it) => {
      if (!/^-?\d{1,3}$/.test(it.str.trim())) return false;
      if (Math.abs(Number(it.str)) % 5 !== 0) return false;
      return !insideAny(p.boxes, cxOf(it), cyOf(it));
    });
    const pickH = cluster(nums, (it) => it.y, 4)
      .filter((g) => g.length >= 3)
      .map((g) => linearAxis(g.map((it) => ({ pos: cxOf(it), v: Number(it.str) }))))
      .filter((a) => a.length >= 3)
      .sort((a, b) => b.length - a.length)[0] ?? [];
    const pickV = cluster(nums, (it) => it.x, 4)
      .filter((g) => g.length >= 3)
      .map((g) => linearAxis(g.map((it) => ({ pos: cyOf(it), v: Number(it.str) }))))
      .filter((a) => a.length >= 3)
      .sort((a, b) => b.length - a.length)[0] ?? [];
    const pitchX = pitchFromAxis(pickH);
    const pitchY = pitchFromAxis(pickV);
    if (!(pitchX > 2 && pitchY > 2 && pickH.length >= 3 && pickV.length >= 3)) {
      reports.push({ n: p.n, glyphs: glyphs.length, labelsH: pickH.length, labelsV: pickV.length, anchored: false, mapped: 0, unmapped: 0, cols: null, rows: null });
      continue;
    }
    anchoredPages++;
    const sx = Math.sign(pickH[pickH.length - 1].v - pickH[0].v) || 1;
    const sy = Math.sign(pickV[pickV.length - 1].v - pickV[0].v) || 1;
    // Interpolation le long de l'axe, puis placement dans la case correspondante.
    const edgeH = pickH[0], edgeV = pickV[0];
    const h1 = pickH[pickH.length - 1];
    const v1 = pickV[pickV.length - 1];
    let mapped = 0;
    let miss = 0;
    let minC = Infinity;
    let maxC = -Infinity;
    let minR = Infinity;
    let maxR = -Infinity;
    for (const g of glyphs) {
      const colRaw = edgeH.v + ((h1.v - edgeH.v) * (cxOf(g) - edgeH.pos)) / (h1.pos - edgeH.pos);
      const rowRaw = edgeV.v + ((v1.v - edgeV.v) * (cyOf(g) - edgeV.pos)) / (v1.pos - edgeV.pos);
      const col = Math.floor(colRaw);
      const row = Math.floor(rowRaw);
      const gx = sx > 0 ? col : -col;
      const gy = sy > 0 ? row : -row;
      minC = Math.min(minC, colRaw);
      maxC = Math.max(maxC, colRaw);
      minR = Math.min(minR, rowRaw);
      maxR = Math.max(maxR, rowRaw);
      const code = legend.get(g.str);
      if (!code) {
        unmapped[g.str] = (unmapped[g.str] ?? 0) + 1;
        miss++;
        continue;
      }
      const key = `${gx},${gy}`;
      const prev = cells.get(key);
      if (prev === undefined) {
        cells.set(key, code);
        mapped++;
      } else if (prev !== code) conflicts++;
    }
    glyphsOnAnchored += glyphs.length;
    mappedOnAnchored += mapped;
    reports.push({
      n: p.n,
      glyphs: glyphs.length,
      labelsH: pickH.length,
      labelsV: pickV.length,
      anchored: true,
      mapped,
      unmapped: miss,
      cols: [Math.min(minC, maxC), Math.max(minC, maxC)],
      rows: [Math.min(minR, maxR), Math.max(minR, maxR)],
    });
  }

  let bounds: VectorResult["bounds"] = null;
  if (cells.size) {
    bounds = { minC: Infinity, minR: Infinity, maxC: -Infinity, maxR: -Infinity };
    for (const key of cells.keys()) {
      const [c, r] = key.split(",").map(Number);
      bounds.minC = Math.min(bounds.minC, c);
      bounds.maxC = Math.max(bounds.maxC, c);
      bounds.minR = Math.min(bounds.minR, r);
      bounds.maxR = Math.max(bounds.maxR, r);
    }
  }

  const ratio = glyphsOnAnchored ? mappedOnAnchored / glyphsOnAnchored : 0;
  const enough = Math.ceil(chartPages * 0.6);
  const ok = chartPages > 0 && anchoredPages >= enough && cells.size >= 50 && ratio >= 0.5;
  const reason = !chartPages
    ? "Aucune grille calée avec des symboles texte : dessinez les blocs au calage, ou utilisez la lecture par image."
    : anchoredPages < enough
      ? `Numérotation des axes inexploitable sur ${chartPages - anchoredPages} page(s) sur ${chartPages} : l'ordre des pages ne peut pas être garanti.`
      : ratio < 0.5
        ? `Seulement ${Math.round(ratio * 100)} % des symboles sont reliés à la légende du PDF.`
        : "";

  return { ok, reason, cells, bounds, pages: reports, legendChars: legend.size, legendPairs, unmapped, conflicts };
}
