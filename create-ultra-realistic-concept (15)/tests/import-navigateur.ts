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
import { chromium, type Page } from "playwright-core";
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
