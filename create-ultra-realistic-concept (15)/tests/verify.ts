import assert from "node:assert/strict";
import { DMC_ADDED_THREADS, DMC_ALL_THREADS, DMC_THREADS, getThread, resolveThreadCode } from "../src/data/dmc";
import { CROWN_THREADS } from "../src/data/crown";
import { computeMaterials, estimateTime, perStitchNeedleMeters, SKEIN_STRAND_METERS } from "../src/lib/materials";
import { chartRegions, countRegionStitches } from "../src/lib/chart";
import { patternFingerprint } from "../src/lib/pattern-id";
import { patternToSvg } from "../src/lib/exporters";
import { chartGeometry, paintPattern } from "../src/lib/paint";
import {
  DEFAULT_CONFIG, PRESETS, SYMBOLS, decodeConfig, encodeConfig, generateRosace, normalizeConfig,
} from "../src/lib/rosace";
import {
  MAX_ZOOM, MIN_ZOOM, buildProject, clampViewport, emptyProgress, importProject,
  parseRuns, remainingByColor, serializeRuns, stitchIndex,
} from "../src/lib/progress";

let checks = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    checks += 1;
    console.log(`ok ${checks} — ${name}`);
  } catch (error) {
    console.error(`not ok — ${name}`);
    throw error;
  }
}

const pattern = generateRosace(DEFAULT_CONFIG);

test("catalogue : 489 références, codes uniques, 161 historiques intactes", () => {
  assert.equal(DMC_THREADS.length, 161);
  assert.equal(DMC_ALL_THREADS.length, 489);
  assert.equal(new Set(DMC_ALL_THREADS.map((line) => line.code)).size, 489);
  for (const old of DMC_THREADS) {
    const current = DMC_ALL_THREADS.find((line) => line.code === old.code);
    assert.ok(current);
    assert.equal(current.hex, old.hex);
    assert.equal(current.name, old.name);
  }
});

test("métrage : faisceau et brins sont deux grandeurs distinctes", () => {
  const two = computeMaterials(500, { aida: 14, strands: 2, wastePercent: 15 });
  assert.equal(two.needleMeters, 14.4);
  assert.equal(two.strandMeters, 28.8);
  assert.equal(two.skeins, 1);
  assert.equal(two.skeinUsableNeedleMeters, 24);
  const one = computeMaterials(500, { aida: 14, strands: 1, wastePercent: 15 });
  const six = computeMaterials(500, { aida: 14, strands: 6, wastePercent: 15 });
  assert.equal(one.needleMeters, 7.2);
  assert.equal(six.needleMeters, 43.1);
  assert.equal(six.strandMeters, 258.8);
  assert.ok(six.skeins > two.skeins);
  assert.ok(two.needleMeters > one.needleMeters);
});

test("conversions Aïda : le métrage baisse quand le comptage augmente", () => {
  const a14 = computeMaterials(1000, { aida: 14, strands: 2, wastePercent: 0 });
  const a16 = computeMaterials(1000, { aida: 16, strands: 2, wastePercent: 0 });
  const a18 = computeMaterials(1000, { aida: 18, strands: 2, wastePercent: 0 });
  assert.ok(a14.needleMeters > a16.needleMeters && a16.needleMeters > a18.needleMeters);
  assert.equal(perStitchNeedleMeters(14, 2), 0.025);
  assert.ok(Math.abs(perStitchNeedleMeters(18, 2) - 0.025 * 14 / 18) < 1e-9);
  assert.equal(perStitchNeedleMeters(14, 6), 0.025 * 3);
  assert.equal(estimateTime(0).low <= estimateTime(0).median, true);
});

test("temps : estimation en plage et non en vitesse irréaliste", () => {
  const estimate = estimateTime(3381);
  assert.ok(estimate.low > 1000 && estimate.high > estimate.median && estimate.median > estimate.low);
  assert.match(estimate.assumedRate, /100–200/);
});

test("moteur : mêmes réglages + même graine = même patron, empreinte stable", () => {
  const again = generateRosace(decodeConfig(encodeConfig(DEFAULT_CONFIG))!);
  assert.deepEqual([...again.cells], [...pattern.cells]);
  assert.equal(patternFingerprint(again), patternFingerprint(pattern));
});

test("empreinte : la progression suit la grille, pas la toile ni les brins", () => {
  const aida18 = generateRosace({ ...DEFAULT_CONFIG, aida: 18, strands: 4, wastePercent: 25 });
  assert.deepEqual([...aida18.cells], [...pattern.cells]);
  assert.equal(patternFingerprint(aida18), patternFingerprint(pattern));
  const otherPalette = generateRosace({ ...DEFAULT_CONFIG, palette: ["902", "3607", "3608", "907", "310"] });
  assert.notEqual(patternFingerprint(otherPalette), patternFingerprint(pattern));
});

test("planches : chaque croix apparaît exactement une fois sur les grilles impaires", () => {
  for (const size of [81, 91, 101, 111, 121]) {
    const sample = Array.from({ length: size * size }, (_, index) => ({ x: index % size, y: Math.floor(index / size) }));
    const regions = chartRegions(size);
    assert.equal(countRegionStitches(regions, sample), size * size);
    assert.equal(regions.reduce((sum, region) => sum + region.width * region.height, 0), size * size);
  }
  const regions = chartRegions(pattern.size);
  assert.equal(countRegionStitches(regions, pattern.stitches), pattern.stitches.length);
});

test("recettes : les six configurations restent reproductibles et cohérentes", () => {
  for (const preset of PRESETS) {
    const generated = generateRosace(preset.config);
    assert.equal(generated.usage.reduce((sum, line) => sum + line.count, 0), generated.stitches.length);
    assert.ok(generated.totalSkeins >= generated.usage.filter((line) => line.count > 0).length);
    assert.equal(patternFingerprint(generated), patternFingerprint(generateRosace(normalizeConfig(preset.config))));
  }
});

test("progression : sérialisation compacte et bijection", () => {
  const set = new Set([0, 1, 2, 5, 6, 12]);
  const runs = serializeRuns(set);
  assert.equal(runs, "0-2,5-6,12");
  assert.deepEqual([...parseRuns(runs)].sort((a, b) => a - b), [...set]);
  assert.deepEqual([...parseRuns("")], []);
});

test("progression : export/import accepté seulement avec la même empreinte", () => {
  const realIndices = pattern.stitches.slice(0, 3).map((stitch) => stitchIndex(pattern.size, stitch.x, stitch.y));
  const runs = serializeRuns(realIndices);
  const project = buildProject(pattern, {
    version: 2,
    fingerprint: patternFingerprint(pattern),
    completedRuns: runs,
    selectedCode: pattern.config.palette[0],
    viewport: { k: 2, x: 10, y: -10 },
    updatedAt: new Date().toISOString(),
  });
  const imported = importProject(JSON.parse(JSON.stringify(project)));
  assert.equal(imported.ok, true);
  if (imported.ok) assert.equal(imported.progress.completedRuns, runs);
  const tampered = { ...project, fingerprint: "00000000DEADBEEF" };
  assert.equal(importProject(tampered).ok, false);
  const outsider = { ...project, progress: { ...project.progress, completedRuns: `${pattern.cells.length}-99999` } };
  assert.equal(importProject(outsider).ok, false);
  const wrongFormat = { format: "autre", version: 2 };
  assert.equal(importProject(wrongFormat).ok, false);
});

test("progression : restants par fil = total moins cases cochées", () => {
  const color = pattern.stitches[0].color;
  const index = pattern.stitches[0].y * pattern.size + pattern.stitches[0].x;
  const lines = remainingByColor(pattern, new Set([index]));
  assert.equal(lines[color].remaining, lines[color].total - 1);
  const code = getThread(pattern.config.palette[color]).code;
  assert.equal(code, pattern.config.palette[color]);
});

test("aucune régression : chaque réglage de forme change la matrice, palette préservée", () => {
  const base = generateRosace(DEFAULT_CONFIG);
  for (const key of ["structure", "trace", "density", "scale", "twist", "wave", "paletteShift"] as const) {
    const changed = generateRosace({ ...DEFAULT_CONFIG, [key]: 5 });
    assert.ok(changed.stitches.length > 0);
    assert.notDeepEqual([...changed.cells], [...base.cells], `${key} ne change pas la matrice`);
  }
  assert.deepEqual(normalizeConfig(DEFAULT_CONFIG).palette, DEFAULT_CONFIG.palette);
  assert.equal(SKEIN_STRAND_METERS, 48);
});

test("catalogue étendu : 328 ajouts et couronne de 489 références sans doublon", () => {
  assert.equal(DMC_ADDED_THREADS.length, 328);
  assert.equal(CROWN_THREADS.length, 489);
  assert.equal(new Set(CROWN_THREADS.map((thread) => thread.code)).size, 489);
  assert.deepEqual(
    new Set(CROWN_THREADS.map((thread) => thread.code)),
    new Set(DMC_ALL_THREADS.map((thread) => thread.code)),
  );
});

test("anciennes recettes : casse des codes DMC résolue, aucune référence inventée", () => {
  for (const old of DMC_THREADS) {
    const legacy = old.code.toLowerCase();
    assert.equal(resolveThreadCode(legacy), old.code);
    assert.equal(getThread(legacy).hex, old.hex);
    const normalized = normalizeConfig({
      ...DEFAULT_CONFIG,
      palette: [legacy, ...DEFAULT_CONFIG.palette.slice(1, 5)],
    });
    assert.equal(normalized.palette[0], old.code);
  }
  assert.equal(resolveThreadCode("INCONNU-9999"), null);
  assert.equal(normalizeConfig({ ...DEFAULT_CONFIG, wastePercent: Number.NaN }).wastePercent, 15);
});

test("planches : le SVG imprimé émet chaque croix et son symbole une seule fois", () => {
  const margin = 36;
  const cell = 12;
  const seen = new Map<string, number>();
  for (const region of chartRegions(pattern.size)) {
    const svg = patternToSvg(pattern, true, region);
    for (const match of svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)">([^<]+)<\/text>/g)) {
      const symbol = match[3];
      if (!SYMBOLS.includes(symbol)) continue;
      const x = Math.round((Number(match[1]) - margin) / cell) + region.x;
      const y = Math.round((Number(match[2]) - 0.5 - margin) / cell) + region.y;
      const key = `${x}:${y}:${symbol}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  const expected = pattern.stitches.map((stitch) => `${stitch.x}:${stitch.y}:${SYMBOLS[stitch.color]}`);
  assert.equal(seen.size, expected.length);
  for (const key of expected) assert.equal(seen.get(key), 1, `croix manquante ou dupliquée : ${key}`);
  assert.equal([...seen.values()].filter((count) => count !== 1).length, 0);
});

test("projet : journal, sélection, zoom et cases vides sont validés", () => {
  const first = pattern.stitches[0];
  const second = pattern.stitches[1];
  const i0 = stitchIndex(pattern.size, first.x, first.y);
  const i1 = stitchIndex(pattern.size, second.x, second.y);
  const progress = {
    ...emptyProgress(pattern),
    completedRuns: serializeRuns([i0, i1]),
    selectedCode: pattern.config.palette[1],
    viewport: { k: 0.2, x: 99999, y: -99999 },
    journal: [{ index: i0, added: true }, { index: i1, added: true }],
  };
  const project = buildProject(pattern, progress);
  assert.equal(project.format, "rosace-project");
  assert.equal(project.version, 2);
  assert.equal(project.fingerprint, patternFingerprint(pattern));
  assert.equal(project.progress.journal.length, 2);
  const imported = importProject(JSON.parse(JSON.stringify(project)));
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.progress.journal?.length, 2);
    assert.equal(imported.progress.selectedCode, pattern.config.palette[1]);
    assert.equal(imported.progress.viewport.k, MIN_ZOOM);
    assert.ok(Math.abs(imported.progress.viewport.x) <= 900 * MIN_ZOOM);
  }
  assert.equal(clampViewport({ k: 99, x: 0, y: 0 }).k, MAX_ZOOM);
  const emptyCell = [...pattern.cells].findIndex((value) => value < 0);
  assert.ok(emptyCell >= 0);
  const tampered = { ...project, progress: { ...project.progress, completedRuns: String(emptyCell) } };
  assert.equal(importProject(tampered).ok, false);
  const wrongSelection = { ...project, progress: { ...project.progress, selectedCode: "INCONNU" } };
  const selectedImport = importProject(wrongSelection);
  assert.equal(selectedImport.ok, true);
  if (selectedImport.ok) assert.equal(selectedImport.progress.selectedCode, null);
});

test("projet : l'export nettoie aussi une progression locale corrompue", () => {
  const stitch = pattern.stitches[0];
  const valid = stitchIndex(pattern.size, stitch.x, stitch.y);
  const emptyCell = [...pattern.cells].findIndex((value) => value < 0);
  assert.ok(emptyCell >= 0);
  const progress = {
    ...emptyProgress(pattern),
    completedRuns: serializeRuns([valid, emptyCell]),
    selectedCode: "INCONNU",
    viewport: { k: 99, x: 1e9, y: -1e9 },
    journal: [
      { index: valid, added: true },
      { index: emptyCell, added: true },
      { index: Number.NaN, added: false },
    ],
    updatedAt: "2026-11-03T00:00:00.000Z",
  };
  const project = buildProject(pattern, progress);
  assert.equal(project.progress.completedRuns, serializeRuns([valid]));
  assert.equal(project.progress.selectedCode, null);
  assert.equal(project.progress.viewport.k, MAX_ZOOM);
  assert.deepEqual(project.progress.journal, [{ index: valid, added: true }]);
  assert.equal(project.progress.updatedAt, "2026-11-03T00:00:00.000Z");
  assert.equal(importProject(JSON.parse(JSON.stringify(project))).ok, true);
});

/** Stubs canvas minimaux : permettent de vérifier le rendu sans navigateur ni moteur parallèle. */
function verifyCanvasMatrix() {
  const scope = globalThis as unknown as Record<string, unknown>;
  const saved = { document: scope.document, Path2D: scope.Path2D };
  const trace = {
    symbols: [] as Array<{ text: string; x: number; y: number; width: number }>,
    segments: [] as Array<{ id: number; x1: number; y1: number; x2: number; y2: number }>,
    pathCanvas: new Map<number, number>(),
    createdIds: [] as number[],
  };
  let nextId = 0;

  class FakePath2D {
    __id = nextId++;
    constructor() { trace.createdIds.push(this.__id); }
    __last: { x: number; y: number } | null = null;
    segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    addPath(source: FakePath2D) { for (const segment of source.segments) this.segments.push(segment); }
    moveTo(x: number, y: number) { this.__last = { x, y }; }
    lineTo(x: number, y: number) {
      if (!this.__last) return;
      const segment = { id: this.__id, x1: this.__last.x, y1: this.__last.y, x2: x, y2: y };
      this.segments.push({ x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2 });
      trace.segments.push(segment);
      this.__last = null;
    }
  }

  const makeCanvas = () => {
    const ctx: Record<string, unknown> = {};
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    ctx.canvas = canvas;
    const gradient = { addColorStop: () => {} };
    Object.assign(ctx, {
      clearRect: () => {}, fillRect: () => {}, strokeRect: () => {}, save: () => {}, restore: () => {},
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {}, fill: () => {},
      createPattern: () => null,
      createRadialGradient: () => gradient,
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
      stroke: (path?: FakePath2D) => {
        if (path && typeof path.__id === "number") trace.pathCanvas.set(path.__id, canvas.width);
      },
      fillText: (text: unknown, x: number, y: number) => {
        const value = String(text);
        if (SYMBOLS.includes(value)) trace.symbols.push({ text: value, x, y, width: canvas.width });
      },
    });
    return canvas;
  };

  scope.Path2D = FakePath2D;
  scope.document = { createElement: (tag: string) => (tag === "canvas" ? makeCanvas() : {}) };
  try {
    const hoop = makeCanvas() as unknown as HTMLCanvasElement;
    const base = makeCanvas() as unknown as HTMLCanvasElement;
    paintPattern(hoop, pattern, "fabric", 1200);
    paintPattern(base, pattern, "chart", 1800);
  } finally {
    scope.document = saved.document;
    scope.Path2D = saved.Path2D;
  }

  const fabric = chartGeometry(1200, pattern.size, "fabric");
  const chart = chartGeometry(1800, pattern.size, "chart");
  const keyOf = (x: number, y: number, color: number) => `${x}:${y}:${color}`;
  const expected = new Set(pattern.stitches.map((stitch) => keyOf(stitch.x, stitch.y, stitch.color)));

  const chartKeys = new Set<string>();
  for (const symbol of trace.symbols.filter((entry) => entry.width === 1800)) {
    const x = Math.round((symbol.x - chart.origin) / chart.cell);
    const y = Math.round((symbol.y - chart.cell * 0.04 - chart.origin) / chart.cell);
    chartKeys.add(keyOf(x, y, SYMBOLS.indexOf(symbol.text)));
  }
  assert.equal(chartKeys.size, expected.size, "la grille Broderie ne dessine pas toutes les croix");

  // Cinq Path2D sont créés par couleur, dans l'ordre : ombre, brin inférieur, reflet bas,
  // brin supérieur, reflet haut. Les ombres sont fusionnées avant d'être tracées.
  const underIds = trace.createdIds
    .slice(0, pattern.config.palette.length * 5)
    .filter((_, index) => index % 5 === 1);
  assert.equal(underIds.length, pattern.config.palette.length);
  for (const id of underIds) assert.equal(trace.pathCanvas.get(id), 1200);
  const hoopKeys = new Set<string>();
  underIds.forEach((id, color) => {
    for (const segment of trace.segments.filter((entry) => entry.id === id)) {
      const x = Math.round(((segment.x1 + segment.x2) / 2 - fabric.origin) / fabric.cell);
      const y = Math.round(((segment.y1 + segment.y2) / 2 - fabric.origin) / fabric.cell);
      hoopKeys.add(keyOf(x, y, color));
    }
  });
  assert.equal(hoopKeys.size, expected.size, "le tambour ne dessine pas toutes les croix");
  for (const key of expected) {
    assert.ok(hoopKeys.has(key), `croix absente du tambour : ${key}`);
    assert.ok(chartKeys.has(key), `croix absente de la grille Broderie : ${key}`);
  }
  assert.deepEqual([...hoopKeys].sort(), [...expected].sort());
  assert.deepEqual([...chartKeys].sort(), [...expected].sort());
}

test("matrice unique : tambour et grille Broderie peignent exactement les mêmes croix et couleurs", verifyCanvasMatrix);

console.log(`\n${checks} tests réussis.`);
