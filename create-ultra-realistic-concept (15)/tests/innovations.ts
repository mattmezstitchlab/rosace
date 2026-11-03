import assert from "node:assert/strict";
import { DEFAULT_CONFIG, generateRosace, normalizeConfig } from "../src/lib/rosace";
import { fromImport, fromRosace } from "../src/lib/work";
import { buildProject, emptyProgress, importProject, readPeerProgress, reconcileProgress, serializeRuns, stitchIndex } from "../src/lib/progress";
import { computeRhythm, forecast, recordStitches, sanitizeSessions, SESSION_GAP_MS } from "../src/lib/sessions";
import { parseThreadCodes, shoppingCsv, shoppingList } from "../src/lib/threadbox";
import { HOOP_MARGIN_CM, hoopFits, suggestScale } from "../src/lib/hoop";
import { textGrid, unsupportedChars } from "../src/lib/text";
import { WORKSHEET_END, WORKSHEET_MARK, worksheetHtml } from "../src/lib/exporters";
import { readRosaceWorksheet } from "../src/lib/import-pdf/worksheet";
import type { PdfHandle } from "../src/lib/import-pdf/pdfimport";

/** Innovations du premier lot : chaque brique est pure et testée ici avant d'être branchée dans l'atelier. */
let checks = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve().then(fn).then(() => { checks += 1; console.log(`ok ${checks} — ${name}`); }).catch((error) => { console.error(`not ok — ${name}`); throw error; });
}

const rosace = fromRosace(generateRosace(DEFAULT_CONFIG));

await test("séances : les croix proches s'agrègent, un écart > 20 min ouvre une nouvelle séance", () => {
  const t0 = new Date("2026-11-03T20:00:00Z");
  let sessions = recordStitches([], 1, t0);
  sessions = recordStitches(sessions, 4, new Date(t0.getTime() + 5 * 60_000));
  sessions = recordStitches(sessions, 0, new Date(t0.getTime() + 6 * 60_000));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].stitches, 5);
  sessions = recordStitches(sessions, 2, new Date(t0.getTime() + 5 * 60_000 + SESSION_GAP_MS + 1));
  assert.equal(sessions.length, 2);
  assert.deepEqual(sanitizeSessions([...sessions, { start: "x", end: "y", stitches: 1 }, null]), sessions, "entrées invalides écartées");
});

await test("rythme et prévision : honnêtes, en fourchette, seulement avec assez de matière", () => {
  const t0 = new Date("2026-11-01T18:00:00Z");
  let sessions = recordStitches([], 10, t0);
  sessions = recordStitches(sessions, 20, new Date(t0.getTime() + 15 * 60_000));
  sessions = recordStitches(sessions, 30, new Date(t0.getTime() + 30 * 60_000)); // 60 croix en 30 min, une seule séance
  const rhythm = computeRhythm(sessions);
  assert.equal(rhythm.minutes, 30);
  assert.equal(rhythm.stitchesPerHour, 120);
  assert.equal(rhythm.reliable, true);
  const now = new Date("2026-11-03T18:00:00Z");
  const f = forecast(rhythm, 240, sessions, now);
  assert.ok(f);
  assert.equal(f.remainingMinutes, 120);
  assert.equal(f.low, 84);
  assert.equal(f.high, 156);
  assert.ok(f.finishDate && f.finishDate.getTime() > now.getTime(), "date de fin dans le futur");
  // 15 min brodées sur 2 jours → 7,5 min/jour → 120 min restantes ≈ 16 jours… vérifié qualitativement.
  assert.equal(forecast(computeRhythm(recordStitches([], 5, t0)), 100, [], now), null, "pas de prévision sur 5 croix");
});

await test("progression : les séances voyagent dans le projet et fusionnent entre onglets sans doublon", () => {
  const t0 = new Date("2026-11-02T10:00:00Z");
  const sessions = recordStitches([], 12, t0);
  const progress = { ...emptyProgress(rosace), completedRuns: serializeRuns([0, 1, 2]), sessions };
  const project = buildProject(rosace, progress);
  const reread = importProject(JSON.parse(JSON.stringify(project)));
  assert.equal(reread.ok, true);
  if (!reread.ok) return;
  assert.deepEqual(reread.progress.sessions, sessions);
  const other = { ...emptyProgress(rosace), completedRuns: serializeRuns([5]), sessions: recordStitches(sessions, 3, new Date(t0.getTime() + 60_000)) };
  const merged = reconcileProgress(other, progress, emptyProgress(rosace));
  assert.equal(merged.sessions?.length, 1, "même séance (même début) fusionnée, pas dupliquée");
  assert.equal(merged.sessions?.[0].stitches, 15, "la version la plus récente de la séance gagne");
});

await test("broder ensemble : un projet de la même empreinte devient un calque, un autre ouvrage est refusé", () => {
  const first = stitchIndex(rosace.width, rosace.stitches[0].x, rosace.stitches[0].y);
  const peerProject = buildProject(rosace, { ...emptyProgress(rosace), completedRuns: serializeRuns([first]) });
  const peer = readPeerProgress(JSON.parse(JSON.stringify(peerProject)), rosace);
  assert.equal(peer.ok, true);
  if (peer.ok) assert.deepEqual([...peer.completed], [first]);
  const otherWork = fromRosace(generateRosace({ ...DEFAULT_CONFIG, seed: 42 }));
  const wrong = readPeerProgress(JSON.parse(JSON.stringify(peerProject)), otherWork);
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.match(wrong.error, /même ouvrage/);
});

await test("boîte à fils : codes collés en vrac, liste de courses et CSV des manquants", () => {
  const parsed = parseThreadCodes("310, DMC 321 3799 ; blanc  zz99 mix:1/2");
  assert.deepEqual(parsed.codes, ["310", "321", "3799", "BLANC"]);
  assert.deepEqual(parsed.unknown, ["zz99", "mix:1/2"]);
  const box = new Set(rosace.palette.slice(0, 2).map((entry) => entry.code));
  const list = shoppingList(rosace, box);
  assert.equal(list.lines.length, rosace.usage.filter((line) => line.count > 0).length);
  assert.equal(list.owned, 2);
  assert.equal(list.missing, list.lines.length - 2);
  assert.ok(list.skeinsToBuy >= list.missing, "au moins une échevette par fil manquant");
  const csv = shoppingCsv(rosace, box);
  assert.equal(csv.split("\n").length, 1 + list.missing);
  assert.ok(!csv.includes(rosace.palette[0].code), "un fil possédé n'est pas dans la liste de courses");
});

await test("tambour : la plus grande échelle qui tient, sinon un aïda plus fin est suggéré", () => {
  const fits = hoopFits(normalizeConfig(DEFAULT_CONFIG), 20);
  assert.equal(fits.length, 5);
  assert.ok(fits.every((fit, i) => i === 0 || fit.motifCm >= fits[i - 1].motifCm), "le motif grandit avec l'échelle");
  const twenty = suggestScale(normalizeConfig(DEFAULT_CONFIG), 20);
  assert.equal(twenty.fits, true);
  assert.ok(twenty.motifCm <= 20 - HOOP_MARGIN_CM * 2);
  assert.ok(fits.filter((fit) => fit.fits).every((fit) => fit.scale <= twenty.scale), "c'est bien la plus grande qui tient");
  const tiny = suggestScale(normalizeConfig(DEFAULT_CONFIG), 8);
  assert.equal(tiny.scale, 1);
  assert.equal(tiny.fits, false);
  assert.ok(tiny.aidaHint === null || tiny.aidaHint > 14);
});

await test("texte brodé : police 5 × 7, deux fils avec ombre, caractères inconnus annoncés, ouvrage valide", () => {
  const grid = textGrid({ text: "MATT\n& ÉMILIE", code: "310", shadowCode: "321", margin: 1, align: "center" });
  assert.ok(!("error" in grid), "error" in grid ? grid.error : "");
  if ("error" in grid) return;
  assert.equal(grid.kind, "text");
  assert.equal(grid.text, "MATT / & ÉMILIE");
  assert.equal(grid.width, (8 * 6 - 1) + 2 + 1, "largeur = 8 lettres × (5+1) − 1 + marges + ombre");
  assert.equal(grid.height, 7 * 2 + 2 + 2 + 1);
  assert.deepEqual(grid.colors.map((entry) => entry.code), ["310", "321"]);
  const outcome = fromImport(grid);
  assert.equal(outcome.ok, true, outcome.ok ? "" : outcome.error);
  if (!outcome.ok) return;
  assert.equal(outcome.work.origin.kind, "text");
  assert.ok(outcome.work.usage[0].count > outcome.work.usage[1].count / 2, "le texte domine l'ombre");
  assert.ok(outcome.work.stitches.length > 100);
  // Aller-retour projet v3 pour un texte.
  const project = buildProject(outcome.work, emptyProgress(outcome.work));
  assert.equal(project.version === 3 && project.origin, "text");
  const back = importProject(JSON.parse(JSON.stringify(project)));
  assert.equal(back.ok && back.work.origin.kind === "text" && back.work.origin.text, "MATT / & ÉMILIE");
  assert.deepEqual(unsupportedChars("héllo @ 2026 ✓"), ["@", "✓"]);
  assert.ok("error" in textGrid({ text: "A", code: "310", shadowCode: "310" }));
  assert.ok("error" in textGrid({ text: "   ", code: "310" }));
});

await test("fiche ROSACE : la couverture porte la recette encodée, et sa lecture retrouve exactement la rosace", async () => {
  const html = worksheetHtml(rosace);
  const match = new RegExp(`${WORKSHEET_MARK} ([0-9A-F]{16}) r=([A-Za-z0-9_ -]+?) ${WORKSHEET_END}`).exec(html);
  assert.ok(match, "marqueur imprimé sur la couverture");
  assert.equal(match![1], rosace.fingerprint);
  assert.ok(match![2].includes(" "), "la recette est découpée en morceaux pour tenir sur plusieurs lignes");
  // Un PDF dont le texte contient le marqueur, découpé comme pdf.js pourrait le faire (lignes et morceaux).
  const token = `${WORKSHEET_MARK} ${match![1]} r=${match![2]} ${WORKSHEET_END}`;
  const pieces = token.split(" ");
  const handle: PdfHandle = {
    pages: 5,
    dims: async () => ({ w: 595, h: 842 }),
    rawText: async () => [],
    render: async () => { throw new Error("pas d'image"); },
    text: async (n) => (n === 1 ? pieces.map((str, i) => ({ str, x: 40 + i * 50, y: 700, size: 7 })) : []),
    destroy: () => {},
  };
  const reading = await readRosaceWorksheet(handle);
  assert.equal(reading.kind, "rosace", JSON.stringify(reading));
  if (reading.kind !== "rosace") return;
  assert.equal(reading.fingerprint, rosace.fingerprint);
  assert.equal(fromRosace(generateRosace(reading.config)).fingerprint, rosace.fingerprint);
  // Une empreinte imprimée qui ne correspond pas à la recette est signalée, jamais acceptée.
  const tampered: PdfHandle = { ...handle, text: async () => [{ str: token.replace(match![1], "0000000000000000"), x: 0, y: 0, size: 7 }] };
  const bad = await readRosaceWorksheet(tampered);
  assert.equal(bad.kind, "mismatch");
  const none = await readRosaceWorksheet({ ...handle, text: async () => [{ str: "Patron Etsy", x: 0, y: 0, size: 10 }] });
  assert.equal(none.kind, "none");
});

console.log(`\n${checks} tests d'innovations réussis.`);
