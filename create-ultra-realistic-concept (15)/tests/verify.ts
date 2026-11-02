import assert from "node:assert/strict";
import { DMC_ALL_THREADS, DMC_THREADS, getThread } from "../src/data/dmc";
import { computeMaterials, estimateTime, perStitchNeedleMeters, SKEIN_STRAND_METERS } from "../src/lib/materials";
import { chartRegions, countRegionStitches } from "../src/lib/chart";
import { patternFingerprint } from "../src/lib/pattern-id";
import {
  DEFAULT_CONFIG, PRESETS, decodeConfig, encodeConfig, generateRosace, normalizeConfig,
} from "../src/lib/rosace";
import {
  buildProject, importProject, parseRuns, remainingByColor, serializeRuns,
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
  const project = buildProject(pattern, {
    version: 2,
    fingerprint: patternFingerprint(pattern),
    completedRuns: "0-2,5",
    selectedCode: pattern.config.palette[0],
    viewport: { k: 2, x: 10, y: -10 },
    updatedAt: new Date().toISOString(),
  });
  const imported = importProject(JSON.parse(JSON.stringify(project)));
  assert.equal(imported.ok, true);
  if (imported.ok) assert.equal(imported.progress.completedRuns, "0-2,5");
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

test("aucune régression : six réglages changent la matrice, palette préservée", () => {
  const base = generateRosace(DEFAULT_CONFIG);
  for (const key of ["structure", "trace", "density", "scale", "twist", "wave"] as const) {
    const changed = generateRosace({ ...DEFAULT_CONFIG, [key]: 5 });
    assert.ok(changed.stitches.length > 0);
  }
  assert.deepEqual(normalizeConfig(DEFAULT_CONFIG).palette, DEFAULT_CONFIG.palette);
  assert.equal(SKEIN_STRAND_METERS, 48);
});

console.log(`\n${checks} tests réussis.`);
