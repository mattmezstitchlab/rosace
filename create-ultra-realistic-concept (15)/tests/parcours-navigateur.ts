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
import { chromium, firefox, webkit, type BrowserContext, type Page } from "playwright-core";
import { DMC_ALL_THREADS, FAMILY_LABELS } from "../src/data/dmc";
import { shortFingerprint, patternFingerprint } from "../src/lib/pattern-id";
import { chartGeometry } from "../src/lib/paint";
import {
  DEFAULT_CONFIG, GEOMETRY_COUNT, GEOMETRY_NAMES, SYMBOLS, decodeConfig, encodeConfig,
  generateRosace, normalizeConfig,
} from "../src/lib/rosace";
import {
  LEGACY_PROGRESS_STORAGE_PREFIXES, LEGACY_PROJECT_VERSION, PROJECT_FORMAT, PROJECT_VERSION,
  progressStorageKey, serializeRuns, stitchIndex,
} from "../src/lib/progress";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
/** La présentation est la page d'accueil ; l'atelier s'ouvre sur #atelier. */
const STUDIO_URL = `${BASE_URL}#atelier`;
const ARTIFACT_DIR = process.env.ARTIFACT_DIR ?? path.join(os.tmpdir(), "rosace-browser-artifacts");
const BROWSER = process.env.BROWSER ?? "chromium";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find(existsSync);
const BROWSER_EXECUTABLE = process.env.BROWSER_EXECUTABLE ?? (BROWSER === "chromium" ? CHROMIUM_PATH : undefined);
const BROWSER_ARGS = (process.env.BROWSER_ARGS ?? "--no-sandbox --disable-dev-shm-usage --disable-gpu").split(" ").filter(Boolean);
const browserType = BROWSER === "firefox" ? firefox : BROWSER === "webkit" ? webkit : chromium;

const pattern = generateRosace(DEFAULT_CONFIG);
const fractale = generateRosace({ ...DEFAULT_CONFIG, geometry: GEOMETRY_COUNT });
const fingerprint = patternFingerprint(pattern);
const fractaleFingerprint = patternFingerprint(fractale);
const shortId = shortFingerprint(fingerprint);
const expectedKeys = new Set(pattern.stitches.map((stitch) => `${stitch.x}:${stitch.y}:${stitch.color}`));
const pageErrors: string[] = [];

function keyOf(x: number, y: number, color: number) {
  return `${x}:${y}:${color}`;
}

/** Signature sémantique d'un SVG : insensible à la sérialisation auto-fermante du navigateur. */
function svgSignature(svg: string) {
  return {
    width: svg.match(/<svg[^>]*\bwidth="([^"]+)"/)?.[1] ?? "",
    height: svg.match(/<svg[^>]*\bheight="([^"]+)"/)?.[1] ?? "",
    viewBox: svg.match(/<svg[^>]*\bviewBox="([^"]+)"/)?.[1] ?? "",
    title: svg.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "",
    desc: svg.match(/<desc>([\s\S]*?)<\/desc>/)?.[1] ?? "",
    metadata: svg.match(/<metadata>([\s\S]*?)<\/metadata>/)?.[1] ?? "",
    groups: [...svg.matchAll(/<g fill="none" stroke="([^"]+)"/g)].map((match) => match[1]),
    paths: [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]),
  };
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
  const panel = page.locator(".studio-panel");
  if (await panel.count() === 0) return;
  await panel.getByRole("button", { name: "Fermer le panneau" }).click({ timeout: 2000 }).catch(() => {});
  await panel.waitFor({ state: "detached" });
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

/** Clique sur une case réelle de la grille Broderie, en coordonnées écran. */
async function clickStitch(page: Page, stitch: { x: number; y: number }) {
  const rect = await page.locator(".broder-canvas").evaluate((canvas) => {
    const r = canvas.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const chart = chartGeometry(1800, pattern.size, "chart");
  const fit = Math.min(rect.width, rect.height) * 0.985 / 1800;
  const bx = -900 + chart.origin + stitch.x * chart.cell;
  const by = -900 + chart.origin + stitch.y * chart.cell;
  await page.mouse.click(
    rect.left + rect.width / 2 + fit * bx,
    rect.top + rect.height / 2 + fit * by,
  );
}

function trackErrors(page: Page, label: string) {
  page.on("pageerror", (error) => pageErrors.push(`${label}: ${error.message}`));
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
  if (BROWSER === "chromium") assert.ok(BROWSER_EXECUTABLE, "CHROMIUM_PATH doit désigner un binaire Chromium.");
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await browserType.launch({
    headless: true,
    ...(BROWSER_EXECUTABLE ? { executablePath: BROWSER_EXECUTABLE } : {}),
    args: BROWSER_ARGS,
  });
  console.log(`${BROWSER} ${browser.version()} · ${BASE_URL} · artefacts ${ARTIFACT_DIR}`);

  try {
    /* ---------------- Contexte mobile principal ---------------- */
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await installTrace(mobile);
    const page = await mobile.newPage();
    page.on("pageerror", (error) => pageErrors.push(`mobile: ${error.message}`));
    await page.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    await page.locator(".hoop-canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => (window as any).__rosaceTrace().pathCanvas.some(([, width]: [number, number]) => width === 1200));

    assert.equal(await page.locator(".crown-seg").count(), 489, "couronne chromatique incomplète");
    assert.equal(await page.locator(".dock-categorie").count(), 7, "sept verbes dans le dock : Composer, Colorer, Ajuster, Broder, Sauvegarder, Exporter, Importer");
    assert.match((await page.locator(".studio-stats p").textContent()) ?? "", /3\s?381 croix/);
    const noScroll = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
    assert.ok(noScroll, "la page défile sur mobile");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "mobile-atelier.png") });

    /* ---------------- Catalogue 489 fils ---------------- */
    await openDock(page, "Colorer");
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
    await openDock(page, "Exporter");
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
    const pdfPreviewSvg = await popup.locator(".preview svg").evaluate((svg) => svg.outerHTML);
    assert.deepEqual(
      svgSignature(pdfPreviewSvg),
      svgSignature(motifSvg.replace(/^<\?xml[^>]*>\s*/, "")),
      "l'aperçu PDF ne correspond pas au SVG motif exporté",
    );
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

    await openDock(page, "Exporter");
    const panelProject = await captureDownload(page, () => page.getByRole("button", { name: /Exporter le projet/ }).click(), "projet-export.json");
    const panelJson = JSON.parse(await readFile(panelProject.filePath, "utf8"));
    for (const key of ["format", "version", "fingerprint", "config"] as const) {
      assert.deepEqual(panelJson[key], broderJson[key], `divergence projet : ${key}`);
    }
    for (const key of ["completedRuns", "selectedCode", "journal", "viewport"] as const) {
      assert.deepEqual(panelJson.progress[key], broderJson.progress[key], `divergence progression : ${key}`);
    }
    await page.locator('input[aria-label="Importer un projet ROSACE"]').setInputFiles(broderProject.filePath);
    await page.locator(".toast").filter({ hasText: "Projet importé" }).last().waitFor({ state: "visible" });
    await closePanel(page);
    await openBroder(page);
    await waitProgress(page, "1 / 3");
    await page.locator('input[aria-label="Importer un projet ROSACE"]').setInputFiles(broderProject.filePath);
    await page.locator(".toast").filter({ hasText: "Projet importé" }).last().waitFor({ state: "visible" });
    await page.locator(".broder").waitFor({ state: "detached" });
    await openBroder(page);
    await waitProgress(page, "1 / 3");
    assert.match((await page.locator(".broder-resume strong").textContent()) ?? "", /3\s?380/);
    assert.equal(await page.getByRole("button", { name: "Annuler la dernière croix cochée" }).isEnabled(), true);
    assert.equal(await page.getByRole("button", { name: "Rétablir la croix décochée" }).isDisabled(), true);
    await closeBroder(page);

    /* ---------------- Paramètres textiles : même empreinte ---------------- */
    await openDock(page, "Ajuster");
    await page.getByRole("button", { name: "Aïda 18", exact: true }).click();
    await page.getByRole("button", { name: "5 brins" }).click();
    await page.locator('input[type="range"][aria-label^="Marge de sécurité"]').fill("30");
    await closePanel(page);
    await openBroder(page);
    const textileFooter = (await page.locator(".broder-resume p").textContent()) ?? "";
    assert.ok(textileFooter.includes(shortId), "l'empreinte a changé avec l'Aïda ou les brins");
    assert.match(await progressText(page), /1 \/ 3/);
    await closeBroder(page);

    /* ---------------- Palette : nouvelle empreinte, nouvelle progression ---------------- */
    await openDock(page, "Colorer");
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

    await openDock(page, "Ajuster");
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
    await legacyPage.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    await legacyPage.evaluate(() => {
      localStorage.setItem("aime-rosace-favorites-v1", JSON.stringify([{
        id: "legacy-1", name: "Ancienne recette", createdAt: new Date().toISOString(), stitches: 3381,
        config: { ...JSON.parse(localStorage.getItem("aime-rosace-current-v1") ?? "{}"), palette: ["blanc", "ecru", "310", "902", "3607"] },
      }]));
    });
    await legacyPage.reload({ waitUntil: "domcontentloaded" });
    const favoritePalette = await legacyPage.evaluate(() => JSON.parse(localStorage.getItem("aime-rosace-favorites-v1") ?? "[]")[0].config.palette);
    assert.deepEqual(favoritePalette, ["BLANC", "ECRU", "310", "902", "3607"]);
    await openDock(legacyPage, "Sauvegarder");
    assert.equal(await legacyPage.locator(".collection-carte").count(), 1);
    await sharedContext.close();
    await legacyContext.close();

    /* ---------------- Création, annuler/rétablir, Échap avec focus ---------------- */
    const recipeContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const recipePage = await recipeContext.newPage();
    trackErrors(recipePage, "recette");
    await recipePage.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    await recipePage.locator(".hoop-canvas").waitFor({ state: "visible" });
    const readSeed = async () => {
      const hash = await recipePage.evaluate(() => window.location.hash);
      const encoded = hash.match(/^#r=([A-Za-z0-9_-]+)/)?.[1] ?? "";
      return decodeConfig(encoded)?.seed ?? null;
    };
    const seedBefore = await readSeed();
    await openDock(recipePage, "Ajuster");
    await recipePage.getByRole("button", { name: "Tirer une signature" }).click();
    const seedVaried = await readSeed();
    assert.notEqual(seedVaried, seedBefore, "la création d'une rosace n'a pas changé la signature");
    await recipePage.getByRole("button", { name: "Annuler le dernier réglage" }).click();
    assert.equal(await readSeed(), seedBefore, "Annuler n'a pas restauré la recette");
    await recipePage.getByRole("button", { name: "Rétablir le réglage annulé" }).click();
    assert.equal(await readSeed(), seedVaried, "Rétablir n'a pas restauré la variante");
    await recipePage.locator('.studio-panel input[type="range"]').first().focus();
    await recipePage.keyboard.press("Escape");
    await recipePage.locator(".studio-panel").waitFor({ state: "detached" });
    await recipeContext.close();

    /* ---------------- Six familles géométriques, sur les cinq structures ---------------- */
    const geometryContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
    const geometryPage = await geometryContext.newPage();
    trackErrors(geometryPage, "geometries");
    await geometryPage.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    await geometryPage.locator(".hoop-canvas").waitFor({ state: "visible" });
    await openDock(geometryPage, "Composer");
    const geometrySlider = geometryPage.locator('input[aria-label="Géométrie"]');
    assert.equal(await geometrySlider.getAttribute("max"), String(GEOMETRY_COUNT));
    assert.equal(await geometryPage.locator('input[type="range"]').count(), 7);
    const geometryStats = new Set<string>();
    for (let geometry = 1; geometry <= GEOMETRY_COUNT; geometry += 1) {
      await geometrySlider.fill(String(geometry));
      await geometryPage.waitForTimeout(120);
      assert.equal(await geometrySlider.inputValue(), String(geometry));
      assert.match((await geometrySlider.getAttribute("aria-valuetext")) ?? "", new RegExp(GEOMETRY_NAMES[geometry - 1]));
      const stats = (await geometryPage.locator(".studio-stats p").textContent())?.trim() ?? "";
      geometryStats.add(stats);
      await geometryPage.keyboard.press("Escape");
      await geometryPage.locator(".studio-panel").waitFor({ state: "detached" });
      await geometryPage.locator(".hoop-canvas").screenshot({ path: path.join(ARTIFACT_DIR, `geometrie-${geometry}.png`) });
      if (geometry < GEOMETRY_COUNT) await openDock(geometryPage, "Composer");
    }
    assert.equal(geometryStats.size, GEOMETRY_COUNT, "deux familles affichent le même nombre de croix");
    await openDock(geometryPage, "Composer");
    await geometrySlider.fill("1");
    await geometryPage.waitForTimeout(120);
    assert.match((await geometryPage.locator(".studio-stats p").textContent()) ?? "", /3\s?381 croix/, "retour à la corolle classique impossible");

    /* Export / réimport d'une géométrie non classique avec progression conservée */
    await geometrySlider.fill(String(GEOMETRY_COUNT));
    await geometryPage.waitForTimeout(120);
    await closePanel(geometryPage);
    await openBroder(geometryPage);
    await clickStitch(geometryPage, fractale.stitches[0]);
    await waitProgress(geometryPage, "1 /");
    await closeBroder(geometryPage);
    await openDock(geometryPage, "Exporter");
    const fractaleProject = await captureDownload(
      geometryPage,
      () => geometryPage.getByRole("button", { name: /Exporter le projet/ }).click(),
      "projet-fractale.json",
    );
    const fractaleJson = JSON.parse(await readFile(fractaleProject.filePath, "utf8"));
    assert.equal(fractaleJson.format, PROJECT_FORMAT);
    assert.equal(fractaleJson.version, PROJECT_VERSION);
    assert.equal(fractaleJson.config.geometry, GEOMETRY_COUNT);
    assert.equal(fractaleJson.fingerprint, fractaleFingerprint, "l'empreinte ne suit pas la géométrie");
    assert.ok(String(fractaleJson.progress.completedRuns).length > 0, "progression absente du projet exporté");
    await geometryPage.locator('input[aria-label="Importer un projet ROSACE"]').setInputFiles(fractaleProject.filePath);
    await geometryPage.locator(".toast").filter({ hasText: "Projet importé" }).last().waitFor({ state: "visible" });
    await closePanel(geometryPage);
    await openBroder(geometryPage);
    await waitProgress(geometryPage, "1 /");
    await closeBroder(geometryPage);
    await geometryContext.close();

    /* ---------------- hashchange, popstate, retour / avant ---------------- */
    const navContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const navPage = await navContext.newPage();
    trackErrors(navPage, "navigation");
    await navPage.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    const configA = normalizeConfig({ ...DEFAULT_CONFIG, seed: 123, palette: [...DEFAULT_CONFIG.palette] });
    const configB = normalizeConfig({ ...DEFAULT_CONFIG, seed: 456, palette: [...DEFAULT_CONFIG.palette] });
    const hashA = `#r=${encodeConfig(configA)}`;
    const hashB = `#r=${encodeConfig(configB)}`;
    const storedSeed = () => navPage.evaluate(() => JSON.parse(localStorage.getItem("aime-rosace-current-v1") ?? "{}").seed ?? null);
    await navPage.evaluate((hash) => { window.location.hash = hash; }, hashA);
    await navPage.waitForFunction((hash) => window.location.hash === hash, hashA);
    assert.equal(await storedSeed(), 123, "hashchange n'a pas appliqué la recette");
    await navPage.evaluate((hash) => { window.location.hash = hash; }, hashB);
    await navPage.waitForFunction((hash) => window.location.hash === hash, hashB);
    assert.equal(await storedSeed(), 456, "le second lien de recette n'a pas été appliqué");
    await navPage.goBack();
    await navPage.waitForFunction((hash) => window.location.hash === hash, hashA);
    assert.equal(await storedSeed(), 123, "le retour navigateur n'a pas restauré la recette");
    await navPage.goForward();
    await navPage.waitForFunction((hash) => window.location.hash === hash, hashB);
    assert.equal(await storedSeed(), 456, "l'avant navigateur n'a pas restauré la recette");
    await navContext.close();

    /* ---------------- Projet v1 : migration et message de compatibilité ---------------- */
    const v1Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const v1Page = await v1Context.newPage();
    trackErrors(v1Page, "projet v1");
    await v1Page.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    const [firstStitch, secondStitch] = pattern.stitches.slice(0, 2);
    const legacyIndices = [stitchIndex(pattern.size, firstStitch.x, firstStitch.y), stitchIndex(pattern.size, secondStitch.x, secondStitch.y)];
    const legacyProject = {
      format: PROJECT_FORMAT,
      version: LEGACY_PROJECT_VERSION,
      fingerprint: "ANCIENNE_EMPREINTE",
      config: { ...DEFAULT_CONFIG, palette: [...DEFAULT_CONFIG.palette] },
      progress: {
        completed: legacyIndices,
        selectedCode: "902",
        viewport: { k: 1, x: 0, y: 0 },
        journal: [],
        updatedAt: "2026-11-03T00:00:00.000Z",
      },
    };
    const v1Path = path.join(ARTIFACT_DIR, "projet-v1.json");
    await writeFile(v1Path, JSON.stringify(legacyProject, null, 2));
    await openDock(v1Page, "Exporter");
    await v1Page.locator('input[aria-label="Importer un projet ROSACE"]').setInputFiles(v1Path);
    await v1Page.locator(".toast").filter({ hasText: "Projet version 1 migré" }).waitFor({ state: "visible" });
    await closePanel(v1Page);
    await openBroder(v1Page);
    await waitProgress(v1Page, "2 / 3");
    await closeBroder(v1Page);
    const badV1Path = path.join(ARTIFACT_DIR, "projet-v1-inconnu.json");
    await writeFile(badV1Path, JSON.stringify({
      format: PROJECT_FORMAT,
      version: LEGACY_PROJECT_VERSION,
      config: { ...DEFAULT_CONFIG, palette: [...DEFAULT_CONFIG.palette] },
      progress: { mystere: true },
    }, null, 2));
    await openDock(v1Page, "Exporter");
    await v1Page.locator('input[aria-label="Importer un projet ROSACE"]').setInputFiles(badV1Path);
    const refusal = v1Page.locator(".toast").filter({ hasText: "Projet refusé" });
    await refusal.waitFor({ state: "visible" });
    assert.match((await refusal.textContent()) ?? "", /version 1/);
    await closePanel(v1Page);
    await v1Context.close();

    /* ---------------- Progression concurrente entre deux onglets ---------------- */
    const syncContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tabA = await syncContext.newPage();
    const tabB = await syncContext.newPage();
    trackErrors(tabA, "onglet A");
    trackErrors(tabB, "onglet B");
    await Promise.all([
      tabA.goto(STUDIO_URL, { waitUntil: "domcontentloaded" }),
      tabB.goto(STUDIO_URL, { waitUntil: "domcontentloaded" }),
    ]);
    await Promise.all([
      tabA.locator(".hoop-canvas").waitFor({ state: "visible" }),
      tabB.locator(".hoop-canvas").waitFor({ state: "visible" }),
    ]);
    await openBroder(tabA);
    await openBroder(tabB);
    const stitchA = pattern.stitches[0];
    const stitchB = pattern.stitches.find((stitch) => stitch.x !== stitchA.x || stitch.y !== stitchA.y)!;
    const indexA = stitchIndex(pattern.size, stitchA.x, stitchA.y);
    const indexB = stitchIndex(pattern.size, stitchB.x, stitchB.y);
    await clickStitch(tabA, stitchA);
    await waitProgress(tabA, "1 / 3");
    await waitProgress(tabB, "1 / 3");
    await clickStitch(tabB, stitchB);
    await waitProgress(tabB, "2 / 3");
    await waitProgress(tabA, "2 / 3");
    const synced = await tabA.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), progressStorageKey(fingerprint));
    assert.equal(synced.completedRuns, serializeRuns([indexA, indexB]));
    await closeBroder(tabA);
    await closeBroder(tabB);
    await syncContext.close();

    /* ---------------- Stockage corrompu, ancienne clé v1, quota dépassé ---------------- */
    const corruptContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const corruptPage = await corruptContext.newPage();
    trackErrors(corruptPage, "stockage corrompu");
    await corruptPage.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    await corruptPage.evaluate((key) => localStorage.setItem(key, "{JSON INVALIDE"), progressStorageKey(fingerprint));
    await corruptPage.reload({ waitUntil: "domcontentloaded" });
    await openBroder(corruptPage);
    await waitProgress(corruptPage, "0 / 3");
    await closeBroder(corruptPage);
    await corruptPage.evaluate((key) => localStorage.removeItem(key), progressStorageKey(fingerprint));
    await corruptContext.close();

    const legacyStorageContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const legacyStoragePage = await legacyStorageContext.newPage();
    trackErrors(legacyStoragePage, "ancienne clé v1");
    await legacyStoragePage.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    await legacyStoragePage.evaluate(([key, record]) => localStorage.setItem(key, JSON.stringify(record)), [
      `${LEGACY_PROGRESS_STORAGE_PREFIXES[0]}${fingerprint}`,
      { completed: [indexA], selectedCode: "902", viewport: { k: 1, x: 0, y: 0 }, journal: [], updatedAt: "2026-11-03T00:00:00.000Z" },
    ] as [string, unknown]);
    await legacyStoragePage.reload({ waitUntil: "domcontentloaded" });
    await openBroder(legacyStoragePage);
    await waitProgress(legacyStoragePage, "1 / 3");
    await closeBroder(legacyStoragePage);
    await legacyStorageContext.close();

    const quotaContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const quotaPage = await quotaContext.newPage();
    trackErrors(quotaPage, "quota");
    await quotaPage.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    await quotaPage.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (String(key).startsWith("aime-rosace-progress-v2:")) throw new DOMException("Quota dépassé", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    await openBroder(quotaPage);
    await quotaPage.locator(".broder-canvas").focus();
    await quotaPage.keyboard.press("Space");
    await quotaPage.locator(".toast").filter({ hasText: "Progression non enregistrée" }).waitFor({ state: "visible" });
    await closeBroder(quotaPage);
    await quotaContext.close();

    /* ---------------- Bureau ---------------- */
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktopPage = await desktop.newPage();
    desktopPage.on("pageerror", (error) => pageErrors.push(`bureau: ${error.message}`));
    await desktopPage.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    await desktopPage.locator(".hoop-canvas").waitFor({ state: "visible" });
    assert.equal(await desktopPage.locator(".crown-seg").count(), 489);
    assert.ok(await desktopPage.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1));
    assert.equal(await desktopPage.locator(".studio-dock").evaluate((el) => getComputedStyle(el).flexDirection), "column");
    await openDock(desktopPage, "Exporter");
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
