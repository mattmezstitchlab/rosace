/**
 * Parcours navigateur de l'import PDF — le critère de réussite de la mission :
 * ouvrir ROSACE, importer un PDF multipage, voir les pages analysées, réassembler les grilles,
 * corriger les raccords, valider, broder directement, marquer des croix, fermer, rouvrir,
 * retrouver exactement la grille, la palette et la progression. Et la rosace n'a pas bougé.
 *
 * Le PDF est produit par Chromium lui-même (page.pdf) à partir d'une page HTML : un vrai PDF,
 * avec un vrai texte et de vraies lignes de grille, lu par pdf.js dans l'application.
 * Prérequis identiques à parcours-navigateur.ts (BASE_URL, CHROMIUM_PATH).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { deflateSync } from "node:zlib";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { worksheetHtml } from "../src/lib/exporters";
import { buildProject, emptyProgress, serializeRuns, stitchIndex } from "../src/lib/progress";
import { DEFAULT_CONFIG, generateRosace } from "../src/lib/rosace";
import { fromRosace } from "../src/lib/work";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5173";

/** Un PNG synthétique sans dépendance : quatre aplats et un confetti, encodé à la main (zlib de Node). */
function syntheticPng(w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x += 1) {
      const left = x < w / 2, top = y < h / 2;
      let color = left && top ? [120, 20, 50] : !left && top ? [200, 90, 150] : left && !top ? [30, 60, 30] : [250, 220, 120];
      if (x >= 10 && x < 13 && y >= 10 && y < 13) color = [40, 180, 60];
      raw.set(color, y * (w * 3 + 1) + 1 + x * 3);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const ARTIFACT_DIR = process.env.ARTIFACT_DIR ?? path.join(os.tmpdir(), "rosace-browser-artifacts");
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);
const BROWSER_ARGS = (process.env.BROWSER_ARGS ?? "--no-sandbox --disable-dev-shm-usage --disable-gpu").split(" ").filter(Boolean);

/** Patron synthétique : 32 colonnes × 16 rangées sur deux pages de grille, légende sur la troisième. */
const COLS_PER_PAGE = 16;
const ROWS = 16;
const PAGES = 2;
const CELL = 24;
const symbolAt = (col: number, row: number) => ((col * 7 + row * 3) % 5 < 2 ? "#" : "*");
const EXPECTED_CROSSES = PAGES * COLS_PER_PAGE * ROWS;

function chartPageHtml(pageIndex: number) {
  const left = 80;
  const top = 120;
  const colStart = pageIndex * COLS_PER_PAGE;
  const cells: string[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS_PER_PAGE; c += 1) {
      cells.push(`<span class="g" style="left:${left + c * CELL - CELL / 2}px;top:${top + r * CELL - CELL / 2}px">${symbolAt(colStart + c, r)}</span>`);
    }
  }
  const axisH: string[] = [];
  for (let c = 0; c <= COLS_PER_PAGE; c += 1) {
    const value = colStart + c;
    if (value % 5 === 0) axisH.push(`<span class="n" style="left:${left + c * CELL - CELL / 2 - 8}px;top:${top - 30}px">${value}</span>`);
  }
  const axisV: string[] = [];
  for (let r = 0; r <= ROWS; r += 5) axisV.push(`<span class="n" style="left:${left - 36}px;top:${top + r * CELL - CELL / 2 - 7}px">${r}</span>`);
  const lines: string[] = [];
  for (let c = 0; c <= COLS_PER_PAGE; c += 1) lines.push(`<i class="v${c % 10 === 0 ? " major" : ""}" style="left:${left + c * CELL - CELL / 2}px;top:${top - CELL / 2}px;height:${ROWS * CELL}px"></i>`);
  for (let r = 0; r <= ROWS; r += 1) lines.push(`<i class="h${r % 10 === 0 ? " major" : ""}" style="left:${left - CELL / 2}px;top:${top + r * CELL - CELL / 2}px;width:${COLS_PER_PAGE * CELL}px"></i>`);
  return `<section class="page"><h1>Patron de test · page ${pageIndex + 1} / ${PAGES + 1}</h1>${lines.join("")}${axisH.join("")}${axisV.join("")}${cells.join("")}</section>`;
}

function legendPageHtml() {
  return `<section class="page"><h1>Légende · page ${PAGES + 1} / ${PAGES + 1}</h1>
    <p class="dims">${PAGES * COLS_PER_PAGE} x ${ROWS}</p>
    <p class="row"><span class="s">*</span><span class="code">DMC 310 Black</span></p>
    <p class="row"><span class="s">#</span><span class="code">DMC 321 Red</span></p>
  </section>`;
}

function pdfHtml() {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .page { position: relative; width: 595px; height: 842px; page-break-after: always; overflow: hidden; background: #fff; }
    h1 { position: absolute; left: 80px; top: 40px; margin: 0; font-size: 18px; font-weight: 700; }
    .g { position: absolute; width: ${CELL}px; height: ${CELL}px; line-height: ${CELL}px; text-align: center; font-size: 14px; font-weight: 700; }
    .n { position: absolute; width: 16px; text-align: center; font-size: 11px; }
    i.v { position: absolute; width: 1.2px; background: #333; }
    i.h { position: absolute; height: 1.2px; background: #333; }
    i.major { background: #000; width: 2px; height: auto; }
    i.h.major { height: 2px; width: ${COLS_PER_PAGE * CELL}px; }
    .dims { position: absolute; left: 80px; top: 90px; margin: 0; font-size: 14px; }
    .row { position: absolute; left: 80px; margin: 0; font-size: 16px; }
    .row:nth-of-type(2) { top: 140px; } .row:nth-of-type(3) { top: 176px; }
    .s { display: inline-block; width: 24px; }
    .code { display: inline-block; margin-left: 18px; }
  </style></head><body>${chartPageHtml(0)}${chartPageHtml(1)}${legendPageHtml()}</body></html>`;
}

async function expectText(page: Page, selector: string, pattern: RegExp, timeout = 20000) {
  await page.locator(selector).filter({ hasText: pattern }).first().waitFor({ state: "visible", timeout });
}

/* ---------- Robustesse de l'import : navigateur ancien, worker muet, annulation, gros PDF. Un contexte isolé par scénario. ---------- */

/** Un navigateur d'il y a deux ans : les API que le build moderne de pdf.js appelle sans les fournir n'existent pas (thread principal comme worker). */
const OLD_BROWSER_SCRIPT = `for (const [target, names] of [
  [Map.prototype, ["getOrInsert", "getOrInsertComputed"]],
  [WeakMap.prototype, ["getOrInsert", "getOrInsertComputed"]],
  [Promise, ["try"]],
  [URL, ["parse"]],
  [Uint8Array.prototype, ["toHex", "toBase64", "setFromBase64", "setFromHex"]],
  [Uint8Array, ["fromBase64", "fromHex"]],
  [Math, ["sumPrecise"]],
]) for (const name of names) delete target[name];`;
/** Un worker qui accepte la poignée de main puis ne répond jamais à l'ouverture du document : l'ancien spinner sans fin. */
const MUTE_WORKER_SCRIPT = `self.addEventListener("message", (event) => { if (event.data && event.data.action === "GetDocRequest") event.stopImmediatePropagation(); });`;
/** Le script du worker de pdf.js (et non le module `?url` que le serveur de dev sert pour en donner l'adresse). */
const isPdfWorkerScript = (url: URL) => /\/pdf\.worker\.min[^/]*\.mjs$/.test(url.pathname) && !url.search;
const ALERT = ".importer-alerte[role=\"alert\"]";

async function isolatedPage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "fr-FR" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  return { context, page, errors };
}

/** Les routes sont retirées avant la fermeture : une requête de worker encore en vol ferait échouer le close(). */
async function closeIsolated(context: BrowserContext) {
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await context.close();
}

async function rewritePdfWorker(context: BrowserContext, prelude: string) {
  let rewrites = 0;
  await context.route(isPdfWorkerScript, async (route) => {
    const response = await route.fetch();
    rewrites += 1;
    await route.fulfill({ response, body: `${prelude}\n${await response.text()}` });
  });
  return () => rewrites;
}

/** pdf.js garde son worker vivant tant qu'on ne le détruit pas : après une erreur ou une annulation, il doit avoir disparu. */
async function expectWorkers(page: Page, expected: number, message: string, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (page.workers().length !== expected && Date.now() < deadline) await page.waitForTimeout(100);
  assert.equal(page.workers().length, expected, message);
}

async function openImporter(page: Page) {
  await page.goto(`${BASE_URL}#atelier-importer`);
  await page.locator(".importer-depot").waitFor({ state: "visible" });
}

async function importRobustness(browser: Browser, pdfPath: string) {
  const choosePdf = (page: Page, file = pdfPath) => page.locator("input[accept*=\"pdf\"]").setInputFiles(file);

  // 1. Navigateur ancien : le build legacy de pdf.js embarque ses polyfills, l'import marche sans les API récentes.
  {
    const { context, page, errors } = await isolatedPage(browser);
    await context.addInitScript(OLD_BROWSER_SCRIPT);
    const workerRewrites = await rewritePdfWorker(context, OLD_BROWSER_SCRIPT);
    await openImporter(page);
    const missing = await page.evaluate(() => {
      const modern = window as unknown as { Promise: { try?: unknown }; URL: { parse?: unknown }; Map: { prototype: { getOrInsertComputed?: unknown } } };
      return [typeof modern.Promise.try, typeof modern.URL.parse, typeof modern.Map.prototype.getOrInsertComputed];
    });
    assert.deepEqual(missing, ["undefined", "undefined", "undefined"], "le navigateur simulé ne connaît pas les API récentes");
    await choosePdf(page);
    await expectText(page, ".importer-h2", /2 pages de grille/, 60000);
    assert.ok(workerRewrites() >= 1, "le worker de pdf.js a bien tourné sans les API récentes");
    assert.equal(await page.locator(ALERT).count(), 0, "aucune erreur affichée");
    assert.deepEqual(errors, [], `erreurs JavaScript (navigateur ancien) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }

  // 2. Sans Promise.withResolvers, aucun build ne marche : message français net, pas de spinner, pas de worker.
  {
    const { context, page, errors } = await isolatedPage(browser);
    await context.addInitScript("delete Promise.withResolvers;");
    await openImporter(page);
    await choosePdf(page);
    await expectText(page, ALERT, /Votre navigateur est trop ancien pour lire un PDF\. Essayez « Photo » ou mettez-le à jour\./, 15000);
    assert.equal(await page.locator(".importer-busy").count(), 0, "pas d'attente sans fin");
    await expectWorkers(page, 0, "aucun worker créé pour un navigateur qui ne peut pas lire le PDF");
    assert.deepEqual(errors, [], `erreurs JavaScript (sans withResolvers) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }

  // 3. Worker muet : le garde-fou de 30 s (horloge simulée) remplace le spinner par un message, et le worker est détruit.
  {
    const { context, page, errors } = await isolatedPage(browser);
    await rewritePdfWorker(context, MUTE_WORKER_SCRIPT);
    await page.clock.install();
    await openImporter(page);
    await choosePdf(page);
    await page.locator(".importer-busy").waitFor({ state: "visible" });
    // Le garde-fou n'est armé qu'après le chargement de pdf.js : on avance l'horloge jusqu'à ce qu'il tombe.
    for (let i = 0; i < 8 && !(await page.locator(ALERT).count()); i += 1) {
      await page.clock.fastForward(31_000);
      await page.waitForTimeout(500);
    }
    await expectText(page, ALERT, /Le PDF met trop de temps à s'ouvrir \(30 s sans réponse\)/, 5000);
    assert.equal(await page.locator(".importer-busy").count(), 0, "plus de spinner une fois le délai écoulé");
    await page.clock.fastForward(5000);
    await expectWorkers(page, 0, "le worker muet est détruit d'office");
    assert.deepEqual(errors, [], `erreurs JavaScript (worker muet) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }

  // 4. Fichier qui n'est pas un PDF : message français (pas « Invalid PDF structure. »), et le worker n'est pas laissé en vie.
  {
    const { context, page, errors } = await isolatedPage(browser);
    const fakePath = path.join(ARTIFACT_DIR, "faux-patron.pdf");
    await writeFile(fakePath, "Ceci n'est pas un PDF.\n".repeat(30));
    await openImporter(page);
    await choosePdf(page, fakePath);
    await expectText(page, ALERT, /Ce fichier n'est pas un PDF valide, ou il est abîmé/);
    assert.equal(await page.locator(".importer-busy").count(), 0);
    await expectWorkers(page, 0, "le worker est libéré après une erreur d'ouverture");
    assert.deepEqual(errors, [], `erreurs JavaScript (faux PDF) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }

  // 5. Pendant la lecture (worker muet, donc interminable) : fermer, Échap et Annuler fonctionnent, le worker est détruit.
  {
    const { context, page, errors } = await isolatedPage(browser);
    await rewritePdfWorker(context, MUTE_WORKER_SCRIPT);
    await openImporter(page);
    await choosePdf(page);
    await page.locator(".importer-busy").waitFor({ state: "visible" });
    const axe = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(axe.violations.map((violation) => `${violation.id}×${violation.nodes.length}`), [], "lecture en cours, avec « Annuler » : aucune violation axe");
    assert.equal(await page.getByRole("button", { name: "Fermer l'import" }).isEnabled(), true, "fermer reste actif pendant la lecture");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await page.locator(".importer-depot").waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await page.locator(".importer-busy").count(), 0, "Annuler ramène au dépôt, sans attente");
    await expectWorkers(page, 0, "Annuler détruit le worker de la lecture abandonnée");

    await choosePdf(page);
    await page.locator(".importer-busy").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.locator(".importer").waitFor({ state: "detached", timeout: 5000 });
    await expectWorkers(page, 0, "Échap détruit le worker de la lecture abandonnée");

    await openImporter(page);
    await choosePdf(page);
    await page.locator(".importer-busy").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Fermer l'import" }).click();
    await page.locator(".importer").waitFor({ state: "detached", timeout: 5000 });
    await expectWorkers(page, 0, "le bouton fermer détruit le worker de la lecture abandonnée");
    assert.deepEqual(errors, [], `erreurs JavaScript (annulation) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }

  // 6. « Caler » en pleine lecture des cartes (horloge en pause, donc la lecture reste en cours) ne fige plus l'importeur.
  {
    const { context, page, errors } = await isolatedPage(browser);
    await page.clock.install();
    await openImporter(page);
    await choosePdf(page);
    await expectText(page, ".importer-h2", /2 pages de grille/, 60000);
    await page.locator(".importer-actions .bouton", { hasText: /Caler les grilles/ }).click();
    await page.locator(".importer-feuille").waitFor({ state: "visible" });
    await page.locator(".importer-actions .bouton.noir", { hasText: /Assembler/ }).click();
    await page.locator(".importer-resume").waitFor({ state: "visible", timeout: 60000 });
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    await page.getByRole("button", { name: "Automatique" }).click();
    await expectText(page, ".importer-busy", /Lecture de la carte 1\/2/, 5000);
    assert.equal(await page.getByRole("button", { name: "Annuler", exact: true }).count(), 0, "Annuler ne concerne que la lecture du PDF");
    await page.locator(".importer-cote .importer-actions").getByRole("button", { name: "Caler", exact: true }).click();
    await page.locator(".importer-feuille").waitFor({ state: "visible" });
    assert.equal(await page.locator(".importer-busy").count(), 0, "revenir à « Caler » abandonne la lecture et retire l'attente");
    assert.ok(await page.locator(".importer-etapes button:not([disabled])").count() >= 2, "les étapes redeviennent utilisables");
    await page.keyboard.press("Escape");
    await page.locator(".importer").waitFor({ state: "detached", timeout: 5000 });
    assert.deepEqual(errors, [], `erreurs JavaScript (Caler en pleine lecture) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }

  // 7. Un PDF de 105 pages : les 100 premières seulement sont lues, et l'avis le dit (Analyser, puis Vérifier).
  {
    const manyPath = path.join(ARTIFACT_DIR, "patron-105-pages.pdf");
    const maker = await browser.newPage();
    await maker.setContent(`<!doctype html><style>@page{size:60mm 60mm;margin:0}body{margin:0}section{width:60mm;height:60mm;page-break-after:always;font:12px sans-serif}</style>${Array.from({ length: 105 }, (_, i) => `<section>Page ${i + 1}</section>`).join("")}`, { waitUntil: "load" });
    await maker.pdf({ path: manyPath, preferCSSPageSize: true });
    await maker.close();
    const { context, page, errors } = await isolatedPage(browser);
    await openImporter(page);
    await choosePdf(page, manyPath);
    await expectText(page, ".importer-alerte[role=\"status\"]", /^Ce PDF compte 105 pages : seules les 100 premières sont lues\.$/, 120000);
    assert.equal(await page.locator(".importer-page").count(), 100, "100 pages analysées sur 105");
    assert.deepEqual(errors, [], `erreurs JavaScript (105 pages) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }

  // 8. Champs numériques du calage : on peut vider le champ et retaper ; la valeur n'est bornée (5–400) qu'à la sortie du champ, à Entrée ou à l'étape suivante.
  {
    const { context, page, errors } = await isolatedPage(browser);
    await openImporter(page);
    await choosePdf(page);
    await expectText(page, ".importer-h2", /2 pages de grille/, 60000);
    const calage = () => page.locator(".importer-actions .bouton", { hasText: /Caler les grilles/ }).click();
    await calage();
    await page.locator(".importer-feuille").waitFor({ state: "visible" });
    const repere = page.locator(".importer-bloc span").first();
    const cols = page.getByRole("spinbutton", { name: "Colonnes du bloc 1" });
    const rows = page.getByRole("spinbutton", { name: "Rangées du bloc 1" });
    await expectText(page, ".importer-bloc span", /16 × 16/);
    await cols.fill("");
    assert.equal(await cols.inputValue(), "", "le champ peut être vidé pour retaper (il ne saute plus au minimum)");
    await cols.pressSequentially("20");
    assert.equal(await cols.inputValue(), "20");
    assert.match(await repere.innerText(), /16 × 16/, "rien n'est appliqué tant qu'on tape");
    await cols.press("Enter");
    await expectText(page, ".importer-bloc span", /20 × 16/);
    await cols.fill("9999");
    await cols.press("Tab");
    await expectText(page, ".importer-bloc span", /400 × 16/);
    assert.equal(await cols.inputValue(), "400", "borné à 400 en quittant le champ");
    await cols.fill("");
    await cols.press("Tab");
    assert.equal(await cols.inputValue(), "400", "un champ laissé vide garde sa valeur");
    await rows.fill("2");
    await rows.press("Tab");
    await expectText(page, ".importer-bloc span", /400 × 5/);
    await cols.fill("16");
    await cols.press("Tab");
    await rows.fill("16");
    await rows.press("Tab");
    await expectText(page, ".importer-bloc span", /16 × 16/);
    // Sans quitter le champ (clic simulé : le focus ne bouge pas), la saisie est appliquée quand le champ disparaît.
    await cols.fill("17");
    await page.getByRole("button", { name: "Retour", exact: true }).dispatchEvent("click");
    await page.locator(".importer-depot, .importer-actions .bouton.noir").first().waitFor({ state: "visible" });
    await calage();
    await expectText(page, ".importer-bloc span", /17 × 16/);
    assert.deepEqual(errors, [], `erreurs JavaScript (champs du calage) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }

  // 9. Signature de la rosace (panneau Ajuster) : même règle, et un champ vidé garde la signature en cours.
  {
    const { context, page, errors } = await isolatedPage(browser);
    await page.goto(`${BASE_URL}#atelier-reglages`);
    const signature = page.getByRole("spinbutton", { name: "Signature, de 1 à 9999" });
    await signature.waitFor({ state: "visible" });
    const initial = await signature.inputValue();
    await signature.fill("");
    assert.equal(await signature.inputValue(), "", "la signature peut être vidée pour en taper une autre");
    await signature.press("Tab");
    assert.equal(await signature.inputValue(), initial, "un champ laissé vide garde la signature en cours");
    await signature.fill("");
    await signature.pressSequentially("77");
    assert.equal(await signature.inputValue(), "77");
    await signature.press("Enter");
    assert.equal(await signature.inputValue(), "77", "Entrée applique la signature");
    await signature.fill("123456");
    await signature.press("Tab");
    assert.equal(await signature.inputValue(), "9999", "bornée à 9999 en quittant le champ");
    await signature.fill("0");
    await signature.press("Tab");
    assert.equal(await signature.inputValue(), "1", "bornée à 1 en quittant le champ");
    assert.deepEqual(errors, [], `erreurs JavaScript (signature) : ${errors.join(" | ")}`);
    await closeIsolated(context);
  }
}

async function main() {
  assert.ok(CHROMIUM_PATH, "CHROMIUM_PATH est requis (binaire Chromium).");
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: BROWSER_ARGS });
  const errors: string[] = [];
  try {
    /* ---------- 1. Un vrai PDF, produit par Chromium ---------- */
    const pdfPath = path.join(ARTIFACT_DIR, "patron-test-multipage.pdf");
    const maker = await browser.newPage();
    await maker.setContent(pdfHtml(), { waitUntil: "load" });
    await maker.pdf({ path: pdfPath, format: "A4", printBackground: true, preferCSSPageSize: true });
    await maker.close();

    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "fr-FR" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

    /* ---------- 2. La rosace de départ, et un import annulé qui ne la touche pas ---------- */
    await page.goto(`${BASE_URL}#atelier`);
    await page.locator(".studio-dock").waitFor({ state: "visible" });
    const statsBefore = (await page.locator(".studio-stats p").textContent()) ?? "";
    assert.match(statsBefore, /3\s?381 croix/);
    await page.locator(".studio-dock button", { hasText: /^Importer/ }).click();
    await page.locator(".importer-depot").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Fermer l'import" }).click();
    await page.locator(".importer").waitFor({ state: "detached" });
    assert.equal((await page.locator(".studio-stats p").textContent()) ?? "", statsBefore, "annuler l'import ne change rien à l'ouvrage actif");

    /* ---------- 3. Importer : Analyser ---------- */
    await page.goto(`${BASE_URL}#atelier-importer`);
    await page.locator(".importer-depot").waitFor({ state: "visible" });
    await page.locator("input[accept*=\"pdf\"]").setInputFiles(pdfPath);
    await expectText(page, ".importer-h2", /2 pages de grille/, 60000);
    await expectText(page, ".importer-texte", /Lecture vectorielle par graduations/);
    assert.equal(await page.locator(".importer-page").count(), 3, "trois pages analysées");
    // Import en un geste : la lecture exacte propose d'aller droit à Vérifier ; le chemin long reste disponible.
    await page.locator(".importer-actions .bouton.noir", { hasText: /Lecture exacte : vérifier et broder/ }).waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "import-1-analyser.png") });
    await page.locator(".importer-actions .bouton", { hasText: /Caler les grilles/ }).click();

    /* ---------- 4. Caler ---------- */
    await page.locator(".importer-feuille").waitFor({ state: "visible" });
    assert.equal(await page.locator(".importer-bloc").count(), 1, "une grille détectée sur la page 1");
    await expectText(page, ".importer-bloc span", /16 × 16/);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "import-2-caler.png") });
    await page.locator(".importer-actions .bouton.noir", { hasText: /Assembler/ }).click();

    /* ---------- 5. Assembler : lecture exacte, puis un déplacement au clavier ---------- */
    await expectText(page, ".importer-resume", /Grille 32 × 16 · 2 fils DMC/, 60000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "import-3-assembler-apercu.png") });
    await page.getByRole("button", { name: "Table de montage" }).click();
    const cards = page.locator(".importer-carte");
    assert.equal(await cards.count(), 2, "deux cartes sur la table");
    // Une carte bouge au clavier : lecture automatique, raccord signalé puis réaligné.
    await cards.nth(1).focus();
    await page.keyboard.press("ArrowLeft");
    await expectText(page, ".importer-segments button[aria-pressed=true]", /Automatique/);
    // Après déplacement, la reconnaissance raster peut perdre quelques cases de bord.
    // L'invariant métier : aucun code DMC n'est inventé pour ces symboles non résolus.
    const autoSummary = page.locator(".importer-section[aria-label='Fils DMC reconnus'] .panneau-aide");
    await autoSummary.filter({ hasText: /^0 croix liées à la légende/ }).waitFor({ state: "visible", timeout: 30000 });
    const autoText = (await autoSummary.innerText()).replace(/\s+/g, " ");
    assert.match(autoText, /^0 croix liées à la légende/);
    assert.match(autoText, / · 0 estimées par couleur/);
    const unmatched = autoText.match(/(\d+) symbole\(s\) sans code, laissés vides/);
    assert.ok(unmatched, `La lecture automatique doit annoncer tous les symboles non reconnus : ${autoText}`);
    const emptyCount = Number(unmatched[1]);
    assert.ok(
      emptyCount >= EXPECTED_CROSSES - 2 && emptyCount <= EXPECTED_CROSSES,
      `Après déplacement de carte, au moins ${EXPECTED_CROSSES - 2}/${EXPECTED_CROSSES} symboles doivent être signalés comme non résolus (observé ${emptyCount}).`,
    );
    assert.equal(await page.locator(".importer-resume").count(), 0, "aucune grille approximative n'est proposée");
    await page.getByRole("button", { name: /Réaligner/ }).click();
    // Retour à la lecture exacte : les positions viennent des graduations.
    await page.getByRole("button", { name: "DMC exacts" }).click();
    await expectText(page, ".importer-resume", /Grille 32 × 16 · 2 fils DMC · 2 carte/, 60000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "import-3-assembler-table.png") });
    await page.locator(".importer-actions .bouton.noir", { hasText: /Vérifier/ }).click();

    /* ---------- 6. Vérifier : rien d'approximatif n'est présenté comme exact ---------- */
    await expectText(page, ".importer-h2", /32 × 16 points · 2 fils · 512 croix/);
    await expectText(page, ".importer-controles li", /Lecture exacte par graduations/);
    await expectText(page, ".importer-controles li", /le PDF annonce 32 × 16/);
    const useButton = page.getByRole("button", { name: /Utiliser et broder/ });
    assert.equal(await useButton.isDisabled(), true, "le bouton attend les points à vérifier");
    for (const box of await page.locator(".importer-controles input[type=checkbox]").all()) await box.check();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "import-4-verifier.png") });
    await useButton.click();

    /* ---------- 7. Broder directement, marquer des croix ---------- */
    await page.locator(".broder-canvas").waitFor({ state: "visible" });
    await expectText(page, ".broder-titre strong", /Patron de test/);
    await expectText(page, ".broder-titre span", /0 \/ 512/);
    assert.equal(await page.locator(".broder-fil").count(), 2, "deux fils dans la liste de broderie");
    assert.match(page.url(), /#atelier-patron$/);
    const canvas = page.locator(".broder-canvas");
    await canvas.focus();
    for (const key of ["ArrowRight", " ", "ArrowRight", " ", "ArrowDown", "Enter"]) await page.keyboard.press(key);
    await expectText(page, ".broder-titre span", /3 \/ 512/);
    // Lecture en couleurs, puis couleurs + symboles : même grille, même progression.
    await page.getByRole("button", { name: "Couleurs" }).click();
    await expectText(page, ".broder-titre span", /3 \/ 512/);
    await page.getByRole("button", { name: "Les deux" }).click();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "import-5-broder-couleurs.png") });
    await page.getByRole("button", { name: "Symboles" }).click();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "import-5-broder.png") });
    await page.getByRole("button", { name: "Fermer le mode broderie et enregistrer la progression" }).click();
    await page.locator(".broder").waitFor({ state: "detached" });
    await expectText(page, ".studio-stats p", /512 croix/);
    await expectText(page, ".studio-stats p", /32 × 16/);

    /* ---------- 8. Fermer, rouvrir : la grille, la palette et la progression sont là ---------- */
    await page.reload();
    await page.locator(".studio-dock").waitFor({ state: "visible" });
    assert.match(page.url(), /#atelier-patron$/);
    await expectText(page, ".studio-stats p", /512 croix/);
    await page.locator("#dock-broder").click();
    await page.locator(".broder-canvas").waitFor({ state: "visible" });
    await expectText(page, ".broder-titre strong", /Patron de test/);
    await expectText(page, ".broder-titre span", /3 \/ 512/);
    const fils = await page.locator(".broder-fil span").allTextContents();
    assert.deepEqual(fils.sort(), ["DMC 310", "DMC 321"]);
    await page.getByRole("button", { name: "Fermer le mode broderie et enregistrer la progression" }).click();

    /* ---------- 9. Les panneaux disent que c'est un patron importé ; la rosace revient intacte ---------- */
    await page.locator(".studio-dock button", { hasText: /^Composer/ }).click();
    await expectText(page, ".panneau-import", /Patron de test/);
    await page.getByRole("button", { name: "Revenir à ma rosace" }).click();
    // Un patron importé ne quitte jamais l'appareil en silence : le retrait passe par une confirmation.
    await page.getByRole("button", { name: "Retirer le patron", exact: true }).click();
    await expectText(page, ".studio-stats p", /3\s?381 croix/);
    assert.match(page.url(), /#r=/);

    /* ---------- 10. Innovations : fil conducteur, toile qui se remplit, rythme, broder ensemble ---------- */
    const rosace = fromRosace(generateRosace(DEFAULT_CONFIG));
    const peerDone = rosace.stitches.slice(0, 40).map((stitch) => stitchIndex(rosace.width, stitch.x, stitch.y));
    const peerProject = buildProject(rosace, { ...emptyProgress(rosace), completedRuns: serializeRuns(peerDone) });
    const peerPath = path.join(ARTIFACT_DIR, "projet-amie.rosace.json");
    await writeFile(peerPath, JSON.stringify(peerProject));
    await page.locator("#dock-broder").click();
    await page.locator(".broder-canvas").waitFor({ state: "visible" });
    await expectText(page, ".broder-titre span", /0 \/ 3\s?381/);
    // Fil conducteur : « Suivante » amène sur la prochaine zone du fil en cours et l'annonce.
    await page.getByRole("button", { name: "Aller à la prochaine zone du fil en cours" }).click();
    await expectText(page, ".broder-resume div", /prochaine zone : \d+/);
    await page.locator(".broder-canvas").focus();
    await page.keyboard.press(" ");
    await expectText(page, ".broder-titre span", /1 \/ 3\s?381/);
    // Toile qui se remplit : le rendu toile est disponible et la progression ne bouge pas.
    await page.getByRole("button", { name: "Toile" }).click();
    await expectText(page, ".broder-titre span", /1 \/ 3\s?381/);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "innovation-toile.png") });
    await page.getByRole("button", { name: "Symboles" }).click();
    // Rythme : après une croix, le temps brodé apparaît ; la prévision attend assez de matière.
    await expectText(page, ".broder-resume p", /brodée/);
    // Broder ensemble : le projet d'une amie sur la même empreinte devient un calque, la mienne ne change pas.
    await page.locator("input[aria-label=\"Afficher la progression d'une amie sur ce même ouvrage\"]").setInputFiles(peerPath);
    await expectText(page, ".broder-amie", /Votre amie : 40 \/ 3\s?381/);
    await expectText(page, ".broder-titre span", /1 \/ 3\s?381/);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "innovation-ensemble.png") });
    await page.getByRole("button", { name: "Fermer le mode broderie et enregistrer la progression" }).click();
    await page.locator(".broder").waitFor({ state: "detached" });

    /* ---------- 11. Boîte à fils et tambour sur mesure ---------- */
    await page.locator(".studio-dock button", { hasText: /^Colorer/ }).click();
    await page.locator(".boite-fils input").fill("902, 3607, zz9");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expectText(page, ".boite-fils .panneau-aide", /2 fils dans votre boîte, 3 manquants/);
    await page.keyboard.press("Escape");
    await page.locator(".studio-dock button", { hasText: /^Ajuster/ }).click();
    await page.getByRole("button", { name: "10 cm" }).click();
    await expectText(page, ".panneau-reglages .panneau-aide", /Échelle conseillée : Miniature|déborde/);
    await page.keyboard.press("Escape");

    /* ---------- 12. Texte brodé ---------- */
    await page.locator(".studio-dock button", { hasText: /^Importer/ }).click();
    await page.locator(".importer-modes button", { hasText: /^Texte$/ }).click();
    await page.locator(".importer-texte-champ textarea").fill("MATT ♥ 2026");
    await page.locator(".importer-texte-options input[aria-label=\"Code DMC de l'ombre\"]").fill("321");
    await expectText(page, ".importer-texte-apercu p", /\d+ × \d+ points/);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "innovation-texte.png") });
    await page.getByRole("button", { name: "Broder ce texte" }).click();
    await page.locator(".broder-canvas").waitFor({ state: "visible" });
    await expectText(page, ".broder-titre strong", /Texte « MATT ♥ 2026 »/);
    assert.equal(await page.locator(".broder-fil").count(), 2);
    await page.getByRole("button", { name: "Fermer le mode broderie et enregistrer la progression" }).click();
    await page.locator(".broder").waitFor({ state: "detached" });

    /* ---------- 12 bis. Import photo : fils triés, confettis nettoyés, couleurs d'écran annoncées en sRGB ---------- */
    const photoPath = path.join(ARTIFACT_DIR, "photo-essai.png");
    await writeFile(photoPath, syntheticPng(96, 64));
    await page.locator(".studio-dock button", { hasText: /^Importer/ }).click();
    await page.locator(".importer-modes button", { hasText: /^Photo$/ }).click();
    await page.locator(".importer-photo").waitFor({ state: "visible" });
    await page.locator("input[accept*=\"image\"]").setInputFiles(photoPath);
    await page.locator(".importer-photo-table tbody tr").first().waitFor({ state: "visible" });
    await expectText(page, ".importer-photo-bilan", /fils? reconnus?.*confetti/s);
    const photoRows = await page.locator(".importer-photo-table tbody tr").count();
    assert.ok(photoRows >= 3 && photoRows <= 12, `entre 3 et 12 fils, ${photoRows} obtenus`);
    await expectText(page, ".importer-photo-table thead", /sRGB/);
    await expectText(page, ".importer-photo-note", /sRGB \(RVB\)/);
    await page.getByLabel("Afficher les valeurs sRGB").check();
    await expectText(page, ".importer-photo-table tbody tr:first-child", /#[0-9A-F]{6}/);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "innovation-photo.png") });
    await page.getByRole("button", { name: "Broder cette photo" }).click();
    await page.locator(".broder-canvas").waitFor({ state: "visible" });
    await expectText(page, ".broder-titre strong", /Photo photo-essai/);
    await page.getByRole("button", { name: "Fermer le mode broderie et enregistrer la progression" }).click();
    await page.locator(".broder").waitFor({ state: "detached" });

    /* ---------- 13. Fiche ROSACE réimportée : la rosace est retrouvée à l'identique, sans lecture d'image ---------- */
    const sheetPath = path.join(ARTIFACT_DIR, "fiche-rosace.pdf");
    const printer = await browser.newPage();
    await printer.setContent(worksheetHtml(rosace), { waitUntil: "load" });
    await printer.pdf({ path: sheetPath, format: "A4", printBackground: true });
    await printer.close();
    await page.goto(`${BASE_URL}#atelier-importer`);
    await page.locator(".importer-depot").waitFor({ state: "visible" });
    await page.locator("input[accept*=\"pdf\"]").first().setInputFiles(sheetPath);
    await expectText(page, ".importer-fiche strong", /Fiche ROSACE reconnue/, 60000);
    await expectText(page, ".importer-fiche p", new RegExp(rosace.fingerprint.slice(0, 8)));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "innovation-fiche.png") });
    await page.getByRole("button", { name: "Retrouver cette rosace" }).click();
    await page.locator(".importer").waitFor({ state: "detached" });
    // L'ouvrage actif est la photo importée plus haut : la remplacer par la rosace retrouvée demande confirmation.
    await page.getByRole("button", { name: "Retirer le patron", exact: true }).click();
    await expectText(page, ".studio-stats p", /3\s?381 croix/);
    assert.match(page.url(), /#r=/);

    await context.close();
    assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(" | ")}`);

    await importRobustness(browser, pdfPath);
    console.log(`Parcours d'import PDF réussi · ${EXPECTED_CROSSES} croix importées · captures dans ${ARTIFACT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
