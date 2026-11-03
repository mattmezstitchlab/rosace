/**
 * Parcours navigateur ROSACE.
 *
 * Prérequis : un serveur Vite lancé sur BASE_URL et un binaire Chromium fourni par
 * CHROMIUM_PATH (Playwright-core n'embarque pas de navigateur). Exemple :
 *   npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
 *   CHROMIUM_PATH=/chemin/vers/chromium BASE_URL=http://127.0.0.1:5173 npm run test:browser
 *
 * Les artefacts (captures, exports, PDF) sont écrits hors du dépôt, dans ARTIFACT_DIR.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { DMC_ALL_THREADS, FAMILY_LABELS } from "../src/data/dmc";
import { shortFingerprint, patternFingerprint } from "../src/lib/pattern-id";
import { chartGeometry } from "../src/lib/paint";
import { DEFAULT_CONFIG, SYMBOLS, encodeConfig, generateRosace, normalizeConfig } from "../src/lib/rosace";
import { PROJECT_FORMAT, PROJECT_VERSION } from "../src/lib/progress";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR ?? path.join(os.tmpdir(), "rosace-browser-artifacts");
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find(existsSync);
const BROWSER_ARGS = (process.env.BROWSER_ARGS ?? "--no-sandbox --disable-dev-shm-usage --disable-gpu").split(" ").filter(Boolean);

const pattern = generateRosace(DEFAULT_CONFIG);
const fingerprint = patternFingerprint(pattern);
const shortId = shortFingerprint(fingerprint);
const expectedKeys = new Set(pattern.stitches.map((stitch) => `${stitch.x}:${stitch.y}:${stitch.color}`));
const pageErrors: string[] = [];

function keyOf(x: number, y: number, color: number) {
  return `${x}:${y}:${color}`;
}

async function captureDownload(page: Page, action: () => unknown, filename: string) {
  const [download] = await Promise.all([page.waitForEvent("download"), Promise.resolve(action())]);
  const filePath = path.join(ARTIFACT_DIR, filename);
  await download.saveAs(filePath);
  return { filePath, suggested: download.suggestedFilename() };
}

async function openDock(page: Page, label: string) {
  await page.locator(".dock-categorie").filter({ hasText: label }).click();
}

async function closePanel(page: Page) {
  await page.getByRole("button", { name: "Fermer le panneau" }).click();
  await page.locator(".studio-panel").waitFor({ state: "detached" });
}

async function openBroder(page: Page) {
  await page.locator("#dock-broder").click();
  await page.locator(".broder-canvas").waitFor({ state: "visible" });
}

async function closeBroder(page: Page) {
  await page.getByRole("button", { name: "Fermer le mode broderie et enregistrer la progression" }).click();
  await page.locator(".broder").waitFor({ state: "detached" });
}

async function progressText(page: Page) {
  return (await page.locator(".broder-titre span").textContent())?.trim() ?? "";
}

async function waitProgress(page: Page, expected: string) {
  await page.waitForFunction(
    (value) => document.querySelector(".broder-titre span")?.textContent?.includes(value),
    expected,
    { timeout: 10000 },
  );
}

/**
 * Script injecté sous forme de chaîne : Playwright sérialise les fonctions, et le
 * transpilage TS ajouterait un helper __name indisponible dans le contexte page.
 */
const TRACE_SCRIPT = String.raw`
(() => {
  const w = window;
  try {
    const symbols = [];
    const segments = [];
    const pathCanvas = new Map();
    const createdIds = [];
    const contexts = new WeakMap();
    let nextId = 0;

    const NativePath2D = w.Path2D;
    function TrackedPath2D(...args) {
      const native = new NativePath2D(...args);
      native.__id = nextId++;
      createdIds.push(native.__id);
      return native;
    }
    TrackedPath2D.prototype = NativePath2D.prototype;
    w.Path2D = TrackedPath2D;

    const originalMoveTo = NativePath2D.prototype.moveTo;
    NativePath2D.prototype.moveTo = function (x, y) {
      this.__last = { x, y };
      return originalMoveTo.call(this, x, y);
    };
    const originalLineTo = NativePath2D.prototype.lineTo;
    NativePath2D.prototype.lineTo = function (x, y) {
      const last = this.__last;
      if (last) {
        segments.push({ id: this.__id, x1: last.x, y1: last.y, x2: x, y2: y });
        this.__last = undefined;
      }
      return originalLineTo.call(this, x, y);
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const ctx = originalGetContext.apply(this, args);
      if (args[0] === "2d" && ctx) contexts.set(ctx, this);
      return ctx;
    };

    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      const candidate = args[0];
      if (candidate && typeof candidate.__id === "number") {
        pathCanvas.set(candidate.__id, contexts.get(this)?.width ?? 0);
      }
      return originalStroke.apply(this, args);
    };

    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      const value = String(text);
      const canvas = contexts.get(this);
      if (canvas && ["×", "•", "◆", "■", "▲", "+"].includes(value)) {
        symbols.push({ text: value, x, y, width: canvas.width });
      }
      return maxWidth === undefined
        ? originalFillText.call(this, text, x, y)
        : originalFillText.call(this, text, x, y, maxWidth);
    };

    w.__rosaceTrace = () => ({
      symbols,
      segments,
      pathCanvas: Array.from(pathCanvas.entries()),
      createdIds,
    });
  } catch (error) {
    w.__rosaceTraceError = String(error && error.stack ? error.stack : error);
    console.error("ROSACE trace init", error);
  }
})();
`;

async function installTrace(context: BrowserContext) {
  await context.addInitScript(TRACE_SCRIPT);
}

type Trace = {
  symbols: Array<{ text: string; x: number; y: number; width: number }>;
  segments: Array<{ id: number; x1: number; y1: number; x2: number; y2: number }>;
  pathCanvas: Array<[number, number]>;
  createdIds: number[];
};

async function readTrace(page: Page): Promise<Trace> {
  return page.evaluate(() => (window as any).__rosaceTrace());
}

function traceMatrix(trace: Trace) {
  const fabric = chartGeometry(1200, pattern.size, "fabric");
  const chart = chartGeometry(1800, pattern.size, "chart");

  const chartKeys = new Set<string>();
  for (const symbol of trace.symbols.filter((entry) => entry.width === 1800)) {
    const x = Math.round((symbol.x - chart.origin) / chart.cell);
    const y = Math.round((symbol.y - chart.cell * 0.04 - chart.origin) / chart.cell);
    chartKeys.add(keyOf(x, y, SYMBOLS.indexOf(symbol.text)));
  }

  const canvasById = new Map(trace.pathCanvas);
  const underIds = trace.createdIds
    .slice(0, pattern.config.palette.length * 5)
    .filter((_, index) => index % 5 === 1);
  assert.equal(underIds.length, pattern.config.palette.length);
  const hoopKeys = new Set<string>();
  underIds.forEach((id, color) => {
    assert.equal(canvasById.get(id), 1200);
    for (const segment of trace.segments.filter((entry) => entry.id === id)) {
      const x = Math.round(((segment.x1 + segment.x2) / 2 - fabric.origin) / fabric.cell);
      const y = Math.round(((segment.y1 + segment.y2) / 2 - fabric.origin) / fabric.cell);
      hoopKeys.add(keyOf(x, y, color));
    }
  });

  assert.equal(hoopKeys.size, expectedKeys.size);
  assert.equal(chartKeys.size, expectedKeys.size);
  for (const key of expectedKeys) {
    assert.ok(hoopKeys.has(key), `croix absente du tambour : ${key}`);
    assert.ok(chartKeys.has(key), `croix absente de la grille Broderie : ${key}`);
  }
  assert.deepEqual([...hoopKeys].sort(), [...expectedKeys].sort());
  assert.deepEqual([...chartKeys].sort(), [...expectedKeys].sort());
}

async function main() {
  assert.ok(CHROMIUM_PATH, "CHROMIUM_PATH doit désigner un binaire Chromium.");
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH, args: BROWSER_ARGS });
  console.log(`Chromium ${browser.version()} · ${BASE_URL} · artefacts ${ARTIFACT_DIR}`);

  try {
    /* ---------------- Contexte mobile principal ---------------- */
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await installTrace(mobile);
    const page = await mobile.newPage();
    page.on("pageerror", (error) => pageErrors.push(`mobile: ${error.message}`));
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.locator(".hoop-canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => (window as any).__rosaceTrace().pathCanvas.some(([, width]: [number, number]) => width === 1200));

    assert.equal(await page.locator(".crown-seg").count(), 489, "couronne chromatique incomplète");
    assert.equal(await page.locator(".dock-categorie").count(), 6);
    assert.match((await page.locator(".studio-stats p").textContent()) ?? "", /3\s?381 croix/);
    const noScroll = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
    assert.ok(noScroll, "la page défile sur mobile");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "mobile-atelier.png") });

    /* ---------------- Catalogue 489 fils ---------------- */
    await openDock(page, "Couleurs");
    await page.getByRole("button", { name: "Nuancier complet" }).click();
    await page.locator(".catalogue-liste .catalogue-fil").first().waitFor({ state: "visible" });
    const catalogCodes = await page.locator(".catalogue-fil strong").allTextContents();
    assert.equal(catalogCodes.length, DMC_ALL_THREADS.length);
    assert.deepEqual(new Set(catalogCodes), new Set(DMC_ALL_THREADS.map((thread) => `DMC ${thread.code}`)));
    let familyTotal = 0;
    for (const family of Object.keys(FAMILY_LABELS) as Array<keyof typeof FAMILY_LABELS>) {
      await page.getByRole("button", { name: FAMILY_LABELS[family], exact: true }).click();
      familyTotal += await page.locator(".catalogue-fil").count();
    }
    assert.equal(familyTotal, 489, "les filtres de famille ne couvrent pas tout le catalogue");
    await page.getByRole("button", { name: "Toutes", exact: true }).click();
    for (const code of ["B5200", "ECRU", "310", "35"]) {
      await page.getByRole("textbox", { name: "Rechercher une référence ou un nom" }).fill(code);
      const exact = await page.locator(".catalogue-fil strong").allTextContents();
      assert.ok(exact.includes(`DMC ${code}`), `référence inaccessible : ${code}`);
    }
    await page.getByRole("textbox", { name: "Rechercher une référence ou un nom" }).fill("");
    await page.keyboard.press("Escape");
    await closePanel(page);

    /* ---------------- Exports PNG / SVG / CSV / PDF ---------------- */
    await openDock(page, "Export");
    const shareUrl = await page.locator("input.champ-lien").inputValue();
    assert.match(shareUrl, /#r=/);

    const pngToile = await captureDownload(page, () => page.getByRole("button", { name: /PNG · toile/ }).click(), "toile.png");
    const pngGrid = await captureDownload(page, () => page.getByRole("button", { name: /PNG · grille/ }).click(), "grille.png");
    for (const { filePath } of [pngToile, pngGrid]) {
      const bytes = await readFile(filePath);
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.equal(bytes.readUInt32BE(16), 1600);
      assert.equal(bytes.readUInt32BE(20), 1600);
    }

    const svgMotif = await captureDownload(page, () => page.getByRole("button", { name: /SVG · motif/ }).click(), "motif.svg");
    const svgGrid = await captureDownload(page, () => page.getByRole("button", { name: /SVG · grille/ }).click(), "grille.svg");
    const motifSvg = await readFile(svgMotif.filePath, "utf8");
    const gridSvg = await readFile(svgGrid.filePath, "utf8");
    assert.ok(motifSvg.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.equal((motifSvg.match(/<g fill="none" stroke=/g) ?? []).length, pattern.config.palette.length);
    assert.ok(motifSvg.includes("craft-color-codes by MakeBead"));
    const symbolTexts = [...gridSvg.matchAll(/<text x="[\d.-]+" y="[\d.-]+">([^<]+)<\/text>/g)]
      .map((match) => match[1])
      .filter((text) => SYMBOLS.includes(text));
    assert.equal(symbolTexts.length, pattern.stitches.length);
    assert.ok(gridSvg.includes("3381 croix"));

    const csv = await captureDownload(page, () => page.getByRole("button", { name: /CSV · fournitures/ }).click(), "fils.csv");
    const csvText = await readFile(csv.filePath, "utf8");
    assert.ok(csvText.startsWith("\uFEFF"), "BOM CSV absent");
    const csvLines = csvText.trim().split("\n");
    assert.equal(csvLines.length, 2 + pattern.usage.filter((line) => line.count > 0).length);
    assert.match(csvLines[0], /Longueur de brins/);
    assert.match(csvLines.at(-1) ?? "", /^"Total";/);
    assert.match(csvLines.at(-1) ?? "", /"3381"/);

    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: /PDF · fiche technique/ }).click(),
    ]);
    await popup.waitForLoadState("domcontentloaded");
    assert.equal(await popup.locator(".tile-page").count(), 4);
    assert.equal(await popup.locator(".chart svg").count(), 4);
    assert.equal(await popup.locator(".preview svg").count(), 1);
    assert.match((await popup.locator("button.print").textContent()) ?? "", /5 pages/);
    const tileText = await popup.locator(".tile-head").allTextContents();
    assert.ok(tileText.some((line) => line.includes("Colonnes 1–51")));
    assert.ok(tileText.some((line) => line.includes("Colonnes 52–101")));
    assert.ok(tileText.some((line) => line.includes("Lignes 1–51")));
    assert.ok(tileText.some((line) => line.includes("Lignes 52–101")));
    const pdf = await popup.pdf({ printBackground: true, preferCSSPageSize: true });
    await writeFile(path.join(ARTIFACT_DIR, "fiche.pdf"), pdf);
    const pdfPages = (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    assert.equal(pdfPages, 5, `PDF : 5 pages attendues, ${pdfPages} trouvées`);
    await popup.close();

    await closePanel(page);

    /* ---------------- Matrice tambour / grille Broderie ---------------- */
    await openBroder(page);
    await page.waitForFunction(() => (window as any).__rosaceTrace().symbols.some((entry: any) => entry.width === 1800));
    const trace = await readTrace(page);
    traceMatrix(trace);
    assert.match(await progressText(page), /0 \/ 3\s?381/);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "mobile-broder.png") });

    /* ---------------- Progression, annulation, raccourcis, zoom ---------------- */
    await page.locator(".broder-canvas").focus();
    await page.keyboard.press("Space");
    await waitProgress(page, "1 / 3");
    const stored = await page.evaluate((id) => {
      const raw = localStorage.getItem(`aime-rosace-progress-v2:${id}`);
      const current = JSON.parse(localStorage.getItem("aime-rosace-current-v1") ?? "{}");
      return { raw: raw ? JSON.parse(raw) : null, current };
    }, fingerprint);
    assert.equal(stored.raw.version, 2);
    assert.equal(stored.raw.fingerprint, fingerprint);
    assert.equal(stored.raw.journal.length, 1);
    assert.ok(stored.raw.completedRuns.length > 0);
    assert.equal(stored.current.completedRuns, undefined);
    assert.equal(stored.current.journal, undefined);

    await page.getByRole("button", { name: "Annuler la dernière croix cochée" }).click();
    await waitProgress(page, "0 / 3");
    await page.getByRole("button", { name: "Rétablir la croix décochée" }).click();
    await waitProgress(page, "1 / 3");
    await page.locator(".broder-canvas").focus();
    await page.keyboard.press("Control+z");
    await waitProgress(page, "0 / 3");
    await page.keyboard.press("Control+Shift+z");
    await waitProgress(page, "1 / 3");
    await page.keyboard.press("Control+z");
    await waitProgress(page, "0 / 3");
    await page.keyboard.press("Control+y");
    await waitProgress(page, "1 / 3");
    assert.match((await page.locator(".studio-stats p").textContent()) ?? "", /3\s?381 croix/, "Ctrl Z a modifié la recette");
    assert.match((await page.locator(".broder-resume strong").textContent()) ?? "", /3\s?380/);

    await page.getByRole("button", { name: "Zéro" }).click();
    await page.getByRole("button", { name: "Confirmer le zéro" }).click();
    await waitProgress(page, "0 / 3");
    assert.equal(await page.getByRole("button", { name: "Annuler la dernière croix cochée" }).isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Rétablir la croix décochée" }).isDisabled(), true);
    await page.locator(".broder-canvas").focus();
    await page.keyboard.press("Space");
    await waitProgress(page, "1 / 3");
    assert.equal(await page.getByRole("button", { name: "Annuler la dernière croix cochée" }).isEnabled(), true);
    assert.equal(await page.getByRole("button", { name: "Rétablir la croix décochée" }).isDisabled(), true);

    await page.locator(".broder-zoom").getByRole("button", { name: "Zoom avant" }).click();
    assert.match((await page.locator(".broder-jauge").textContent()) ?? "", /125 %/);
    await page.locator(".broder-zoom").getByRole("button", { name: "Ajuster la grille à l'écran" }).click();
    assert.match((await page.locator(".broder-jauge").textContent()) ?? "", /100 %/);
    await page.getByRole("button", { name: "Restants" }).click();
    assert.equal(await page.getByRole("button", { name: "Restants" }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Ce fil" }).click();
    assert.equal(await page.getByRole("button", { name: "Ce fil" }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Tout" }).click();

    const broderProject = await captureDownload(page, () => page.getByRole("button", { name: /Projet/ }).click(), "projet-broder.json");
    const broderJson = JSON.parse(await readFile(broderProject.filePath, "utf8"));
    assert.equal(broderJson.format, PROJECT_FORMAT);
    assert.equal(broderJson.version, PROJECT_VERSION);
    assert.equal(broderJson.fingerprint, fingerprint);
    assert.equal(broderJson.progress.journal.length, 1);
    assert.ok(broderJson.progress.completedRuns.length > 0);
    await closeBroder(page);

    /* ---------------- Reprise, projet unique, import ---------------- */
    await openBroder(page);
    await waitProgress(page, "1 / 3");
    await closeBroder(page);

    await openDock(page, "Export");
    const panelProject = await captureDownload(page, () => page.getByRole("button", { name: /Exporter le projet/ }).click(), "projet-export.json");
    const panelJson = JSON.parse(await readFile(panelProject.filePath, "utf8"));
    for (const key of ["format", "version", "fingerprint", "config"] as const) {
      assert.deepEqual(panelJson[key], broderJson[key], `divergence projet : ${key}`);
    }
    for (const key of ["completedRuns", "selectedCode", "journal", "viewport"] as const) {
      assert.deepEqual(panelJson.progress[key], broderJson.progress[key], `divergence progression : ${key}`);
    }
    await page.locator('input[aria-label="Importer un projet ROSACE"]').setInputFiles(broderProject.filePath);
    await page.locator(".toast").filter({ hasText: "Projet importé" }).waitFor({ state: "visible" });
    await closePanel(page);
    await openBroder(page);
    await waitProgress(page, "1 / 3");
    await page.locator('input[aria-label="Importer un projet ROSACE"]').setInputFiles(broderProject.filePath);
    await page.locator(".toast").filter({ hasText: "Projet importé" }).waitFor({ state: "visible" });
    await page.locator(".broder").waitFor({ state: "detached" });
    await openBroder(page);
    await waitProgress(page, "1 / 3");
    assert.match((await page.locator(".broder-resume strong").textContent()) ?? "", /3\s?380/);
    assert.equal(await page.getByRole("button", { name: "Annuler la dernière croix cochée" }).isEnabled(), true);
    assert.equal(await page.getByRole("button", { name: "Rétablir la croix décochée" }).isDisabled(), true);
    await closeBroder(page);

    /* ---------------- Paramètres textiles : même empreinte ---------------- */
    await openDock(page, "Réglages");
    await page.getByRole("button", { name: "Aïda 18" }).click();
    await page.getByRole("button", { name: "5 brins" }).click();
    await page.locator('input[type="range"][aria-label^="Marge de sécurité"]').fill("30");
    await closePanel(page);
    await openBroder(page);
    const textileFooter = (await page.locator(".broder-resume p").textContent()) ?? "";
    assert.ok(textileFooter.includes(shortId), "l'empreinte a changé avec l'Aïda ou les brins");
    assert.match(await progressText(page), /1 \/ 3/);
    await closeBroder(page);

    /* ---------------- Palette : nouvelle empreinte, nouvelle progression ---------------- */
    await openDock(page, "Couleurs");
    await page.getByRole("button", { name: "Nuancier complet" }).click();
    await page.getByRole("textbox", { name: "Rechercher une référence ou un nom" }).fill("310");
    await page.locator(".catalogue-fil").filter({ hasText: "DMC 310" }).first().click();
    await page.locator(".modal-card").waitFor({ state: "detached" });
    await closePanel(page);
    await openBroder(page);
    const paletteFooter = (await page.locator(".broder-resume p").textContent()) ?? "";
    assert.ok(!paletteFooter.includes(shortId), "l'empreinte n'a pas changé avec la palette");
    assert.match(await progressText(page), /0 \/ 3/);
    await closeBroder(page);

    await openDock(page, "Réglages");
    await page.getByRole("button", { name: /Réinitialiser la rosace/ }).click();
    await closePanel(page);
    assert.match((await page.locator(".studio-stats p").textContent()) ?? "", /3\s?381 croix/);
    await openBroder(page);
    assert.ok(((await page.locator(".broder-resume p").textContent()) ?? "").includes(shortId));
    await waitProgress(page, "1 / 3");
    await closeBroder(page);

    /* ---------------- Lien de partage et anciennes recettes ---------------- */
    const sharedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const sharedPage = await sharedContext.newPage();
    sharedPage.on("pageerror", (error) => pageErrors.push(`partage: ${error.message}`));
    await sharedPage.goto(shareUrl, { waitUntil: "domcontentloaded" });
    await sharedPage.locator(".hoop-canvas").waitFor({ state: "visible" });
    const sharedConfig = await sharedPage.evaluate(() => JSON.parse(localStorage.getItem("aime-rosace-current-v1") ?? "{}"));
    assert.deepEqual(sharedConfig, normalizeConfig(DEFAULT_CONFIG));
    assert.match((await sharedPage.locator(".studio-stats p").textContent()) ?? "", /3\s?381 croix/);

    const legacy = normalizeConfig({ ...DEFAULT_CONFIG, seed: 123, palette: ["blanc", "ecru", "310", "902", "3607"] });
    const legacyUrl = `${BASE_URL}#r=${encodeConfig(legacy)}`;
    const legacyContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const legacyPage = await legacyContext.newPage();
    legacyPage.on("pageerror", (error) => pageErrors.push(`legacy: ${error.message}`));
    await legacyPage.goto(legacyUrl, { waitUntil: "domcontentloaded" });
    await legacyPage.locator(".hoop-canvas").waitFor({ state: "visible" });
    const legacyConfig = await legacyPage.evaluate(() => JSON.parse(localStorage.getItem("aime-rosace-current-v1") ?? "{}"));
    assert.deepEqual(legacyConfig.palette, ["BLANC", "ECRU", "310", "902", "3607"]);
    assert.equal(legacyConfig.seed, 123);
    await legacyPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await legacyPage.evaluate(() => {
      localStorage.setItem("aime-rosace-favorites-v1", JSON.stringify([{
        id: "legacy-1", name: "Ancienne recette", createdAt: new Date().toISOString(), stitches: 3381,
        config: { ...JSON.parse(localStorage.getItem("aime-rosace-current-v1") ?? "{}"), palette: ["blanc", "ecru", "310", "902", "3607"] },
      }]));
    });
    await legacyPage.reload({ waitUntil: "domcontentloaded" });
    const favoritePalette = await legacyPage.evaluate(() => JSON.parse(localStorage.getItem("aime-rosace-favorites-v1") ?? "[]")[0].config.palette);
    assert.deepEqual(favoritePalette, ["BLANC", "ECRU", "310", "902", "3607"]);
    await openDock(legacyPage, "Collection");
    assert.equal(await legacyPage.locator(".collection-carte").count(), 1);
    await sharedContext.close();
    await legacyContext.close();

    /* ---------------- Bureau ---------------- */
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktopPage = await desktop.newPage();
    desktopPage.on("pageerror", (error) => pageErrors.push(`bureau: ${error.message}`));
    await desktopPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await desktopPage.locator(".hoop-canvas").waitFor({ state: "visible" });
    assert.equal(await desktopPage.locator(".crown-seg").count(), 489);
    assert.ok(await desktopPage.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1));
    assert.equal(await desktopPage.locator(".studio-dock").evaluate((el) => getComputedStyle(el).flexDirection), "column");
    await openDock(desktopPage, "Export");
    assert.equal(await desktopPage.locator(".studio-panel").evaluate((el) => Math.round(el.getBoundingClientRect().width)), 384);
    await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, "bureau-export.png") });
    await closePanel(desktopPage);
    await desktop.close();
    await mobile.close();

    assert.deepEqual(pageErrors, [], `erreurs JavaScript : ${pageErrors.join(" | ")}`);
    console.log(`\nParcours navigateur réussis · ${ARTIFACT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
