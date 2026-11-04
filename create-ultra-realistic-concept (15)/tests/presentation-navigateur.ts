/**
 * Parcours navigateur de la présentation : le trait du hero lie la rosace et le mot-symbole,
 * et la table de montage du PDF est une vraie démonstration — les quatre pages glissées
 * en place redonnent la grille exacte, prouvée par l'empreinte.
 *
 * Prérequis identiques à parcours-navigateur.ts (BASE_URL, CHROMIUM_PATH, serveur Vite lancé).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { DEFAULT_CONFIG, generateRosace } from "../src/lib/rosace";
import { fromRosace } from "../src/lib/work";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);
const BROWSER_ARGS = (process.env.BROWSER_ARGS ?? "--no-sandbox --disable-dev-shm-usage --disable-gpu").split(" ").filter(Boolean);
const ARTIFACTS = process.env.ARTIFACTS_DIR ?? path.join(os.tmpdir(), "rosace-browser-artifacts");

async function main() {
  assert.ok(CHROMIUM_PATH, "CHROMIUM_PATH est requis (binaire Chromium).");
  await mkdir(ARTIFACTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: BROWSER_ARGS });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const url = new URL(BASE_URL);
  url.searchParams.set("vue", "presentation");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.locator(".presentation").waitFor({ state: "visible" });

  /* ---------------- Le trait du hero : rosace et mot-symbole bougent ensemble ---------------- */
  const slider = page.getByRole("slider", { name: /Balayer entre le motif/ }).first();
  assert.equal(await slider.getAttribute("aria-valuenow"), "50", "le trait commence entre le S et le A");
  await slider.focus();
  await page.keyboard.press("Shift+ArrowRight");
  assert.equal(await slider.getAttribute("aria-valuenow"), "60");
  const clip = await page.locator(".entete-nom-grille").evaluate((node) => (node as HTMLElement).style.clipPath);
  assert.match(clip, /inset\(0(px)? 0(px)? 0(px)? 60%\)/, "le mot-symbole suit le trait");
  await page.keyboard.press("Home");
  assert.equal(await slider.getAttribute("aria-valuenow"), "0");
  await page.keyboard.press("End");
  assert.equal(await slider.getAttribute("aria-valuenow"), "100");

  /* ---------------- La table de montage : vraie, et prouvée par l'empreinte ---------------- */
  const expected = fromRosace(generateRosace(DEFAULT_CONFIG)).fingerprint;
  await page.locator(".puzzle").scrollIntoViewIfNeeded();
  const etat = page.locator(".puzzle-etat");
  await page.locator(".puzzle-bloc.est-visible").waitFor();
  assert.match(await etat.innerText(), /cases? vides?/, "mélangées, les pages laissent des trous");
  assert.match(await etat.innerText(), /recouverte/, "et une page en recouvre une autre");

  // D'un geste : la grille exacte, l'empreinte de la rosace d'origine.
  await page.getByRole("button", { name: /Recomposer d'un geste/ }).click();
  await page.waitForFunction(() => document.querySelector(".puzzle-etat")?.textContent?.includes("vérifiée"));
  assert.match(await etat.innerText(), new RegExp(`empreinte ${expected.slice(0, 8)} vérifiée`));
  await page.screenshot({ path: path.join(ARTIFACTS, "presentation-puzzle-juste.png") });

  // À la main : on mélange, puis on glisse chaque page à sa place ; l'aimantation finit le travail.
  await page.getByRole("button", { name: /Mélanger/ }).click();
  await page.waitForFunction(() => !document.querySelector(".puzzle-etat")?.textContent?.includes("vérifiée"));
  const board = await page.locator(".puzzle-plateau").boundingBox();
  assert.ok(board);
  const cell = board.width / 128;
  const homes: Record<string, [number, number]> = { "P.1": [0, 0], "P.2": [51, 0], "P.3": [0, 51], "P.4": [51, 51] };
  for (const [label, [hx, hy]] of Object.entries(homes)) {
    const tile = page.getByRole("button", { name: new RegExp(`^${label.replace(".", "\\.")} `) });
    const box = await tile.boundingBox();
    assert.ok(box);
    // On attrape la carte par le haut (une page mélangée peut en recouvrir une autre en bas),
    // et on vise à deux cases près : c'est l'aimantation qui doit poser la carte exactement.
    const grabX = box.width / 2;
    const grabY = box.height * 0.2;
    const targetX = board.x + (hx + 2) * cell + grabX;
    const targetY = board.y + (hy + 1) * cell + grabY;
    await page.mouse.move(box.x + grabX, box.y + grabY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 12 });
    await page.mouse.up();
  }
  await page.waitForFunction(() => document.querySelector(".puzzle-etat")?.textContent?.includes("vérifiée"));
  assert.match(await etat.innerText(), /3.381 croix/);

  // Au clavier : une flèche décale une page, la grille n'est plus exacte ; la flèche inverse la remet.
  const p2 = page.getByRole("button", { name: /^P\.2 / });
  await p2.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.waitForFunction(() => !document.querySelector(".puzzle-etat")?.textContent?.includes("vérifiée"));
  assert.match(await etat.innerText(), /cases? vides?/);
  await page.keyboard.press("Shift+ArrowLeft");
  await page.waitForFunction(() => document.querySelector(".puzzle-etat")?.textContent?.includes("vérifiée"));

  await browser.close();
  console.log(`Parcours de la présentation réussi · captures dans ${ARTIFACTS}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
