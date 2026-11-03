/**
 * Fumage du build de production réellement servi par `npm run preview`.
 * Vérifie le singlefile, l'absence de client Vite, le rendu de base et une action fonctionnelle.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, firefox, webkit, type Browser } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
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

if (BROWSER === "chromium") assert.ok(BROWSER_EXECUTABLE, "CHROMIUM_PATH doit désigner un binaire Chromium.");

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  let browser: Browser | null = null;
  try {
    browser = await browserType.launch({
      headless: true,
      ...(BROWSER_EXECUTABLE ? { executablePath: BROWSER_EXECUTABLE } : {}),
      args: BROWSER_ARGS,
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));

    const response = await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    assert.ok(response?.ok(), `le serveur preview répond ${response?.status() ?? "aucun statut"}`);
    await page.locator(".hoop-canvas").waitFor({ state: "visible" });
    assert.match(await page.title(), /ROSACE/);
    assert.equal(await page.locator(".crown-seg").count(), 489, "couronne chromatique absente du build");
    assert.match((await page.locator(".studio-stats p").textContent()) ?? "", /3\s?381 croix/);

    const externalScripts = await page.locator("script[src]").count();
    assert.equal(externalScripts, 0, "le build singlefile ne doit pas charger de script externe");
    assert.ok(!requests.some((url) => url.includes("/@vite/client")), "le client Vite de dev est servi par erreur");
    assert.ok(!requests.some((url) => /\/src\//.test(url)), "un module source non compilé est servi par erreur");

    await page.locator("#dock-broder").click();
    await page.locator(".broder-canvas").waitFor({ state: "visible" });
    assert.match((await page.locator(".broder-titre span").textContent()) ?? "", /0 \/ 3\s?381/);
    await page.getByRole("button", { name: "Fermer le mode broderie et enregistrer la progression" }).click();
    await page.locator(".broder").waitFor({ state: "detached" });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "apercu-production.png") });
    assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(" | ")}`);
    console.log(`Aperçu de production réussi · ${BASE_URL} · ${ARTIFACT_DIR}/apercu-production.png`);
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
