import assert from "node:assert/strict";
import { DEFAULT_CONFIG, generateRosace } from "../src/lib/rosace";
import { fromImport, fromRosace, restoreImportedWork, serializeImportedWork, type ImportedGrid, type StitchWork } from "../src/lib/work";
import { buildProject, emptyProgress, importProject, parseRuns, readPeerProgress, serializeRuns } from "../src/lib/progress";
import { downloadBlob, patternToSvg, printWorksheet, safeName, threadCsv, workTitle, worksheetHtml } from "../src/lib/exporters";
import { shoppingCsv } from "../src/lib/threadbox";
import { readFavorites, readImportedWork } from "../src/state/rosace-store";

/**
 * Robustesse des entrées et des sorties : fichiers de progression ou de projet hostiles, ouvrage importé
 * abîmé au démarrage, stockage défaillant, fiche et exports sans injection. Chaque cas vient d'un défaut réel,
 * reproduit avant correction ; les gardes de temps sont larges (x50) mais échouent sur l'ancien comportement.
 */
let checks = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      checks += 1;
      console.log(`ok ${checks} — ${name}`);
    })
    .catch((error) => {
      console.error(`not ok — ${name}`);
      throw error;
    });
}

const memory = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, String(value)); },
  removeItem: (key: string) => { memory.delete(key); },
};
const deniedStorage = {
  getItem: (): never => { throw new DOMException("Accès refusé", "SecurityError"); },
  setItem: (): never => { throw new DOMException("Accès refusé", "SecurityError"); },
  removeItem: (): never => { throw new DOMException("Accès refusé", "SecurityError"); },
};
const useStorage = (storage: unknown) => Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
const IMPORTED_KEY = "aime-rosace-imported-v1";
const FAVORITES_KEY = "aime-rosace-favorites-v1";

const NO_LOSS = { halfStitches: 0, quarterStitches: 0, backstitches: 0, knots: 0, blends: 0, unresolved: 0 };
function grid(overrides: Partial<ImportedGrid> = {}): ImportedGrid {
  return {
    width: 4,
    height: 3,
    cells: Int16Array.from([0, 1, 0, 1, 1, 0, 1, 0, 0, 1, -1, -1]),
    colors: [{ code: "310", symbol: "×", fromLegend: true }, { code: "321", symbol: "●", fromLegend: true }],
    provenance: { file: "patron.pdf", title: "Mon patron", author: "Anne", pages: 2, mode: "glyphes" },
    montage: { tiles: [{ page: 1, x: 0, y: 0, width: 4, height: 3 }], overlaps: 1, holes: 2, scaled: true },
    lost: { ...NO_LOSS, halfStitches: 3 },
    declaredSize: { w: 193, h: 200 },
    ...overrides,
  };
}
function importedWork(overrides?: Partial<ImportedGrid>): StitchWork {
  const outcome = fromImport(grid(overrides));
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.work;
}
const baseRecord = (): Record<string, unknown> => JSON.parse(JSON.stringify(serializeImportedWork(importedWork())));

/** Tout ce qu'un ouvrage restauré doit pouvoir traverser sans exception, quel que soit le contenu du fichier d'origine. */
function exercise(work: StitchWork) {
  workTitle(work);
  safeName(work);
  const html = worksheetHtml(work);
  const svg = patternToSvg(work);
  patternToSvg(work, true);
  threadCsv(work);
  shoppingCsv(work, new Set());
  return { html, svg };
}

/** Balises et attributs réellement présents (valeurs entre guillemets ignorées) : ce qu'un navigateur exécuterait. */
function injectedMarkup(markup: string): string[] {
  const offenders: string[] = [];
  for (const tag of markup.matchAll(/<([a-zA-Z][^\s/>]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g)) {
    if (/^(script|img|iframe|object|embed|link|base|form|input|a|video|audio|source|math)$/i.test(tag[1])) offenders.push(`<${tag[1]}>`);
    for (const attribute of tag[2].matchAll(/\s+([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g)) {
      if (/^on/i.test(attribute[1])) offenders.push(`${tag[1]} ${attribute[1]}`);
      if (/javascript:/i.test(attribute[2] ?? "")) offenders.push(`${tag[1]} ${attribute[1]}=javascript:`);
    }
  }
  return offenders;
}

const rosace = fromRosace(generateRosace(DEFAULT_CONFIG));
const firstStitch = rosace.cells.findIndex((value) => value >= 0);
const rosaceProject = (completedRuns: string) => {
  const project = JSON.parse(JSON.stringify(buildProject(rosace, { ...emptyProgress(rosace), completedRuns: serializeRuns([firstStitch]) })));
  project.progress.completedRuns = completedRuns;
  return project;
};

const timed = <T>(fn: () => T): { value: T; ms: number } => {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
};

// ─── Listes de plages (progression) ──────────────────────────────────────────────────────────────

await test("plages : 1e21, entier non sûr, négatif, hexadécimal, inversé ou décimal n'ouvrent aucune case — et ne bouclent pas", () => {
  const hostile = ["1e21", "9007199254740992", "9007199254740993-9007199254740999", `0-${"9".repeat(400)}`, "-5", "0x10", "5-3", "1.5", "2-", "-", "a-b", "NaN", "Infinity", "1 2", "٣"];
  const { value, ms } = timed(() => hostile.map((runs) => [...parseRuns(runs, 1000)]));
  assert.deepEqual(value, hostile.map(() => []));
  assert.ok(ms < 500, `${ms.toFixed(0)} ms pour ${hostile.length} jetons hostiles`);
});

await test("plages : un jeton vide n'est plus l'index 0 ; les espaces autour d'un jeton sont tolérés", () => {
  assert.deepEqual([...parseRuns("1,,2", 10)], [1, 2]);
  assert.deepEqual([...parseRuns(",", 10)], []);
  assert.deepEqual([...parseRuns("", 10)], []);
  assert.deepEqual([...parseRuns(" 3-4 , 7 ", 10)], [3, 4, 7]);
  assert.deepEqual([...parseRuns("0", 10)], [0], "un vrai 0 reste un 0");
});

await test("plages : plus de plafond à 100 000 — 0-149999 est restauré en entier, vite", () => {
  const { value, ms } = timed(() => parseRuns("0-149999", 200_000));
  assert.equal(value.size, 150_000);
  assert.ok(value.has(0) && value.has(149_999) && !value.has(150_000));
  assert.ok(ms < 1000, `${ms.toFixed(0)} ms`);
  assert.equal(parseRuns("0-149999").size, 150_000, "sans nombre de cases, la borne d'un ouvrage s'applique");
});

await test("plages : 2000 × « 0-99999 » coûte quelques millisecondes (tableau de différences), pas plusieurs secondes", () => {
  const runs = Array.from({ length: 2000 }, () => "0-99999").join(",");
  const { value, ms } = timed(() => parseRuns(runs, 100_000));
  assert.equal(value.size, 100_000);
  assert.ok(ms < 1000, `${ms.toFixed(0)} ms (l'ancienne lecture en demandait ~4 700)`);
});

await test("plages : le nombre de cases borne le résultat ; une liste démesurée pour la grille n'est pas lue", () => {
  assert.deepEqual([...parseRuns("0-9,50-60", 20)], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([...parseRuns("19,20,21", 20)], [19]);
  assert.equal(parseRuns("0-4", 0).size, 0);
  assert.equal(parseRuns("1,".repeat(1000), 10).size, 0, "2 000 caractères pour 10 cases : refusé sans parcours");
  assert.equal(parseRuns("0-4", Number.NaN).size, 5, "un nombre de cases invalide retombe sur la borne d'un ouvrage");
  assert.equal(parseRuns(undefined as unknown as string, 10).size, 0);
});

await test("plages : serializeRuns écarte NaN, décimaux, négatifs et entiers non sûrs ; l'aller-retour est exact", () => {
  assert.equal(serializeRuns([1e21, 9007199254740992, Number.NaN, Number.POSITIVE_INFINITY, -1, 2.5, 0, 1, 2, 5]), "0-2,5");
  const indices = [0, 1, 2, 10, 11, 4000, 150_000, 150_001];
  assert.deepEqual([...parseRuns(serializeRuns(indices), 200_000)], indices);
});

// ─── Fichiers projet et calque d'une amie ────────────────────────────────────────────────────────

await test("projet v2 : une plage illisible est ignorée avec un avertissement français, jamais un blocage ni « JSON invalide »", () => {
  for (const runs of ["1e21", `0-${"9".repeat(400)}`, "0x10", "-5"]) {
    const { value: result, ms } = timed(() => importProject(rosaceProject(runs)));
    assert.ok(ms < 500, `${runs.slice(0, 12)} : ${ms.toFixed(0)} ms`);
    assert.equal(result.ok, true, runs.slice(0, 12));
    if (result.ok) {
      assert.equal(result.progress.completedRuns, "");
      assert.match(result.warning ?? "", /illisible/);
    }
  }
});

await test("projet v2 : cases hors grille, liste démesurée et plage géante sont refusées en français, vite", () => {
  const cells = rosace.cells.length;
  const cases: Array<[string, RegExp]> = [
    [`0-${Number.MAX_SAFE_INTEGER}`, /hors de la grille/],
    [`${cells}-99999`, /hors de la grille/],
    [Array.from({ length: 2000 }, () => "0-99999").join(","), /hors de la grille/],
    ["1,".repeat(100_000), /trop volumineuse/],
  ];
  for (const [runs, message] of cases) {
    const { value: result, ms } = timed(() => importProject(rosaceProject(runs)));
    assert.ok(ms < 1000, `${runs.slice(0, 12)} : ${ms.toFixed(0)} ms`);
    assert.equal(result.ok, false, runs.slice(0, 12));
    if (!result.ok) assert.match(result.error, message);
  }
  const valid = importProject(rosaceProject(serializeRuns([firstStitch])));
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.warning, undefined);
});

await test("projet : un RangeError n'est pas annoncé comme « JSON invalide » ; une clé __proto__ ne pollue rien", () => {
  const exploding = { format: "rosace-project", get version(): number { throw new RangeError("Invalid array length"); } };
  const result = importProject(exploding);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /trop volumineux ou trop complexe/);
    assert.doesNotMatch(result.error, /JSON invalide/);
  }
  const polluted = importProject(JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"format":"rosace-project","version":2}'));
  assert.equal(polluted.ok, false);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

await test("projet v1 : indices non sûrs, négatifs ou décimaux écartés sans exception ; les valides sont migrés", () => {
  const migrated = importProject({ version: 1, format: "rosace-project", config: DEFAULT_CONFIG, progress: { completed: [1e300, -1, 2.5, firstStitch, 99_999_999] } });
  assert.equal(migrated.ok, true);
  if (migrated.ok) {
    assert.equal(migrated.migratedFrom, 1);
    assert.equal(migrated.progress.completedRuns, String(firstStitch));
    assert.match(migrated.warning ?? "", /ignorée/);
  }
  const text = importProject({ version: 1, format: "rosace-project", config: DEFAULT_CONFIG, progress: { completedRuns: "1e21" } });
  assert.equal(text.ok, true);
  if (text.ok) assert.equal(text.progress.completedRuns, "");
});

await test("calque d'une amie : même ouvrage seulement, cases bornées à la grille, fichier hostile refusé proprement", () => {
  const peer = readPeerProgress(rosaceProject(serializeRuns([firstStitch])), rosace);
  assert.equal(peer.ok, true);
  if (peer.ok) assert.deepEqual([...peer.completed], [firstStitch]);
  const beyond = readPeerProgress(rosaceProject(`0-${Number.MAX_SAFE_INTEGER}`), rosace);
  assert.equal(beyond.ok, false);
  const other = readPeerProgress(rosaceProject(serializeRuns([firstStitch])), importedWork());
  assert.equal(other.ok, false);
  if (!other.ok) assert.match(other.error, /empreintes/);
  const garbled = readPeerProgress(rosaceProject("1e21"), rosace);
  assert.equal(garbled.ok, true);
  if (garbled.ok) assert.equal(garbled.completed.size, 0);
});

// ─── Ouvrage importé : étiquettes, montage et pertes ne sont pas dignes de confiance ─────────────

await test("symboles : quatre points de code au plus, contrôles retirés, glyphes légitimes conservés", () => {
  const symbolOf = (symbol: string) => importedWork({ colors: [{ code: "310", symbol, fromLegend: true }, { code: "321", symbol: "▲", fromLegend: true }] }).palette[0].symbol;
  for (const glyph of ["&", "<", "+", "*", "#", "●", "▲", "×"]) assert.equal(symbolOf(glyph), glyph);
  assert.equal(symbolOf("\u0000\u0007x"), "x");
  assert.equal(symbolOf("ABCDEFGH"), "ABCD");
  assert.equal(symbolOf("😀😀😀😀😀"), "😀😀😀😀", "les caractères hors plan de base ne sont pas coupés en deux");
  assert.equal(symbolOf(""), "·");
  assert.equal(symbolOf("\u202e\u2066"), "·", "des marques de sens de lecture seules ne font pas un symbole");
  assert.equal(symbolOf(`${"x".repeat(5_000_000)}`), "xxxx", "une chaîne énorme ne coûte rien");
});

await test("ouvrage valide : provenance, montage, pertes, taille déclarée et date traversent export puis relecture inchangés", () => {
  const work = importedWork();
  const restored = restoreImportedWork(JSON.parse(JSON.stringify(serializeImportedWork(work))));
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.deepEqual(restored.work.origin, work.origin);
  assert.equal(restored.work.fingerprint, work.fingerprint);
  assert.deepEqual(restored.work.palette, work.palette);
  assert.deepEqual(restored.work.textile, work.textile);
  if (restored.work.origin.kind === "rosace") throw new Error("origine inattendue");
  assert.deepEqual(restored.work.origin.provenance, { file: "patron.pdf", title: "Mon patron", author: "Anne", pages: 2, mode: "glyphes" });
  assert.deepEqual(restored.work.origin.declaredSize, { w: 193, h: 200 });
  assert.equal(restored.work.origin.montage.tiles.length, 1);
});

const hostileRecord = (): Record<string, unknown> => ({
  ...baseRecord(),
  palette: [
    { code: "310", symbol: "<img src=x onerror=alert(1)>" },
    { code: "321", symbol: "\u0000\u202e&\"" },
  ],
  provenance: { file: "\"><script>alert(1)</script>.pdf", title: "<svg onload=alert(2)>", author: "'><b onclick=alert(4)>", pages: "<script>", mode: "<img onerror=1>" },
  montage: { tiles: [{ page: "<x>", x: "<y>", width: {}, height: [] }, null, 7], overlaps: "<script>", holes: {}, scaled: "yes" },
  lost: { halfStitches: "<b>", quarterStitches: -4, backstitches: null, knots: Number.POSITIVE_INFINITY, blends: [], unresolved: "9" },
  textile: { fabric: "<x>", aida: "<x>", strands: "<x>", wastePercent: "abc" },
  importedAt: "<script>alert(3)</script>",
  declaredSize: { w: "<x>", h: 1 },
});

await test("ouvrage hostile : champs ramenés à des valeurs saines à la restauration, fiche et SVG sans balise ni gestionnaire injectés", () => {
  const outcome = restoreImportedWork(hostileRecord());
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  if (!outcome.ok || outcome.work.origin.kind === "rosace") return;
  const { work } = outcome;
  const origin = work.origin as Exclude<typeof work.origin, { kind: "rosace" }>;
  assert.ok(work.palette.every((entry) => [...entry.symbol].length <= 4));
  assert.equal(work.palette[1].symbol, "&\"", "les glyphes légitimes sont conservés : l'échappement se fait à la sortie");
  assert.equal(origin.kind, "pdf");
  assert.equal(origin.provenance.mode, "auto");
  assert.equal(origin.provenance.pages, 0);
  assert.deepEqual(origin.montage, { tiles: [{ page: 0, x: 0, y: 0, width: 0, height: 0 }], overlaps: 0, holes: 0, scaled: false });
  assert.deepEqual(origin.lost, NO_LOSS);
  assert.equal(origin.declaredSize, undefined);
  assert.ok(Number.isFinite(Date.parse(origin.importedAt)));
  assert.deepEqual(work.textile, { fabric: "naturel", aida: 14, strands: 2, wastePercent: 15 });

  const { html, svg } = exercise(work);
  assert.deepEqual(injectedMarkup(html), []);
  assert.deepEqual(injectedMarkup(svg), []);
  assert.doesNotMatch(html, /<script|<img /i);
  assert.ok(!html.includes('"><script>') && !html.includes("<svg onload") && !html.includes("<img src=x"), "aucune charge utile brute");
  assert.ok(html.includes("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;.pdf"), "le nom de fichier est affiché, échappé");
  assert.ok(html.includes("&lt;svg onload=alert(2)&gt;"), "le titre est affiché, échappé");
  assert.ok(html.includes("<button class=\"print\">"), "le bouton d'impression n'a plus d'attribut onclick");
  assert.doesNotMatch(html, /window\.print/);
});

await test("ouvrage « texte » hostile : la phrase brodée est échappée dans le titre, la fiche et le SVG", () => {
  const outcome = restoreImportedWork({ ...baseRecord(), kind: "text", text: "<img src=x onerror=alert(1)>" });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(workTitle(outcome.work), "Texte « <img src=x onerror=alert(1)> »");
  const { html, svg } = exercise(outcome.work);
  assert.deepEqual(injectedMarkup(html), []);
  assert.deepEqual(injectedMarkup(svg), []);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

await test("restauration : aucune valeur de n'importe quel champ ne fait lever workTitle, fiche, SVG, CSV ou liste de courses", () => {
  const garbage: unknown[] = [
    null, true, false, 0, -1, 1.5, 1e21, 1e308, -1e308, Number.POSITIVE_INFINITY, "", " ", "x".repeat(10_000), "<script>alert(1)</script>", "\u0000\u0001\u202e", "9",
    [], [null], [[]], [1, 2, 3], {}, { a: 1 }, { tiles: "x", overlaps: [], holes: {}, scaled: [] },
    JSON.parse('{"__proto__":{"x":1},"constructor":{"prototype":{"y":2}},"file":7,"pages":"1","mode":{}}'),
    Array.from({ length: 50 }, (_, index) => ({ page: index, x: index, y: index, width: index, height: index })),
  ];
  const fields = ["kind", "text", "width", "height", "cells", "palette", "textile", "provenance", "montage", "lost", "importedAt", "declaredSize"];
  let restored = 0;
  for (const field of fields) {
    for (const value of garbage) {
      const record = baseRecord();
      record[field] = value;
      const outcome = restoreImportedWork(record);
      if (outcome.ok) {
        exercise(outcome.work);
        restored += 1;
      } else assert.match(outcome.error, /\S/);
    }
    const missing = baseRecord();
    delete missing[field];
    const outcome = restoreImportedWork(missing);
    if (outcome.ok) exercise(outcome.work);
  }
  assert.ok(restored > 50, `${restored} restaurations réussies : le balayage doit aussi exercer les valeurs acceptées`);
  assert.equal(({} as { x?: unknown; y?: unknown }).x, undefined);
  assert.equal(({} as { x?: unknown; y?: unknown }).y, undefined);
  for (const record of [null, undefined, 5, "x", [], [[]], true]) assert.equal(restoreImportedWork(record).ok, false);
});

await test("étiquettes : un titre de 5 Mo est borné à 300 caractères sans coût, un auteur non textuel est ignoré", () => {
  const { value: outcome, ms } = timed(() => restoreImportedWork({ ...baseRecord(), provenance: { file: "f.pdf", title: "t".repeat(5_000_000), author: 12345, pages: 3.9, mode: "vectoriel" } }));
  assert.ok(ms < 500, `${ms.toFixed(0)} ms`);
  assert.equal(outcome.ok, true);
  if (!outcome.ok || outcome.work.origin.kind === "rosace") return;
  const { provenance } = outcome.work.origin;
  assert.equal([...(provenance.title ?? "")].length, 300);
  assert.equal(provenance.author, undefined);
  assert.equal(provenance.pages, 3);
  assert.equal(provenance.mode, "vectoriel");
});

await test("taux de perte : « abc » ou Infinity retombent sur 15 % ; aucun NaN dans la liste de fils", () => {
  for (const wastePercent of ["abc", Number.POSITIVE_INFINITY, Number.NaN, null, {}, [], "1e999"]) {
    const outcome = restoreImportedWork({ ...baseRecord(), textile: { fabric: "naturel", aida: 14, strands: 2, wastePercent } });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.ok(Number.isFinite(outcome.work.textile.wastePercent), String(wastePercent));
    const numbers = [outcome.work.totalStrandMeters, outcome.work.totalNeedleMeters, outcome.work.totalSkeins, ...outcome.work.usage.flatMap((usage) => [usage.count, usage.strandMeters, usage.meters, usage.skeins])];
    assert.ok(numbers.every(Number.isFinite), `${String(wastePercent)} → ${numbers.join(" ")}`);
    assert.doesNotMatch(worksheetHtml(outcome.work), /NaN|undefined|Infinity/);
  }
  const clamped = restoreImportedWork({ ...baseRecord(), textile: { wastePercent: 400 } });
  assert.equal(clamped.ok && clamped.work.textile.wastePercent, 50, "une valeur finie hors plage est bornée, comme avant");
});

await test("projet v3 : la provenance d'un fichier hostile est assainie par le même chemin que le stockage local", () => {
  const work = importedWork();
  const project = JSON.parse(JSON.stringify(buildProject(work, { ...emptyProgress(work), completedRuns: "0-2" })));
  Object.assign(project.work, { palette: hostileRecord().palette, provenance: hostileRecord().provenance, montage: hostileRecord().montage, lost: hostileRecord().lost });
  const result = importProject(project);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.progress.completedRuns, "0-2");
  const { html } = exercise(result.work);
  assert.deepEqual(injectedMarkup(html), []);
  if (result.work.origin.kind !== "rosace") assert.equal(result.work.origin.provenance.mode, "auto");
});

await test("démarrage : un enregistrement d'ouvrage empoisonné est réparé, un enregistrement illisible est ignoré — jamais d'exception", () => {
  useStorage(memoryStorage);
  memory.clear();
  assert.equal(readImportedWork(), null);
  memory.set(IMPORTED_KEY, JSON.stringify(serializeImportedWork(importedWork())));
  assert.equal(readImportedWork()?.fingerprint, importedWork().fingerprint);
  memory.set(IMPORTED_KEY, JSON.stringify(hostileRecord()));
  const repaired = readImportedWork();
  assert.ok(repaired);
  if (repaired) assert.deepEqual(injectedMarkup(exercise(repaired).html), []);
  for (const stored of ["{pas du json", "null", "[]", "5", '"x"', '{"cells":5}', '{"cells":"AAAA","palette":[],"width":1,"height":1}']) {
    memory.set(IMPORTED_KEY, stored);
    assert.equal(readImportedWork(), null, stored);
  }
  useStorage(deniedStorage);
  assert.equal(readImportedWork(), null, "localStorage inaccessible (navigation privée) : l'application démarre sans ouvrage");
  useStorage(memoryStorage);
});

await test("collection : validée entrée par entrée ; une collection illisible renvoie null (jamais []) pour ne pas être écrasée", () => {
  useStorage(memoryStorage);
  memory.clear();
  assert.deepEqual(readFavorites(), [], "aucune collection : liste vide, rien à protéger");
  memory.set(FAVORITES_KEY, "{pas du json");
  assert.equal(readFavorites(), null);
  memory.set(FAVORITES_KEY, '{"a":1}');
  assert.equal(readFavorites(), null);
  memory.set(FAVORITES_KEY, JSON.stringify([null, 3, "x"]));
  assert.equal(readFavorites(), null, "des entrées toutes inutilisables : stockage à ne pas écraser");
  memory.set(FAVORITES_KEY, "[]");
  assert.deepEqual(readFavorites(), []);

  memory.set(FAVORITES_KEY, JSON.stringify([
    { id: "a", name: "N".repeat(500), config: DEFAULT_CONFIG, createdAt: "pas une date", stitches: -4 },
    { id: "a", name: 7, createdAt: 12 },
    null,
    { id: "z".repeat(500), name: "  ", config: { seed: "x", palette: "y" }, createdAt: "2026-01-02T03:04:05.000Z", stitches: "12.6" },
  ]));
  const list = readFavorites();
  assert.ok(list);
  if (!list) return;
  assert.equal(list.length, 3);
  assert.equal(list[0].name.length, 80);
  assert.ok(Number.isFinite(Date.parse(list[0].createdAt)), "une date abîmée est remplacée");
  assert.equal(list[0].stitches, 0);
  assert.equal(new Set(list.map((entry) => entry.id)).size, 3, "identifiants uniques");
  assert.equal(list[1].name, "Rosace 2");
  assert.equal(list[2].id.length, 80);
  assert.equal(list[2].name, "Rosace 4");
  assert.equal(list[2].stitches, 13);
  assert.equal(list[2].createdAt, "2026-01-02T03:04:05.000Z");
  assert.ok(list.every((entry) => Array.isArray(entry.config.palette) && entry.config.palette.length >= 1));

  memory.set(FAVORITES_KEY, JSON.stringify(Array.from({ length: 60 }, (_, index) => ({ id: `f${index}`, name: `R${index}`, config: DEFAULT_CONFIG, createdAt: "2026-01-02T03:04:05.000Z", stitches: 1 }))));
  assert.equal(readFavorites()?.length, 24, "au plus 24 recettes");
  useStorage(deniedStorage);
  assert.equal(readFavorites(), null, "stockage inaccessible : illisible, donc protégé");
  useStorage(memoryStorage);
});

// ─── Exports ─────────────────────────────────────────────────────────────────────────────────────

await test("CSV : une cellule texte qui commence par = + - @ tabulation ou retour chariot est neutralisée ; nombres et « + » seul intacts", () => {
  const symbols: Array<[string, string]> = [["=1+1", "'=1+1"], ["-5", "'-5"], ["@SUM", "'@SUM"], ["+", "+"], ["×", "×"], ["=", "="]];
  for (const [symbol, expected] of symbols) {
    const csv = threadCsv(importedWork({ colors: [{ code: "310", symbol, fromLegend: true }, { code: "321", symbol: "▲", fromLegend: true }] }));
    const row = csv.replace(/^\uFEFF/, "").split("\n")[1].split(";");
    assert.equal(row[0], `"${expected}"`, symbol);
    assert.match(row[3], /^"\d+"$/, "les nombres ne sont jamais préfixés");
  }
  const csv = threadCsv(importedWork());
  assert.ok(csv.startsWith("\uFEFF\"Symbole\";"), "BOM UTF-8 et séparateur « ; » conservés pour Excel");
  assert.doesNotMatch(csv, /"'/, "rien à neutraliser dans un ouvrage ordinaire");
});

await test("noms de fichiers : un nom de PDF hostile ne produit ni séparateur, ni point, ni contrôle", () => {
  for (const file of ["../../etc/passwd", "C:\\Windows\\x:y*?.pdf", "\u0000nul.pdf", "😀 émoji.pdf", ".. .pdf", "x".repeat(5000), "<img src=x onerror=1>.pdf"]) {
    const name = safeName(importedWork({ provenance: { file, pages: 1, mode: "auto" } }));
    assert.match(name, /^[a-z0-9àâäéèêëîïôöùûüç-]+$/i, `${file.slice(0, 20)} → ${name}`);
    assert.ok(name.length < 100);
  }
});

interface Popup {
  opener: unknown;
  document: { write: (html: string) => void; close: () => void; querySelector?: (selector: string) => unknown };
  print: () => void;
}
const withWindow = <T>(open: (...args: unknown[]) => unknown, fn: () => T): T => {
  const host = globalThis as unknown as { window?: unknown };
  const previous = host.window;
  host.window = { open };
  try { return fn(); } finally { if (previous === undefined) delete host.window; else host.window = previous; }
};
function popupFor(withQuery: boolean) {
  const seen = { html: "", closed: 0, printed: 0, clicks: [] as Array<() => void> };
  const button = { addEventListener: (type: string, handler: () => void) => { if (type === "click") seen.clicks.push(handler); } };
  const popup: Popup = {
    opener: "fenêtre d'origine",
    document: {
      write: (html) => { seen.html += html; },
      close: () => { seen.closed += 1; },
      ...(withQuery ? { querySelector: (selector: string) => (selector === ".print" ? button : null) } : {}),
    },
    print: () => { seen.printed += 1; },
  };
  return { popup, seen };
}

await test("impression : la fiche n'a plus de gestionnaire inline, le bouton est branché depuis l'ouverture", () => {
  const { popup, seen } = popupFor(true);
  assert.equal(withWindow(() => popup, () => printWorksheet(importedWork())), true);
  assert.equal(popup.opener, null);
  assert.equal(seen.closed, 1);
  assert.match(seen.html, /<button class="print">Imprimer \/ PDF · \d+ pages<\/button>/);
  assert.doesNotMatch(seen.html, /onclick|window\.print/);
  assert.equal(seen.clicks.length, 1);
  seen.clicks[0]();
  assert.equal(seen.printed, 1);
});

await test("impression : fenêtre bloquée → false sans rien écrire ; fiche impossible → exception AVANT window.open (aucun onglet vide orphelin)", () => {
  const blocked = withWindow(() => null, () => printWorksheet(importedWork()));
  assert.equal(blocked, false);
  let opened = 0;
  assert.throws(() => withWindow(() => { opened += 1; return popupFor(true).popup; }, () => printWorksheet(null as never)));
  assert.equal(opened, 0);
  const { popup, seen } = popupFor(false);
  assert.equal(withWindow(() => popup, () => printWorksheet(importedWork())), true, "une fenêtre sans querySelector n'empêche pas l'ouverture");
  assert.match(seen.html, /Imprimer \/ PDF/);
});

await test("téléchargement : l'URL du blob n'est révoquée qu'après 30 s (Safari iOS lit le blob après le clic)", () => {
  const host = globalThis as unknown as { window?: unknown; document?: unknown };
  const saved = { window: host.window, document: host.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const timers: Array<{ delay: number; run: () => void }> = [];
  const revoked: string[] = [];
  const anchor = { href: "", download: "", click() {}, remove() {} };
  try {
    host.window = { setTimeout: (run: () => void, delay: number) => { timers.push({ delay, run }); return timers.length; } };
    host.document = { createElement: () => anchor, body: { appendChild() {} } };
    URL.createObjectURL = () => "blob:test";
    URL.revokeObjectURL = (url: string) => { revoked.push(url); };
    downloadBlob(new Blob(["x"]), "fils.csv");
    assert.equal(anchor.download, "fils.csv");
    assert.deepEqual(revoked, [], "pas de révocation immédiate");
    assert.equal(timers.length, 1);
    assert.ok(timers[0].delay >= 30_000, `${timers[0].delay} ms`);
    timers[0].run();
    assert.deepEqual(revoked, ["blob:test"]);
  } finally {
    URL.createObjectURL = saved.create;
    URL.revokeObjectURL = saved.revoke;
    if (saved.window === undefined) delete host.window; else host.window = saved.window;
    if (saved.document === undefined) delete host.document; else host.document = saved.document;
  }
});

console.log(`\n${checks} tests de robustesse réussis.`);
