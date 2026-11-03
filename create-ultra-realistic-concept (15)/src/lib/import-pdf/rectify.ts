/**
 * Redressement projectif d'un bloc de grille (copié de Point Zéro,
 * studio/src/lib/chartRecognition.ts : `homography` et `rectify` seulement).
 */
export interface Corner { x: number; y: number }
export type Corners = [Corner, Corner, Corner, Corner];

/** Homographie projective : ramène une grille redressée vers quatre coins calés. */
function homography(q: Corners): number[] {
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]], m: number[][] = [];
  uv.forEach(([u, v], i) => {
    const { x, y } = q[i];
    m.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    m.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c; for (let r = c + 1; r < 8; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    if (Math.abs(m[c][c]) < 1e-9) throw new Error("Les quatre coins ne forment pas un quadrilatère valide.");
    const scale = m[c][c]; for (let j = c; j <= 8; j++) m[c][j] /= scale;
    for (let r = 0; r < 8; r++) if (r !== c) { const f = m[r][c]; for (let j = c; j <= 8; j++) m[r][j] -= f * m[c][j]; }
  }
  return m.map((r) => r[8]);
}

export function rectify(source: HTMLCanvasElement, corners: Corners, cols: number, rows: number, cell = 16): HTMLCanvasElement {
  const out = document.createElement("canvas"); out.width = cols * cell; out.height = rows * cell;
  const dst = out.getContext("2d")!, ctx = source.getContext("2d")!, input = ctx.getImageData(0, 0, source.width, source.height), target = dst.createImageData(out.width, out.height);
  const a = homography(corners.map((q) => ({ x: q.x / 100 * source.width, y: q.y / 100 * source.height })) as Corners);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const u = (x + .5) / out.width, v = (y + .5) / out.height, den = a[6] * u + a[7] * v + 1;
    const sx = Math.round((a[0] * u + a[1] * v + a[2]) / den), sy = Math.round((a[3] * u + a[4] * v + a[5]) / den), j = (y * out.width + x) * 4;
    if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) { target.data[j] = target.data[j + 1] = target.data[j + 2] = target.data[j + 3] = 255; continue; }
    const i = (sy * source.width + sx) * 4;
    target.data[j] = input.data[i]; target.data[j + 1] = input.data[i + 1]; target.data[j + 2] = input.data[i + 2]; target.data[j + 3] = 255;
  }
  dst.putImageData(target, 0, 0); return out;
}
