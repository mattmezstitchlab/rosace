import assert from "node:assert/strict";
import { FLOSS, flossIndex, isBlendCode, nearestFlossList } from "../src/lib/import-pdf/floss";
import { closestDmcAlternatives, flossCellsFromVector, gridFromFlossCells, importSymbol, remapGridPalette, IMPORT_SYMBOLS } from "../src/lib/import-pdf/grid";
import { assembleTiles, positionsPuzzle, snapPosition, uniformDimensions, type Tile, type TilePlacement } from "../src/lib/import-pdf/montage";
import { fitGrid, type PdfBlock } from "../src/lib/import-pdf/pdfAnalysis";
import { readCompleteGlyphChart } from "../src/lib/import-pdf/pdfGlyphChart";
import type { PdfHandle, RawItem } from "../src/lib/import-pdf/pdfimport";
import { codeOfText, readVectorChart, type VectorResult } from "../src/lib/import-pdf/pdfVector";
import { DMC_ALL_THREADS } from "../src/data/dmc";
import { fromImport, type ImportLosses, type ImportMontage, type ImportProvenance } from "../src/lib/work";
import { workFingerprint } from "../src/lib/pattern-id";
import { chartRegions, countRegionStitches } from "../src/lib/chart";

/**
 * Tests du noyau d'import PDF copié de Point Zéro (voir src/lib/import-pdf/PROVENANCE.md).
 * Les quatre premiers groupes sont portés des tests d'origine (pdfPuzzle, pdfCompleteGlyph,
 * pdfDmcImport) ; les suivants couvrent les corrections faites dans ROSACE.
 * Aucun PDF réel n'est lu ici : les handles sont synthétiques (voir le plan de tests).
 */
let checks = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      checks += 1;
      console.log(`ok ${checks} — ${name}`);
    })
    .catch((error) => {
      console.error(`not ok — ${name}`);
      throw error;
    });
}

const block = (id: string, cols: number, rows: number, page = 1): PdfBlock => ({ id, page, x0: 0, y0: 0, x1: 90, y1: 90, cols, rows, label: "" });
const tile = (id: string, cols: number, rows: number, fill: number, page = 1): Tile => ({
  id, page, cols, rows, cells: new Int16Array(cols * rows).fill(fill), byColor: fill >= 0 ? cols * rows : 0, byLegend: 0, unresolved: 0,
});
const provenance: ImportProvenance = { file: "test.pdf", pages: 1, mode: "auto" };
const noMontage: ImportMontage = { tiles: [], overlaps: 0, holes: 0, scaled: false };
const noLoss: ImportLosses = { halfStitches: 0, quarterStitches: 0, backstitches: 0, knots: 0, blends: 0, unresolved: 0 };

const black = flossIndex("310");
const red = flossIndex("321");

await test("catalogue : FLOSS reprend les 489 références ROSACE, sans mélange ni mutation", () => {
  assert.equal(FLOSS.length, 489);
  assert.equal(FLOSS.length, DMC_ALL_THREADS.length);
  assert.ok(black >= 0 && red >= 0);
  assert.equal(flossIndex("blanc"), flossIndex("BLANC"), "casse ignorée");
  assert.equal(flossIndex("B5200") >= 0, true);
  assert.equal(flossIndex("99999"), -1);
  assert.equal(flossIndex("mix:310/1+321/1"), -1, "les mélanges ne sont pas enregistrés");
  assert.equal(isBlendCode("mix:310/1+321/1"), true);
  assert.equal(FLOSS.length, 489, "aucune entrée ajoutée à l'exécution");
  assert.equal(nearestFlossList(FLOSS[black].lab, 1)[0].idx, black, "un fil est son propre plus proche voisin");
});

await test("puzzle (porté) : aligne les blocs différents sans chevauchement horizontal ou vertical", () => {
  const pos = positionsPuzzle([block("a", 50, 40), block("b", 35, 80), block("c", 25, 20), block("d", 20, 20)], 2, false, { cols: 40, rows: 50 });
  assert.deepEqual(pos.a, { x: 0, y: 0 });
  assert.deepEqual(pos.b, { x: 50, y: 0 });
  assert.deepEqual(pos.c, { x: 0, y: 80 });
  assert.deepEqual(pos.d, { x: 25, y: 80 });
  const original = positionsPuzzle([block("a", 50, 40), block("b", 25, 25)], 2, false, { cols: 30, rows: 30 });
  const moved = positionsPuzzle([block("b", 25, 25), block("a", 50, 40)], 2, false, { cols: 30, rows: 30 });
  assert.equal(original.b.x, 50);
  assert.equal(moved.a.x, 25);
  assert.deepEqual(uniformDimensions([block("a", 50, 40), block("b", 35, 80), block("c", 25, 20)]), { cols: 35, rows: 40 });
});

await test("puzzle (porté) : conserve la dernière page au-delà de 1000 cases sans la replier sur la bordure", () => {
  const result = assembleTiles(
    [tile("page1", 980, 10, black), tile("page2", 40, 10, red)],
    [{ id: "page1", x: 0, y: 0, w: 980, h: 10 }, { id: "page2", x: 980, y: 0, w: 40, h: 10 }],
  );
  assert.equal(result.scaled, true);
  assert.equal(result.width, 1000);
  assert.ok(Array.from(result.cells.slice(960, 1000)).includes(red));
  assert.equal(result.cells[0], black);
  assert.equal(result.overlaps, 0);
  assert.equal(result.holes, 0);
});

await test("puzzle (porté) : si les tailles sont uniformisées, remplit la zone et garde les couleurs", () => {
  const assembled = assembleTiles([tile("carte", 2, 2, red)], [{ id: "carte", x: 0, y: 0, w: 4, h: 4 }]);
  assert.equal(assembled.width, 4);
  assert.ok([...assembled.cells].every((v) => v === red));
});

await test("montage (correction) : recouvrements, conflits et trous sont comptés, jamais tus", () => {
  const a = tile("a", 4, 4, black);
  const b = tile("b", 4, 4, red);
  const stacked = assembleTiles([a, b], [{ id: "a", x: 0, y: 0, w: 4, h: 4 }, { id: "b", x: 2, y: 0, w: 4, h: 4 }]);
  assert.equal(stacked.width, 6);
  assert.equal(stacked.overlaps, 8, "2 colonnes × 4 rangées couvertes deux fois");
  assert.equal(stacked.conflicts, 8, "valeurs différentes sur toute la zone commune");
  assert.deepEqual(stacked.overlappingPairs, [["a", "b"]]);
  assert.equal(stacked.cells[2], red, "la dernière carte gagne, et c'est dit");
  const gap = assembleTiles([a, b], [{ id: "a", x: 0, y: 0, w: 4, h: 4 }, { id: "b", x: 6, y: 0, w: 4, h: 4 }]);
  assert.equal(gap.holes, 8, "2 colonnes vides × 4 rangées");
  assert.equal(gap.overlaps, 0);
  const same = assembleTiles([a, tile("c", 4, 4, black)], [{ id: "a", x: 0, y: 0, w: 4, h: 4 }, { id: "c", x: 2, y: 0, w: 4, h: 4 }]);
  assert.equal(same.overlaps, 8);
  assert.equal(same.conflicts, 0, "même valeur : recouvrement sans conflit");
});

await test("montage (correction) : une tuile garde ses propres dimensions quand son calage change", () => {
  // Bug Point Zéro : indexer tile.cells avec les cols/rows modifiés du bloc mélangeait les cases.
  const cells = new Int16Array(6 * 2);
  for (let i = 0; i < 12; i += 1) cells[i] = i < 6 ? black : red;
  const glyphTile: Tile = { id: "g", page: 1, cols: 6, rows: 2, cells, byColor: 0, byLegend: 12, unresolved: 0 };
  const recalibrated = assembleTiles([glyphTile], [{ id: "g", x: 0, y: 0, w: 3, h: 1 }]);
  assert.equal(recalibrated.width, 3);
  assert.equal(recalibrated.height, 1);
  assert.deepEqual([...recalibrated.cells], [black, black, black], "première rangée échantillonnée, pas de mélange");
  const stretched = assembleTiles([glyphTile], [{ id: "g", x: 0, y: 0, w: 12, h: 4 }]);
  assert.equal(stretched.cells[0], black);
  assert.equal(stretched.cells[12 * 3 + 11], red);
});

await test("aimantation (correction) : la cible la plus proche gagne, les recouvrements sont signalés", () => {
  const others: TilePlacement[] = [
    { id: "a", x: 0, y: 0, w: 10, h: 10 },
    { id: "b", x: 30, y: 0, w: 10, h: 10 },
  ];
  // À x = 23 : bord droit contre le bord gauche de b (20, distance 3) bat l'alignement sur b (30, distance 7).
  const near = snapPosition({ id: "m", x: 23, y: 0, w: 10, h: 10 }, others, 8);
  assert.equal(near.x, 20);
  assert.equal(near.guides.x, 30);
  assert.deepEqual(near.overlaps, []);
  // À x = 27 : l'alignement des bords gauches sur b (30, distance 3) est le plus proche, et il recouvre b : signalé.
  const aligned = snapPosition({ id: "m", x: 27, y: 0, w: 10, h: 10 }, others, 8);
  assert.equal(aligned.x, 30);
  assert.deepEqual(aligned.overlaps, ["b"]);
  // À x = 12 : bord droit de a (10, distance 2) l'emporte.
  const left = snapPosition({ id: "m", x: 12, y: 0, w: 10, h: 10 }, others, 8);
  assert.equal(left.x, 10);
  assert.equal(left.guides.x, 10);
  // Hors de portée : aucune aimantation, coordonnées conservées ; chevauchement détecté.
  const free = snapPosition({ id: "m", x: 15, y: 25, w: 10, h: 10 }, others, 4);
  assert.equal(free.x, 15);
  assert.equal(free.y, 25);
  assert.deepEqual(free.guides, {});
  const over = snapPosition({ id: "m", x: 5, y: 5, w: 10, h: 10 }, others, 0);
  assert.deepEqual(over.overlaps, ["a"]);
  // Désactivée : seules les bornes à 0 s'appliquent.
  const off = snapPosition({ id: "m", x: -3, y: 2, w: 4, h: 4 }, others, 8, false);
  assert.equal(off.x, 0);
  assert.equal(off.y, 2);
  // Origine : attraction à 0 quand elle est la plus proche.
  const origin = snapPosition({ id: "m", x: 2, y: 3, w: 4, h: 4 }, [], 8);
  assert.deepEqual([origin.x, origin.y], [0, 0]);
});

await test("lecture vectorielle (porté) : codeOfText lit DMC #310 et 321 Blue sans confondre les numéros d'axes", () => {
  assert.equal(codeOfText("DMC #310"), "310");
  assert.equal(codeOfText("321 Red"), "321");
  assert.equal(codeOfText("DMC: 321 Rouge"), "321");
  assert.equal(codeOfText("Symbol 999"), "");
  assert.equal(codeOfText("hello"), "");
});

await test("lecture vectorielle (porté) : glyphes + légende + graduations → cases FLOSS exactes", async () => {
  const item = (str: string, x: number, y: number, w = 10): RawItem => ({ str, x, y, w, size: 10, font: "TestFont" });
  const axis = [item("0", 250, 150), item("5", 300, 150), item("10", 350, 150), item("0", 150, 255), item("5", 150, 305), item("10", 150, 355)];
  const grid: RawItem[] = [];
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) grid.push(item(x % 2 ? "#" : "*", 250 + x * 10, 255 + y * 10));
  const legend = [item("*", 100, 100), item("DMC #321", 138, 100, 70), item("#", 100, 125), item("DMC: 310 Black", 138, 125, 100)];
  const handle: PdfHandle = {
    pages: 2,
    dims: async () => ({ w: 1000, h: 1000 }),
    rawText: async (page) => (page === 1 ? [...axis, ...grid] : legend),
    text: async () => [],
    render: async () => { throw new Error("Image rendering not required for vector data"); },
    destroy: () => {},
  };
  const result = await readVectorChart(handle, new Map([[1, [{ x0: 20, y0: 20, x1: 80, y1: 80 }]]]));
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.legendChars, 2);
  assert.equal(result.cells.size, 121);
  const restored = flossCellsFromVector(result);
  assert.ok(restored);
  assert.equal(restored.width, 11);
  assert.equal(restored.height, 11);
  assert.equal(restored.cells[0], red);
  assert.equal(restored.cells[1], black);
});

function fakeVector(): VectorResult {
  const cells = new Map<string, string>();
  for (let y = 20; y < 32; y++) for (let x = 10; x < 22; x++) {
    if (x === 20 && y === 30) continue;
    cells.set(`${x},${y}`, x % 2 ? "310" : "321");
  }
  return { ok: true, reason: "", cells, bounds: { minC: 10, maxC: 21, minR: 20, maxR: 31 }, pages: [], legendChars: 2, legendPairs: 2, unmapped: { "?": 1 }, conflicts: 0 };
}

await test("grille importée (porté) : cases vectorielles → ImportedGrid → StitchWork, cases manquantes vides", () => {
  const floss = flossCellsFromVector(fakeVector());
  assert.ok(floss);
  assert.equal(floss.width, 12);
  assert.equal(floss.height, 12);
  assert.equal(floss.cells[(30 - 20) * 12 + (20 - 10)], -1);
  const grid = gridFromFlossCells(floss, provenance, noMontage, noLoss, undefined, new Set(["310"]));
  assert.deepEqual(grid.colors.map((c) => c.code), ["321", "310"], "ordre d'apparition");
  assert.deepEqual(grid.colors.map((c) => c.symbol), [IMPORT_SYMBOLS[0], IMPORT_SYMBOLS[1]]);
  assert.deepEqual(grid.colors.map((c) => c.fromLegend), [false, true]);
  assert.equal(grid.cells[0], 0);
  assert.equal(grid.cells[1], 1);
  const outcome = fromImport(grid);
  assert.equal(outcome.ok, true, outcome.ok ? "" : outcome.error);
  if (!outcome.ok) return;
  assert.equal(outcome.work.stitches.length, 143);
  assert.equal(outcome.work.usage[0].count, 71, "321 : la case manquante (20,30) est paire");
  assert.equal(outcome.work.usage[1].count, 72);
  assert.equal(outcome.work.fingerprint, workFingerprint(12, 12, outcome.work.cells, ["321", "310"]));
  assert.equal(countRegionStitches(chartRegions(12, 12), outcome.work.stitches), 143, "planches exactes sur le patron importé");
  assert.equal(flossCellsFromVector({ ...fakeVector(), ok: false }), null);
  assert.equal(flossCellsFromVector({ ...fakeVector(), bounds: { minC: 0, minR: 0, maxC: 999999, maxR: 999999 } }), null);
});

await test("palette importée (porté) : remplacement simultané des codes, fusion des doublons, original intact", () => {
  const grid = gridFromFlossCells({ cells: new Int16Array([red, black, -1, red]), width: 2, height: 2 }, provenance, noMontage, noLoss);
  const swapped = remapGridPalette(grid, { "321": "310", "310": "321" });
  assert.deepEqual(swapped.colors.map((c) => c.code), ["310", "321"]);
  assert.deepEqual([...swapped.cells], [0, 1, -1, 0]);
  assert.deepEqual(grid.colors.map((c) => c.code), ["321", "310"], "l'original ne bouge pas");
  const merged = remapGridPalette(grid, { "321": "310" });
  assert.deepEqual(merged.colors.map((c) => c.code), ["310"]);
  assert.deepEqual([...merged.cells], [0, 0, -1, 0]);
  const invalid = remapGridPalette(grid, { "321": "XXXX" });
  assert.strictEqual(invalid, grid);
  const matches = closestDmcAlternatives("321", 3);
  assert.equal(matches.length, 3);
  assert.ok(matches.every((m) => m.code !== "321" && m.deltaE >= 0));
  assert.equal(new Set(IMPORT_SYMBOLS).size, IMPORT_SYMBOLS.length, "symboles d'import tous distincts");
  assert.equal(importSymbol(IMPORT_SYMBOLS.length), `${IMPORT_SYMBOLS[0]}2`);
});

await test("fitGrid (porté) : réduction par vote majoritaire, jamais de troncature", () => {
  const big = new Int16Array(2000 * 10).fill(black);
  big[2000 * 10 - 1] = red;
  const fit = fitGrid(big, 2000, 10);
  assert.equal(fit.scaled, true);
  assert.equal(fit.w, 1000);
  assert.equal(fit.h, 5);
  assert.ok([...fit.cells].includes(black));
  const small = fitGrid(new Int16Array(4), 2, 2);
  assert.equal(small.scaled, false);
});

const glyph = (str: string, x: number, y: number): RawItem => ({ str, x, y, w: 9, size: 12, font: "CustomSymbolFont" });
function syntheticGlyphFile(): PdfHandle {
  // Structure d'une grille multipage 193 × 200 à police de symboles privés ; points fictifs.
  const widths = [49, 53, 53, 38], heights = [68, 68, 64];
  const pages: RawItem[][] = Array.from({ length: 15 }, () => []);
  const chars = ["", "", "", ""];
  let page = 1;
  for (let row = 0; row < heights.length; row++) {
    for (let col = 0; col < widths.length; col++) {
      const items: RawItem[] = [];
      for (let y = 0; y < heights[row]; y++) {
        for (let x = 0; x < widths[col]; x++) {
          const v = (x + y + col * 7 + row * 11) % 9;
          items.push(glyph(v > 3 ? "" : chars[v], 70 + x * 12, 110 + y * 12));
        }
      }
      pages[page++] = items;
    }
  }
  const legend: RawItem[] = [glyph("Instructions and Symbol Key for Design", 30, 15), glyph("193 x 200", 145, 54)];
  [["", "310 Black"], ["", "321 Red"], ["", "828 Sky blue"], ["", "3820 Yellow"]].forEach(([symbol, code], i) => {
    legend.push(glyph(symbol, 95, 210 + 18 * i));
    legend.push(glyph(code, 160, 210 + 18 * i));
  });
  pages[13] = legend;
  return {
    pages: 15,
    rawText: async (n) => pages[n - 1],
    dims: async () => ({ w: 595, h: 842 }),
    text: async () => [],
    render: async () => { throw Error("Le mode glyphes n'a pas besoin du raster."); },
    destroy: () => {},
  };
}

await test("glyphes (porté) : 12 cartes reconnues en 4 colonnes × 3 rangées, 193 × 200, légende de 4 fils", async () => {
  const result = await readCompleteGlyphChart(syntheticGlyphFile());
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.columns, 4);
  assert.equal(result.tiles.length, 12);
  assert.deepEqual(result.tiles.slice(0, 4).map((t) => t.cols), [49, 53, 53, 38]);
  assert.equal(result.tiles.filter((t) => t.page === 10)[0].rows, 64);
  assert.equal(result.width, 193);
  assert.equal(result.height, 200);
  assert.equal(result.mapped + result.blank + result.unresolved, 193 * 200);
  assert.equal(result.unresolved, 0);
  assert.equal(result.legendCount, 4);
});

await test("glyphes (porté + adapté) : les 38 600 positions traversent le montage et entrent dans ROSACE", async () => {
  const glyphs = await readCompleteGlyphChart(syntheticGlyphFile());
  assert.equal(glyphs.ok, true);
  const blocks: PdfBlock[] = glyphs.tiles.map((t) => ({ id: `page-${t.page}`, page: t.page, cols: t.cols, rows: t.rows, ...t.bounds, label: "" }));
  const placement = positionsPuzzle(blocks, glyphs.columns, false, { cols: 50, rows: 68 });
  const layout = blocks.map((b) => ({ id: b.id, x: placement[b.id].x, y: placement[b.id].y, w: b.cols, h: b.rows }));
  const tiles: Tile[] = glyphs.tiles.map((t) => ({ id: `page-${t.page}`, page: t.page, cols: t.cols, rows: t.rows, cells: t.cells, byColor: 0, byLegend: t.mapped, unresolved: t.unresolved }));
  const assembly = assembleTiles(tiles, layout);
  assert.equal(assembly.width, 193);
  assert.equal(assembly.height, 200);
  assert.equal(assembly.scaled, false);
  assert.equal(assembly.overlaps, 0);
  assert.equal(assembly.holes, 0);
  assert.equal(assembly.cells.length, 38_600);
  assert.equal(Array.from(assembly.cells).filter((v) => v >= 0).length, glyphs.mapped);
  const grid = gridFromFlossCells(assembly, { file: "synthetique.pdf", pages: 15, mode: "glyphes" }, { tiles: layout.map((l) => ({ page: Number(l.id.slice(5)), x: l.x, y: l.y, width: l.w, height: l.h })), overlaps: 0, holes: 0, scaled: false }, noLoss, glyphs.declared ?? undefined);
  const codes = grid.colors.map((c) => c.code).sort();
  assert.deepEqual(codes, ["310", "321", "3820", "828"]);
  const outcome = fromImport(grid);
  assert.equal(outcome.ok, true, outcome.ok ? "" : outcome.error);
  if (!outcome.ok) return;
  assert.equal(outcome.work.width, 193);
  assert.equal(outcome.work.height, 200);
  assert.equal(outcome.work.stitches.length, glyphs.mapped);
  assert.equal(outcome.work.origin.kind, "pdf");
  assert.deepEqual(outcome.work.origin.kind === "pdf" ? outcome.work.origin.declaredSize : null, { w: 193, h: 200 });
  assert.equal(countRegionStitches(chartRegions(193, 200), outcome.work.stitches), glyphs.mapped);
});

await test("glyphes (porté) : refuse une légende absente sans attribuer arbitrairement les couleurs", async () => {
  const src = syntheticGlyphFile();
  const orig = src.rawText;
  src.rawText = async (n, w) => (n === 14 ? [] : orig(n, w));
  const result = await readCompleteGlyphChart(src);
  assert.equal(result.ok, false);
  assert.equal(result.mapped, 0);
  assert.ok(result.reason.length > 0, "la raison du refus est disponible pour l'écran Vérifier");
});

console.log(`\n${checks} tests d'import réussis.`);
