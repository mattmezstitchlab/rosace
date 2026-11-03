/**
 * Contrôles qualité non bloquants : accessibilité automatisée, clavier et réduction des animations.
 * Le script rapporte ses résultats sans faire échouer la PR.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR ?? path.join(os.tmpdir(), "rosace-browser-artifacts");
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find(existsSync);
const BROWSER_ARGS = (process.env.BROWSER_ARGS ?? "--no-sandbox --disable-dev-shm-usage --disable-gpu").split(" ").filter(Boolean);

async function main() {
  if (!CHROMIUM_PATH) {
    console.log("Contrôles qualité ignorés : CHROMIUM_PATH absent.");
    return;
  }
  await mkdir(ARTIFACT_DIR, { recursive: true });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH, args: BROWSER_ARGS });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.locator(".hoop-canvas").waitFor({ state: "visible" });

    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    await page.keyboard.press("Tab");
    const firstFocus = await page.evaluate(() => document.activeElement?.tagName ?? "");
    await page.locator(".dock-categorie").first().focus();
    await page.keyboard.press("Enter");
    const panelOpened = await page.locator(".studio-panel").count();
    await page.keyboard.press("Escape");
    const panelClosed = (await page.locator(".studio-panel").count()) === 0;

    const results = await new AxeBuilder({ page }).analyze();
    const report = {
      baseUrl: BASE_URL,
      reducedMotionRespected: reduced,
      firstFocusTag: firstFocus,
      keyboardOpenedPanel: panelOpened > 0,
      escapeClosedPanel: panelClosed,
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        help: violation.help,
      })),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    };
    await writeFile(path.join(ARTIFACT_DIR, "accessibilite.json"), JSON.stringify(report, null, 2));
    console.log(`Contrôles qualité · ${report.violations.length} violation(s) axe · ${ARTIFACT_DIR}/accessibilite.json`);
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error("Contrôles qualité non exécutés :", error);
  process.exitCode = 0;
});
