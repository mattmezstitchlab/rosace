import assert from "node:assert/strict";
import { averageCells, photoGrid, threadScreenColor } from "../src/lib/import-photo";
import { fromImport } from "../src/lib/work";
import { buildProject, emptyProgress, importProject } from "../src/lib/progress";
import { workTitle } from "../src/lib/exporters";

/** Import photo : réduction en lumière linéaire, tri des fils DMC, confettis nettoyés, rapport sRGB honnête. */
let checks = 0;
function test(name: string, fn: () => void) {
  try { fn(); checks += 1; console.log(`ok ${checks} — ${name}`); } catch (error) { console.error(`not ok — ${name}`); throw error; }
}

/** Une image synthétique : quatre aplats, un confetti planté, un coin blanc. */
function synthetic(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  const put = (x: number, y: number, [r, g, b]: [number, number, number], a = 255) => { const o = (y * w + x) * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a; };
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const left = x < w / 2, top = y < h / 2;
    const color: [number, number, number] = left && top ? [120, 20, 50] : !left && top ? [200, 90, 150] : left && !top ? [30, 60, 30] : [255, 255, 255];
    put(x, y, color);
  }
  // Un confetti : un pixel-bloc vert isolé au milieu de l'aplat grenat (une seule case après réduction).
  for (let y = 8; y < 12; y += 1) for (let x = 8; x < 12; x += 1) put(x, y, [40, 180, 60]);
  return data;
}

test("réduction : chaque case prend la moyenne de ses pixels, en lumière linéaire", () => {
  const w = 8, h = 4;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) { const o = i * 4; const dark = i % 2 === 0; data[o] = dark ? 0 : 255; data[o + 1] = dark ? 0 : 255; data[o + 2] = dark ? 0 : 255; data[o + 3] = 255; }
  const { rgb } = averageCells(data, w, h, 4, 2);
  // Moyenne de noir et blanc en lumière linéaire = 50 % de luminance = sRGB 188, pas 128.
  assert.equal(rgb[0], 188);
  assert.equal(rgb[1], 188);
});

test("tri des fils : quatre aplats → trois fils DMC et un coin de toile nue, confetti nettoyé et compté", () => {
  const w = 80, h = 80;
  const result = photoGrid(synthetic(w, h), w, h, { width: 20, maxColors: 10, dropWhite: true, confetti: true, file: "essai.png" });
  assert.ok(!("error" in result), "error" in result ? result.error : "");
  if ("error" in result) return;
  assert.equal(result.grid.width, 20);
  assert.equal(result.grid.height, 20);
  assert.equal(result.grid.kind, "photo");
  assert.equal(result.blank, 100, "le quart blanc est laissé nu");
  assert.equal(result.confettiRemoved, 1, "le confetti vert isolé est remplacé");
  assert.equal(result.grid.colors.length, 3);
  assert.equal(result.colors.length, 3);
  for (const line of result.colors) {
    assert.match(line.threadHex, /^#[0-9a-f]{6}$/i);
    assert.match(line.photoHex, /^#[0-9a-f]{6}$/i);
    assert.ok(line.deltaE >= 0 && line.deltaE < 15, `ΔE plausible pour ${line.code} : ${line.deltaE}`);
    assert.equal(threadScreenColor(line.code)?.hex, line.threadHex, "la couleur d'écran est bien celle du nuancier DMC");
  }
  assert.equal(result.colors[0].count, 100, "le fil le plus présent couvre un quart (confetti compris)");
});

test("palette ramenée au nombre de fils demandé, et confettis conservés si on le demande", () => {
  const w = 80, h = 80;
  const two = photoGrid(synthetic(w, h), w, h, { width: 20, maxColors: 2, dropWhite: true, confetti: false, file: "essai.png" });
  assert.ok(!("error" in two));
  if ("error" in two) return;
  assert.equal(two.grid.colors.length, 2);
  assert.ok(two.threadsBeforeReduction >= 3);
  assert.equal(two.confettiRemoved, 0);
});

test("l'ouvrage photo est un StitchWork valide, voyage en projet v3 et porte un titre honnête", () => {
  const w = 60, h = 40;
  const result = photoGrid(synthetic(w, h), w, h, { width: 30, maxColors: 8, dropWhite: false, confetti: true, file: "chat-roux.jpg" });
  assert.ok(!("error" in result));
  if ("error" in result) return;
  const outcome = fromImport(result.grid);
  assert.equal(outcome.ok, true, outcome.ok ? "" : outcome.error);
  if (!outcome.ok) return;
  assert.equal(outcome.work.origin.kind, "photo");
  assert.equal(outcome.work.height, 20);
  assert.match(workTitle(outcome.work), /^Photo chat-roux/);
  const project = buildProject(outcome.work, emptyProgress(outcome.work));
  assert.equal(project.version === 3 && project.origin, "photo");
  const back = importProject(JSON.parse(JSON.stringify(project)));
  assert.equal(back.ok && back.work.fingerprint, outcome.work.fingerprint);
});

test("refus clairs : image vide, image entièrement blanche", () => {
  assert.ok("error" in photoGrid(new Uint8ClampedArray(0), 0, 0, { width: 20, maxColors: 5, dropWhite: true, confetti: true, file: "x" }));
  const white = new Uint8ClampedArray(16 * 16 * 4).fill(255);
  const result = photoGrid(white, 16, 16, { width: 20, maxColors: 5, dropWhite: true, confetti: true, file: "blanc.png" });
  assert.ok("error" in result && /vide|blanche/.test(result.error));
});

console.log(`\n${checks} tests d'import photo réussis.`);
