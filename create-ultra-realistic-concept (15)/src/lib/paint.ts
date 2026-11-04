import { getThread } from "../data/dmc";
import { hexToRgb, luminance, mix } from "./color";
import { FABRIC_COLORS, type FabricTone, type RosacePattern } from "./rosace";
import { toWork, type StitchWork } from "./work";

/**
 * Couche de rendu : transforme un ouvrage (StitchWork, ou RosacePattern enveloppé) en pixels.
 * Une seule fonction sert le tambour, la grille, les vignettes et l'export PNG.
 * Le canevas reste carré : une grille rectangulaire est centrée dans la zone de tracé,
 * et une grille carrée est dessinée exactement comme avant.
 * Le réalisme vient de trois détails : le tissage réel de l'aïda, les trous aux
 * intersections, et du fil bombé avec son brin inférieur, son brin supérieur et sa soie.
 */
/**
 * `fabric` : la toile et ses croix bombées (tambour) · `chart` : la grille à symboles (lecture classique) ·
 * `color` : la grille à cases pleines de la couleur du fil · `color-chart` : cases pleines + symbole en contraste.
 */
/** `stitches` : les croix seules, sans toile ni grille, sur fond transparent (la présentation, sur blanc). */
export type CanvasMode = "fabric" | "stitches" | "chart" | "color" | "color-chart";

/** `chartGeometry(side, size, mode)` reste valide pour une grille carrée ; `(side, width, height, mode)` pour une grille rectangulaire. */
export function chartGeometry(side: number, width: number, heightOrMode: number | CanvasMode, modeArg?: CanvasMode) {
  const height = typeof heightOrMode === "number" ? heightOrMode : width;
  const mode: CanvasMode = typeof heightOrMode === "number" ? (modeArg ?? "chart") : heightOrMode;
  const origin = side * (mode === "fabric" || mode === "stitches" ? 0.055 : 0.075);
  const plot = side - origin * 2;
  const longest = Math.max(width, height);
  const cell = longest > 1 ? plot / (longest - 1) : plot;
  const originX = origin + (plot - (width - 1) * cell) / 2;
  const originY = origin + (plot - (height - 1) * cell) / 2;
  return { origin, originX, originY, plot, cell };
}

function makeFabricTile(base: string, warp: string) {
  const tile = document.createElement("canvas");
  tile.width = 220;
  tile.height = 220;
  const context = tile.getContext("2d")!;
  const rgb = hexToRgb(base);
  const image = context.createImageData(tile.width, tile.height);
  // Un aïda est une trame : des brins numérotés qui alternent clair et sombre.
  for (let y = 0; y < tile.height; y += 1) {
    for (let x = 0; x < tile.width; x += 1) {
      const index = (y * tile.width + x) * 4;
      const warpWave = Math.sin((x / 3.2) * Math.PI) * 2.6;
      const weftWave = Math.sin((y / 3.2) * Math.PI) * 2.2;
      const twist = Math.sin(x * 2.7 + y * 1.9) * 0.9;
      const slub = Math.sin(x * 0.021 + 2.4) * Math.sin(y * 0.017 - 1.1) * 1.7;
      const grain = (Math.sin(x * 127.1 + y * 311.7) + Math.sin(x * 74.7 - y * 213.3)) * 0.75;
      const shade = warpWave + weftWave + twist + slub + grain;
      image.data[index] = Math.max(0, Math.min(255, rgb.r + shade));
      image.data[index + 1] = Math.max(0, Math.min(255, rgb.g + shade * 0.96));
      image.data[index + 2] = Math.max(0, Math.min(255, rgb.b + shade * 0.88));
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  // Rives des brins : le fil le plus sombre marque le creux entre deux brins.
  context.lineWidth = 0.8;
  for (let i = 3; i < 220; i += 3) {
    context.strokeStyle = "rgba(105, 86, 62, 0.05)";
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i, 220);
    context.stroke();
    context.beginPath();
    context.moveTo(0, i);
    context.lineTo(220, i);
    context.stroke();
    context.strokeStyle = "rgba(255, 252, 240, 0.07)";
    context.beginPath();
    context.moveTo(i + 1.5, 0);
    context.lineTo(i + 1.5, 220);
    context.stroke();
    context.beginPath();
    context.moveTo(0, i + 1.5);
    context.lineTo(220, i + 1.5);
    context.stroke();
  }
  context.strokeStyle = warp;
  context.globalAlpha = 0.055;
  for (let i = 0; i < 220; i += 22) {
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i, 220);
    context.stroke();
    context.beginPath();
    context.moveTo(0, i);
    context.lineTo(220, i);
    context.stroke();
  }
  return tile;
}

const fabricTiles = new Map<string, HTMLCanvasElement>();

function drawFabric(context: CanvasRenderingContext2D, side: number, tone: FabricTone, cell: number) {
  const fabric = FABRIC_COLORS[tone];
  const key = `${fabric.base}-${fabric.warp}`;
  let tile = fabricTiles.get(key);
  if (!tile) {
    tile = makeFabricTile(fabric.base, fabric.warp);
    fabricTiles.set(key, tile);
  }
  const fill = context.createPattern(tile, "repeat");
  context.fillStyle = fill ?? fabric.base;
  context.fillRect(0, 0, side, side);

  // Le pas de l'aïda : le trou est au centre de chaque case, les barres du tissage entre les cases.
  const holes = cell > 4;
  for (let y = 0; y < side + cell; y += cell) {
    for (let x = 0; x < side + cell; x += cell) {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      if (holes) {
        const hole = context.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.16);
        hole.addColorStop(0, "rgba(70, 52, 34, 0.30)");
        hole.addColorStop(0.55, "rgba(90, 70, 46, 0.12)");
        hole.addColorStop(1, "rgba(90, 70, 46, 0)");
        context.fillStyle = hole;
        context.beginPath();
        context.arc(cx, cy, cell * 0.17, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (holes) {
      const th = Math.max(0.6, cell * 0.045);
      context.fillStyle = "rgba(96, 78, 54, 0.10)";
      context.fillRect(0, y - th / 2, side, th);
      context.fillStyle = "rgba(255, 253, 244, 0.16)";
      context.fillRect(0, y + th * 0.75, side, th * 0.8);
    }
  }
  if (holes) {
    const th = Math.max(0.6, cell * 0.045);
    for (let x = 0; x < side + cell; x += cell) {
      context.fillStyle = "rgba(96, 78, 54, 0.10)";
      context.fillRect(x - th / 2, 0, th, side);
      context.fillStyle = "rgba(255, 253, 244, 0.16)";
      context.fillRect(x + th * 0.75, 0, th * 0.8, side);
    }
  }

  // Lumière : légèrement venue du haut-gauche, comme sur une photo de broderie.
  const light = context.createRadialGradient(side * 0.38, side * 0.3, side * 0.04, side * 0.5, side * 0.5, side * 0.7);
  light.addColorStop(0, "rgba(255,255,255,0.22)");
  light.addColorStop(0.62, "rgba(255,255,255,0)");
  light.addColorStop(1, "rgba(66,46,32,0.18)");
  context.fillStyle = light;
  context.fillRect(0, 0, side, side);
}

/** Lignes de la grille seules (fines et repères lourds toutes les 10 cases), réutilisées par-dessus les cases colorées. */
function drawChartLines(context: CanvasRenderingContext2D, originX: number, originY: number, width: number, height: number, cell: number, over = false) {
  context.save();
  const left = originX - cell / 2;
  const top = originY - cell / 2;
  const right = originX + (width - 1) * cell + cell / 2;
  const bottom = originY + (height - 1) * cell + cell / 2;
  const minor = over ? "rgba(76,49,66,0.22)" : "rgba(76,49,66,0.12)";
  const majorColor = over ? "rgba(30,18,26,0.72)" : "rgba(76,49,66,0.38)";
  for (let i = 0; i <= width; i += 1) {
    const position = left + i * cell;
    const major = i % 10 === 0;
    context.strokeStyle = major ? majorColor : minor;
    context.lineWidth = major ? 1.35 : 0.65;
    context.beginPath();
    context.moveTo(position, top);
    context.lineTo(position, bottom);
    context.stroke();
  }
  for (let i = 0; i <= height; i += 1) {
    const position = top + i * cell;
    const major = i % 10 === 0;
    context.strokeStyle = major ? majorColor : minor;
    context.lineWidth = major ? 1.35 : 0.65;
    context.beginPath();
    context.moveTo(left, position);
    context.lineTo(right, position);
    context.stroke();
  }
  context.restore();
}

function drawChart(context: CanvasRenderingContext2D, side: number, originX: number, originY: number, width: number, height: number, cell: number) {
  context.fillStyle = "#fffefa";
  context.fillRect(0, 0, side, side);
  context.save();
  const left = originX - cell / 2;
  const top = originY - cell / 2;
  const right = originX + (width - 1) * cell + cell / 2;
  const bottom = originY + (height - 1) * cell + cell / 2;
  for (let i = 0; i <= width; i += 1) {
    const position = left + i * cell;
    const major = i % 10 === 0;
    context.strokeStyle = major ? "rgba(76,49,66,0.38)" : "rgba(76,49,66,0.12)";
    context.lineWidth = major ? 1.35 : 0.65;
    context.beginPath();
    context.moveTo(position, top);
    context.lineTo(position, bottom);
    context.stroke();
  }
  for (let i = 0; i <= height; i += 1) {
    const position = top + i * cell;
    const major = i % 10 === 0;
    context.strokeStyle = major ? "rgba(76,49,66,0.38)" : "rgba(76,49,66,0.12)";
    context.lineWidth = major ? 1.35 : 0.65;
    context.beginPath();
    context.moveTo(left, position);
    context.lineTo(right, position);
    context.stroke();
  }
  context.fillStyle = "#766c72";
  context.font = `${Math.max(10, cell * 0.85)}px "Inter Tight", Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let i = 0; i < width; i += 10) context.fillText(String(i + 1), originX + i * cell, originY - cell * 1.35);
  for (let i = 0; i < height; i += 10) context.fillText(String(i + 1), originX - cell * 1.6, originY + i * cell);
  context.restore();
}

/** Jitter déterministe : deux points voisins se brodent toujours de la même façon. */
function jitter(x: number, y: number, salt: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.3) * 43758.5453;
  return (n - Math.floor(n) - 0.5) * 2;
}

export function paintPattern(canvas: HTMLCanvasElement, source: RosacePattern | StitchWork, mode: CanvasMode, resolution: number) {
  const pattern = toWork(source);
  canvas.width = resolution;
  canvas.height = resolution;
  const context = canvas.getContext("2d");
  if (!context) return;
  const side = resolution;
  const { originX, originY, cell } = chartGeometry(side, pattern.width, pattern.height, mode);
  context.clearRect(0, 0, side, side);

  if (mode === "fabric") drawFabric(context, side, pattern.textile.fabric, cell);
  else if (mode !== "stitches") drawChart(context, side, originX, originY, pattern.width, pattern.height, cell);

  if (mode === "color" || mode === "color-chart") {
    // Cases pleines : la couleur du fil remplit la case, la grille fine reste visible par-dessus.
    const hexes = pattern.palette.map((entry) => getThread(entry.code).hex);
    context.save();
    pattern.stitches.forEach((stitch) => {
      context.fillStyle = hexes[stitch.color];
      context.fillRect(originX + stitch.x * cell - cell / 2, originY + stitch.y * cell - cell / 2, cell + 0.2, cell + 0.2);
    });
    context.restore();
    drawChartLines(context, originX, originY, pattern.width, pattern.height, cell, true);
    if (mode === "color-chart") {
      context.save();
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `600 ${Math.max(7, cell * 0.86)}px "Inter Tight", Arial, sans-serif`;
      pattern.stitches.forEach((stitch) => {
        const hex = hexes[stitch.color];
        context.fillStyle = luminance(hex) > 150 ? "rgba(20,14,18,0.82)" : "rgba(255,255,255,0.88)";
        context.fillText(pattern.palette[stitch.color].symbol, originX + stitch.x * cell, originY + stitch.y * cell + cell * 0.04);
      });
      context.restore();
    }
    return;
  }

  if (mode === "chart") {
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `600 ${Math.max(7, cell * 0.96)}px "Inter Tight", Arial, sans-serif`;
    pattern.stitches.forEach((stitch) => {
      const hex = getThread(pattern.palette[stitch.color].code).hex;
      const light = luminance(hex);
      context.fillStyle = light > 205 ? mix(hex, "#000000", 0.72) : light > 160 ? mix(hex, "#000000", 0.42) : hex;
      context.fillText(pattern.palette[stitch.color].symbol, originX + stitch.x * cell, originY + stitch.y * cell + cell * 0.04);
    });
    context.restore();
    return;
  }

  // Une croix de point de croix occupe toute sa case : deux brins diagonaux.
  const half = cell * 0.44;
  const paths = pattern.palette.map(() => ({
    shadow: new Path2D(),
    under: new Path2D(),
    underLight: new Path2D(),
    over: new Path2D(),
    overLight: new Path2D(),
  }));

  pattern.stitches.forEach((stitch) => {
    const jx = jitter(stitch.x, stitch.y, 1) * cell * 0.045;
    const jy = jitter(stitch.x, stitch.y, 2) * cell * 0.045;
    const x = originX + stitch.x * cell + jx;
    const y = originY + stitch.y * cell + jy;
    const path = paths[stitch.color];
    if (!path) return;
    const r = half * (1 + jitter(stitch.x, stitch.y, 3) * 0.05);

    // Ombre portée légère sur le tissu.
    path.shadow.moveTo(x - r + cell * 0.1, y - r + cell * 0.16);
    path.shadow.lineTo(x + r + cell * 0.1, y + r + cell * 0.16);
    path.shadow.moveTo(x - r + cell * 0.1, y + r + cell * 0.16);
    path.shadow.lineTo(x + r + cell * 0.1, y - r + cell * 0.16);

    // Brin inférieur.
    path.under.moveTo(x - r, y - r);
    path.under.lineTo(x + r, y + r);
    path.under.moveTo(x - r, y + r);
    path.under.lineTo(x + r, y - r);
    // Brin supérieur (il passe au-dessus : c'est lui qui donne le relief).
    path.over.moveTo(x - r * 0.96, y + r * 0.96);
    path.over.lineTo(x + r * 0.96, y - r * 0.96);
    // Reflets : décalés perpendiculairement au brin pour donner le bombé.
    const d = r * 0.14;
    path.underLight.moveTo(x - r - d, y - r + d);
    path.underLight.lineTo(x + r - d, y + r + d);
    path.overLight.moveTo(x - r * 0.96 - d, y + r * 0.96 + d);
    path.overLight.lineTo(x + r * 0.96 - d, y - r * 0.96 + d);
  });

  // Ombre commune, puis chaque couleur en trois couches : creux, corps, soie.
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "rgba(52, 32, 26, 0.16)";
  context.lineWidth = cell * 0.5;
  context.stroke(paths.map((p) => p.shadow).reduce((acc, path) => {
    const merged = acc as Path2D;
    const combined = new Path2D();
    combined.addPath(merged);
    combined.addPath(path);
    return combined as Path2D;
  }, new Path2D()));
  context.restore();

  paths.forEach((path, paletteIndex) => {
    const hex = getThread(pattern.palette[paletteIndex].code).hex;
    const dark = mix(hex, "#241018", 0.34);
    const silk = mix(hex, "#ffffff", 0.62);
    const layers: Array<[Path2D, string, number, number]> = [
      [path.under, dark, 0.52, 1],
      [path.under, hex, 0.36, 0.97],
      [path.underLight, silk, 0.1, 0.4],
      [path.over, dark, 0.52, 1],
      [path.over, hex, 0.36, 0.97],
      [path.overLight, silk, 0.11, 0.5],
    ];
    layers.forEach(([strand, color, width, alpha]) => {
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = color;
      context.lineWidth = Math.max(0.5, cell * width);
      context.globalAlpha = alpha;
      context.stroke(strand);
      context.restore();
    });
  });

  // Le vignettage appartient à la toile : sur fond transparent, les croix restent nettes jusqu'au bord.
  if (mode === "stitches") return;
  const edge = context.createRadialGradient(side / 2, side / 2, side * 0.38, side / 2, side / 2, side * 0.53);
  edge.addColorStop(0, "rgba(60,40,25,0)");
  edge.addColorStop(1, "rgba(60,40,25,0.13)");
  context.fillStyle = edge;
  context.fillRect(0, 0, side, side);
}
