/**
 * Parcours navigateur « Broder » : session live entre deux onglets d'un même navigateur
 * (liste des brodeuses, curseur et nom visibles à l'écran, départ propre, messages hostiles ignorés)
 * et garde-fous de la grille (clic droit, raccourcis du navigateur, molette, confirmation « Zéro »).
 *
 * Prérequis identiques à parcours-navigateur.ts (BASE_URL, CHROMIUM_PATH, serveur Vite lancé).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, firefox, webkit, type Page } from "playwright-core";
import { LIVE_COLORS, sanitizeRoom } from "../src/lib/live";
import { chartGeometry } from "../src/lib/paint";
import { patternFingerprint, shortFingerprint } from "../src/lib/pattern-id";
import { DEFAULT_CONFIG, generateRosace } from "../src/lib/rosace";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const STUDIO_URL = `${BASE_URL}#atelier`;
const ARTIFACT_DIR = process.env.ARTIFACT_DIR ?? path.join(os.tmpdir(), "rosace-browser-artifacts");
const BROWSER = process.env.BROWSER ?? "chromium";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);
const BROWSER_EXECUTABLE = process.env.BROWSER_EXECUTABLE ?? (BROWSER === "chromium" ? CHROMIUM_PATH : undefined);
const BROWSER_ARGS = (process.env.BROWSER_ARGS ?? "--no-sandbox --disable-dev-shm-usage --disable-gpu").split(" ").filter(Boolean);
const browserType = BROWSER === "firefox" ? firefox : BROWSER === "webkit" ? webkit : chromium;

const pattern = generateRosace(DEFAULT_CONFIG);
const fingerprint = patternFingerprint(pattern);
const errors: string[] = [];

function track(page: Page, label: string) {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${label}: console ${message.text()}`); });
}

async function openBroder(page: Page, label: string) {
  track(page, label);
  await page.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
  await page.locator(".hoop-canvas").waitFor({ state: "visible" });
  await page.locator("#dock-broder").click();
  await page.locator(".broder-canvas").waitFor({ state: "visible" });
}

const live = (page: Page) => page.locator(".broder-live");
const status = (page: Page) => live(page).locator("p[role='status']");
const roster = (page: Page) => live(page).locator(".broder-live-list li");
const zoomLabel = async (page: Page) => (await page.locator(".broder-jauge").textContent())?.trim() ?? "";

async function join(page: Page, name: string) {
  await live(page).locator("label", { hasText: "Nom" }).locator("input").fill(name);
  await live(page).getByRole("button", { name: "Rejoindre" }).click();
}

/** Position écran du centre d'une case, tant que la grille est à son zoom d'ajustement. */
async function stitchPoint(page: Page, stitch: { x: number; y: number }) {
  const rect = await page.locator(".broder-canvas").evaluate((canvas) => {
    const box = canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
  const chart = chartGeometry(1800, pattern.size, "chart");
  const fit = Math.min(rect.width, rect.height) * 0.985 / 1800;
  return {
    x: rect.left + rect.width / 2 + fit * (-900 + chart.origin + stitch.x * chart.cell),
    y: rect.top + rect.height / 2 + fit * (-900 + chart.origin + stitch.y * chart.cell),
  };
}

/** Nombre de pixels exactement de cette couleur sur la grille : l'étiquette et le cadre d'un curseur distant la portent. */
function countPixels(page: Page, hex: string) {
  return page.locator(".broder-canvas").evaluate((canvas, color) => {
    const target = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
    const { data } = (canvas as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2]) count += 1;
    return count;
  }, hex);
}

function waitPixels(page: Page, hex: string, predicate: "present" | "absent") {
  return page.waitForFunction(({ color, mode }) => {
    const canvas = document.querySelector<HTMLCanvasElement>(".broder-canvas");
    if (!canvas) return false;
    const target = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2]) count += 1;
    return mode === "present" ? count >= 200 : count < 40;
  }, { color: hex, mode: predicate }, { timeout: 8000 });
}

async function main() {
  if (BROWSER === "chromium") assert.ok(BROWSER_EXECUTABLE, "CHROMIUM_PATH doit désigner un binaire Chromium.");
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await browserType.launch({ headless: true, ...(BROWSER_EXECUTABLE ? { executablePath: BROWSER_EXECUTABLE } : {}), args: BROWSER_ARGS });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const alice = await context.newPage();
    const bruno = await context.newPage();
    await openBroder(alice, "Alice");
    await openBroder(bruno, "Bruno");

    /* ---------------- Départ : même code par défaut, personne d'autre, honnêteté sur la portée ---------------- */
    const defaultRoom = await live(alice).locator("label", { hasText: "Code" }).locator("input").inputValue();
    assert.equal(defaultRoom, await live(bruno).locator("label", { hasText: "Code" }).locator("input").inputValue(), "les deux onglets proposent le même code");
    assert.match((await status(alice).textContent()) ?? "", /Session inactive/);
    assert.match((await live(alice).locator(".broder-live-note").textContent()) ?? "", /onglets d'un même navigateur/);

    await join(alice, "Alice");
    await status(alice).filter({ hasText: "en attente d'une autre brodeuse" }).waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await live(alice).locator("label", { hasText: "Code" }).locator("input").isDisabled(), true, "le code est figé pendant la session");
    await join(bruno, "Bruno");

    /* ---------------- Chacune voit l'autre, sans attendre le prochain battement ---------------- */
    await roster(alice).filter({ hasText: "Bruno" }).waitFor({ state: "visible", timeout: 2000 });
    await roster(bruno).filter({ hasText: "Alice" }).waitFor({ state: "visible", timeout: 2000 });
    for (const page of [alice, bruno]) {
      assert.match((await status(page).textContent()) ?? "", /1 autre brodeuse connectée/);
      assert.equal(await roster(page).count(), 1, "une seule autre brodeuse dans la liste");
    }

    /* ---------------- Le curseur de l'une apparaît, nommé, sur l'écran de l'autre ---------------- */
    const peerColor = LIVE_COLORS[0];
    assert.ok(await countPixels(bruno, peerColor) < 40, "aucun curseur distant tant qu'Alice ne survole rien");
    const cell = pattern.stitches[Math.floor(pattern.stitches.length / 2)];
    const point = await stitchPoint(alice, cell);
    await alice.mouse.move(point.x, point.y);
    await waitPixels(bruno, peerColor, "present");
    await bruno.locator(".broder-scene").screenshot({ path: path.join(ARTIFACT_DIR, "broder-live-curseur.png") });
    await alice.mouse.move(4, 4);
    await waitPixels(bruno, peerColor, "absent");

    /* ---------------- Une croix d'Alice arrive chez Bruno sans déplacer sa vue ni l'inonder d'annonces ---------------- */
    await bruno.locator(".broder-canvas").focus();
    await bruno.keyboard.press("+");
    await bruno.keyboard.press("+");
    const zoomed = await zoomLabel(bruno);
    assert.notEqual(zoomed, "100 %");
    await alice.mouse.click(point.x, point.y);
    await bruno.waitForFunction(() => /^1 \//.test(document.querySelector(".broder-titre span")?.textContent ?? ""), undefined, { timeout: 8000 });
    assert.equal(await zoomLabel(bruno), zoomed, "la vue de Bruno ne saute pas quand Alice coche une croix");
    assert.equal(await bruno.locator(".toast", { hasText: "synchronisée" }).count(), 0, "pas d'annonce de synchronisation pendant une session live");

    /* ---------------- Départ propre : « Quitter », puis fermeture de la broderie ---------------- */
    await live(alice).getByRole("button", { name: "Quitter" }).click();
    await roster(bruno).first().waitFor({ state: "detached", timeout: 3000 });
    await status(bruno).filter({ hasText: "en attente d'une autre brodeuse" }).waitFor({ state: "visible" });
    await join(alice, "Alice");
    await roster(bruno).filter({ hasText: "Alice" }).waitFor({ state: "visible", timeout: 2000 });
    await alice.getByRole("button", { name: "Fermer le mode broderie et enregistrer la progression" }).click();
    await roster(bruno).first().waitFor({ state: "detached", timeout: 3000 });

    /* ---------------- Messages hostiles d'un troisième onglet : ignorés, jamais exécutés, jamais bloquants ---------------- */
    await alice.locator("#dock-broder").click();
    await alice.locator(".broder-canvas").waitFor({ state: "visible" });
    await join(alice, "Alice");
    await roster(bruno).filter({ hasText: "Alice" }).waitFor({ state: "visible", timeout: 2000 });
    const mallory = await context.newPage();
    track(mallory, "intruse");
    await mallory.goto(STUDIO_URL, { waitUntil: "domcontentloaded" });
    const room = sanitizeRoom(defaultRoom || shortFingerprint(fingerprint));
    const hostileName = "<svg onload=__pwned=1>";
    await mallory.evaluate(({ channelName, name }) => {
      const channel = new BroadcastChannel(channelName);
      const junk: unknown[] = [
        null, "texte", 42, [], { kind: "state" }, { kind: "state", sender: "constructor", name: "pirate", cursor: null, completedRuns: "" },
        { kind: "state", sender: "toString", name: "pirate", cursor: null, completedRuns: "" },
        { kind: "state", sender: "bad sender!", name: "pirate", cursor: null, completedRuns: "" },
        { kind: "state", sender: "11111111-2222-4333-8444-555555555555", name: 12, cursor: { x: 1e9, y: -1 }, completedRuns: "1e21" },
        { kind: "state", sender: "66666666-2222-4333-8444-555555555555", name, color: "red;background:url(//evil)", cursor: { x: 2.5, y: "a" }, completedRuns: "0-99999999999,NaN,-3" },
      ];
      for (const message of junk) channel.postMessage(message);
      channel.close();
    }, { channelName: `aime-rosace-live-v1:${fingerprint}:${room}`, name: hostileName });
    await roster(bruno).filter({ hasText: hostileName }).waitFor({ state: "visible", timeout: 3000 });
    assert.equal(await roster(bruno).count(), 3, "Alice et les deux expéditeurs valides ; « constructor », « toString » et l'identifiant invalide sont écartés");
    assert.equal(await bruno.locator(".broder-live-list svg").count(), 0, "un nom n'est jamais interprété comme du HTML");
    assert.equal(await bruno.evaluate(() => (window as unknown as { __pwned?: number }).__pwned), undefined);
    assert.equal(await bruno.locator(".broder-canvas").isVisible(), true);
    await mallory.close();
    await context.close();

    /* ---------------- Garde-fous de la grille ---------------- */
    const solo = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await solo.newPage();
    await openBroder(page, "grille");
    const target = await stitchPoint(page, pattern.stitches[0]);
    const done = async () => (await page.locator(".broder-titre span").textContent())?.trim() ?? "";
    assert.match(await done(), /^0 \//);

    await page.mouse.click(target.x, target.y, { button: "right" });
    await page.mouse.click(target.x, target.y, { button: "middle" });
    assert.match(await done(), /^0 \//, "un clic droit ou central ne coche jamais une croix");
    await page.mouse.click(target.x, target.y);
    assert.match(await done(), /^1 \//, "le clic gauche coche toujours");
    await page.mouse.click(target.x, target.y);
    assert.match(await done(), /^0 \//);

    await page.evaluate(() => {
      const seen: Array<[string, boolean, boolean]> = [];
      (window as unknown as { __keys: typeof seen }).__keys = seen;
      window.addEventListener("keydown", (event) => seen.push([event.key, event.ctrlKey, event.defaultPrevented]));
    });
    await page.locator(".broder-canvas").focus();
    await page.keyboard.press("+");
    const afterPlus = await zoomLabel(page);
    assert.notEqual(afterPlus, "100 %");
    await page.keyboard.press("Control+0");
    await page.keyboard.press("Control+-");
    assert.equal(await zoomLabel(page), afterPlus, "Ctrl + 0 et Ctrl + - restent au navigateur");
    const keys = await page.evaluate(() => (window as unknown as { __keys: Array<[string, boolean, boolean]> }).__keys);
    assert.deepEqual(keys.filter(([key, ctrl]) => ctrl && key !== "Control").map(([key, , prevented]) => [key, prevented]), [["0", false], ["-", false]], "ces raccourcis ne sont pas interceptés");
    await page.keyboard.press("0");
    assert.equal(await zoomLabel(page), "100 %", "« 0 » seul ajuste la grille");

    const wheel = await page.locator(".broder-canvas").evaluate((canvas) => {
      const box = canvas.getBoundingClientRect();
      const event = new WheelEvent("wheel", { deltaY: -120, cancelable: true, bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(wheel, true, "la molette zoome la grille sans faire défiler ni zoomer la page");
    assert.notEqual(await zoomLabel(page), "100 %");
    await page.getByRole("button", { name: "Ajuster la grille à l'écran" }).click();

    const tabIndexes = await page.locator("input[type=file].sr-only").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).tabIndex));
    assert.ok(tabIndexes.length >= 2 && tabIndexes.every((index) => index === -1), "les champs fichier masqués ne sont pas des arrêts de tabulation");

    const zero = page.getByRole("button", { name: "Zéro", exact: true });
    const confirm = page.getByRole("button", { name: "Confirmer le zéro" });
    await page.mouse.click(target.x, target.y);
    await zero.click();
    await confirm.waitFor({ state: "visible" });
    assert.equal(await confirm.evaluate((button) => document.activeElement === button), true, "la confirmation reçoit le focus");
    await page.keyboard.press("Escape");
    await confirm.waitFor({ state: "detached" });
    assert.equal(await page.locator(".broder").count(), 1, "Échap referme la confirmation sans quitter la broderie");
    assert.equal(await zero.evaluate((button) => document.activeElement === button), true, "le focus revient sur « Zéro »");
    assert.match(await done(), /^1 \//, "aucune croix effacée");
    await zero.click();
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await confirm.waitFor({ state: "detached" });
    assert.match(await done(), /^1 \//, "« Annuler » n'efface rien");
    await zero.click();
    await confirm.click();
    assert.match(await done(), /^0 \//, "confirmer remet bien à zéro");
    await page.keyboard.press("Escape");
    await page.locator(".broder").waitFor({ state: "detached" });
    await solo.close();

    assert.deepEqual(errors, [], `erreurs navigateur : ${errors.join(" | ")}`);
    console.log(`\nParcours Broder (session live, grille) réussis · ${ARTIFACT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
