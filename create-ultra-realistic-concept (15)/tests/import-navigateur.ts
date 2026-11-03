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
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5173";
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
    await page.locator("input[type=file]").setInputFiles(pdfPath);
    await expectText(page, ".importer-h2", /2 pages de grille/, 60000);
    await expectText(page, ".importer-texte", /Lecture vectorielle par graduations/);
    assert.equal(await page.locator(".importer-page").count(), 3, "trois pages analysées");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "import-1-analyser.png") });
    await page.locator(".importer-actions .bouton.noir", { hasText: /Caler les grilles/ }).click();

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
    // Ce PDF n'a pas de légende lisible en image : la lecture automatique le dit, sans inventer de couleurs.
    await expectText(page, ".importer-section .panneau-aide", /512 symbole\(s\) sans code, laissés vides/, 60000);
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
    await expectText(page, ".studio-stats p", /3\s?381 croix/);
    assert.match(page.url(), /#r=/);

    await context.close();
    assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(" | ")}`);
    console.log(`Parcours d'import PDF réussi · ${EXPECTED_CROSSES} croix importées · captures dans ${ARTIFACT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
