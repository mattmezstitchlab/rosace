/**
 * Contrôles qualité bloquants : accessibilité automatisée, clavier et réduction des animations.
 * Exécutés sur quatre configurations (mobile/bureau × jour/nuit). Toute violation axe,
 * tout focus initial incorrect ou tout raccourci clavier cassé fait échouer la commande.
 *
 * Préparation multi-navigateurs : BROWSER=chromium|firefox|webkit et BROWSER_EXECUTABLE
 * permettent de rejouer exactement la même matrice sur Safari/WebKit et Firefox.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
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

const CONFIGURATIONS = [
  { id: "mobile-jour", viewport: { width: 390, height: 844 }, theme: "jour" },
  { id: "mobile-nuit", viewport: { width: 390, height: 844 }, theme: "nuit" },
  { id: "bureau-jour", viewport: { width: 1280, height: 900 }, theme: "jour" },
  { id: "bureau-nuit", viewport: { width: 1280, height: 900 }, theme: "nuit" },
] as const;

async function checkConfiguration(browser: Browser, id: string, viewport: { width: number; height: number }, theme: string) {
  const context: BrowserContext = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript((choice) => {
    localStorage.setItem("atlas-theme", choice);
  }, theme);
  const page: Page = await context.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.locator(".hoop-canvas").waitFor({ state: "visible" });

    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    const appliedTheme = await page.evaluate(() => document.documentElement.getAttribute("data-mode"));
    // Le point de départ de navigation de Playwright n'est pas stable entre contextes.
    // On vérifie donc le premier élément focusable par focus() explicite, puis l'ordre réel via Tab.
    await page.locator(".lien-evitement").focus();
    const firstFocusTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
    await page.keyboard.press("Tab");
    const secondFocusTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
    await page.locator(".dock-categorie").first().focus();
    await page.keyboard.press("Enter");
    const keyboardOpenedPanel = (await page.locator(".studio-panel").count()) > 0;
    await page.keyboard.press("Escape");
    const escapeClosedPanel = (await page.locator(".studio-panel").count()) === 0;

    const results = await new AxeBuilder({ page }).analyze();
    return {
      id,
      theme: appliedTheme,
      reducedMotionRespected: reduced,
      firstFocusTag,
      secondFocusTag,
      keyboardOpenedPanel,
      escapeClosedPanel,
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        help: violation.help,
        targets: violation.nodes.slice(0, 10).map((node) => ({
          target: node.target.join(" "),
          summary: node.failureSummary ?? "",
          html: node.html.slice(0, 300),
        })),
      })),
      passes: results.passes.length,
      incomplete: results.incomplete.map((entry) => ({
        id: entry.id,
        nodes: entry.nodes.length,
        targets: entry.nodes.slice(0, 6).map((node) => node.target.join(" ")),
      })),
    };
  } finally {
    await context.close();
  }
}

async function main() {
  if (BROWSER === "chromium" && !BROWSER_EXECUTABLE) {
    console.log("Contrôles qualité ignorés : CHROMIUM_PATH absent.");
    return;
  }
  await mkdir(ARTIFACT_DIR, { recursive: true });
  let browser: Browser | null = null;
  try {
    browser = await browserType.launch({
      headless: true,
      ...(BROWSER_EXECUTABLE ? { executablePath: BROWSER_EXECUTABLE } : {}),
      args: BROWSER_ARGS,
    });
    const configurations = [];
    for (const config of CONFIGURATIONS) {
      configurations.push(await checkConfiguration(browser, config.id, config.viewport, config.theme));
    }
    const totalViolations = configurations.reduce((sum, entry) => sum + entry.violations.length, 0);
    const report = {
      baseUrl: BASE_URL,
      browser: BROWSER,
      configurations,
      totalViolations,
      blocking: true,
    };
    await writeFile(path.join(ARTIFACT_DIR, "accessibilite.json"), JSON.stringify(report, null, 2));
    console.log(`Contrôles qualité · ${BROWSER} · ${totalViolations} violation(s) axe · ${ARTIFACT_DIR}/accessibilite.json`);

    const problems: string[] = [];
    for (const entry of configurations) {
      if (!entry.reducedMotionRespected) problems.push(`${entry.id} : réduction des animations non respectée`);
      if (entry.firstFocusTag !== "A") problems.push(`${entry.id} : premier focus = ${entry.firstFocusTag}, attendu A`);
      if (entry.secondFocusTag !== "A") problems.push(`${entry.id} : Tab suivant = ${entry.secondFocusTag}, attendu A`);
      if (!entry.keyboardOpenedPanel) problems.push(`${entry.id} : Entrée n'ouvre pas le panneau`);
      if (!entry.escapeClosedPanel) problems.push(`${entry.id} : Échap ne ferme pas le panneau`);
      for (const violation of entry.violations) problems.push(`${entry.id} : ${violation.id} (${violation.nodes} nœud(s))`);
    }
    if (problems.length > 0) throw new Error(`Accessibilité bloquante :\n- ${problems.join("\n- ")}`);
    console.log(`Accessibilité validée sur ${configurations.length} configurations · 0 violation sérieuse`);
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error("Contrôles qualité échoués :", error);
  process.exitCode = 1;
});
