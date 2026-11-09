import assert from "node:assert/strict";
import {
  LIVE_COLORS, LIVE_NAME_MAX, displayNames, newClientId, parseLiveMessage, pickPeerColor, sanitizeName, sanitizeRoom,
} from "../src/lib/live";
import { serializeRuns } from "../src/lib/progress";

/**
 * Session live « Broder ensemble » : tout message reçu d'un autre onglet est non fiable.
 * Ces tests verrouillent la validation (aucun message hostile ne doit bloquer, tromper ou saturer la page)
 * et la normalisation des codes de salle et des noms.
 */
let checks = 0;
function test(name: string, fn: () => void) {
  try { fn(); } catch (error) { console.error(`not ok — ${name}`); throw error; }
  checks += 1;
  console.log(`ok ${checks} — ${name}`);
}

const GRID = { width: 20, height: 10 };
const SELF = "0b0b0b0b-self-self";
const OTHER = "a1b2c3d4-e5f6-4789-abcd-0123456789ab";
const state = (extra: Record<string, unknown> = {}) => ({
  kind: "state", sender: OTHER, name: "Alice", cursor: { x: 3, y: 4 }, completedRuns: serializeRuns([0, 1, 2, 40]), ...extra,
});

test("codes de salle : accents, majuscules et symboles sont normalisés ; jamais vide", () => {
  assert.equal(sanitizeRoom("été"), "ete");
  assert.equal(sanitizeRoom("  Ma Salle !! "), "ma-salle");
  assert.equal(sanitizeRoom("Éléonore_2"), "eleonore-2");
  assert.equal(sanitizeRoom("ABC123"), "abc123");
  assert.equal(sanitizeRoom(""), "atelier");
  assert.equal(sanitizeRoom("---"), "atelier");
  assert.equal(sanitizeRoom("日本語"), "atelier", "aucun caractère exploitable : code par défaut");
  const long = sanitizeRoom(`${"a".repeat(31)}-${"b".repeat(10)}`);
  assert.ok(long.length <= 32 && !long.endsWith("-"), long);
  // Deux brodeuses qui tapent « Été » et « ete » doivent atterrir dans la même salle.
  assert.equal(sanitizeRoom("Été"), sanitizeRoom("ete"));
});

test("noms : caractères de contrôle et inversions de lecture retirés, 24 caractères au plus (émojis entiers)", () => {
  assert.equal(sanitizeName("  Alice  "), "Alice");
  assert.equal(sanitizeName("Al\u202Eice\u200b"), "Alice", "surcharges de sens d'écriture et espaces invisibles");
  assert.equal(sanitizeName("a\u0000b\u001fc"), "abc");
  assert.equal(sanitizeName("   "), "Brodeuse");
  assert.equal(sanitizeName(undefined), "Brodeuse");
  assert.equal(sanitizeName(42), "Brodeuse");
  assert.equal(sanitizeName(null, "Moi"), "Moi");
  const emojis = sanitizeName("🧵".repeat(40));
  assert.equal([...emojis].length, LIVE_NAME_MAX);
  assert.ok(!emojis.includes("\ufffd"), "aucun émoji coupé en deux");
  assert.equal(sanitizeName("a    b\n\tc"), "a b c", "espaces et retours à la ligne réduits");
});

test("identifiants : uniques par page et conformes au format accepté par le récepteur", () => {
  const ids = new Set(Array.from({ length: 200 }, () => newClientId()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.ok(/^[A-Za-z0-9-]{8,64}$/.test(id), id);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
  try {
    const fallback = newClientId();
    assert.ok(/^[A-Za-z0-9-]{8,64}$/.test(fallback), `repli sans crypto : ${fallback}`);
    assert.notEqual(fallback, newClientId());
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor); else Reflect.deleteProperty(globalThis, "crypto");
  }
});

test("message valide : curseur, nom et croix repris tels quels", () => {
  const message = parseLiveMessage(state(), SELF, GRID);
  assert.ok(message && message.kind === "state");
  if (!message || message.kind !== "state") return;
  assert.equal(message.sender, OTHER);
  assert.equal(message.name, "Alice");
  assert.deepEqual(message.cursor, { x: 3, y: 4 });
  assert.deepEqual([...message.completed].sort((a, b) => a - b), [0, 1, 2, 40]);
  assert.deepEqual(parseLiveMessage({ kind: "leave", sender: OTHER }, SELF, GRID), { kind: "leave", sender: OTHER });
});

test("ses propres messages et tout ce qui n'est pas un objet attendu sont ignorés", () => {
  assert.equal(parseLiveMessage(state({ sender: SELF }), SELF, GRID), null, "un onglet ne se voit pas lui-même");
  for (const junk of [null, undefined, 0, 7, "state", true, [], [state()], () => state()]) assert.equal(parseLiveMessage(junk, SELF, GRID), null);
  assert.equal(parseLiveMessage({ kind: "ping", sender: OTHER }, SELF, GRID), null);
  assert.equal(parseLiveMessage({ sender: OTHER }, SELF, GRID), null);
  assert.equal(parseLiveMessage(state({ kind: "STATE" }), SELF, GRID), null);
});

test("expéditeur : seul un identifiant sobre est accepté (pas de clé piégée, pas d'espace, pas de très long)", () => {
  for (const sender of ["__proto__", "constructor", "toString", "hasOwnProperty", "short", "a b c d e f g h", "é".repeat(12), "x".repeat(65), 12345678, null, { toString: () => OTHER }]) {
    assert.equal(parseLiveMessage(state({ sender }), SELF, GRID), null, String(sender));
  }
  assert.ok(parseLiveMessage(state({ sender: "x".repeat(64) }), SELF, GRID));
});

test("curseur : entier et dans la grille, sinon ignoré sans rejeter le reste du message", () => {
  const bad: unknown[] = [
    { x: -1, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 10 }, { x: 1.5, y: 2 }, { x: NaN, y: 0 }, { x: Infinity, y: 0 },
    { x: "3", y: "4" }, { x: 1 }, [3, 4], "3,4", 7, {},
  ];
  for (const cursor of bad) {
    const message = parseLiveMessage(state({ cursor }), SELF, GRID);
    assert.ok(message && message.kind === "state", JSON.stringify(cursor));
    if (message && message.kind === "state") assert.equal(message.cursor, null, JSON.stringify(cursor));
  }
  const corner = parseLiveMessage(state({ cursor: { x: 19, y: 9 } }), SELF, GRID);
  assert.deepEqual(corner && corner.kind === "state" ? corner.cursor : "absent", { x: 19, y: 9 });
});

test("croix : plages hostiles bornées à la grille et traitées en temps borné", () => {
  const started = performance.now();
  const cells = GRID.width * GRID.height;
  const hostile = ["1e21", "0-99999999999", "0-1e9", "-5", "NaN", "0-", "9007199254740993", "1,,,2", "a-b", "0-0-0", "\u0000", "5-3"];
  for (const completedRuns of hostile) {
    const message = parseLiveMessage(state({ completedRuns }), SELF, GRID);
    assert.ok(message && message.kind === "state", completedRuns);
    if (!message || message.kind !== "state") continue;
    assert.ok(message.completed.size <= cells, `${completedRuns} → ${message.completed.size} croix`);
    for (const index of message.completed) assert.ok(Number.isInteger(index) && index >= 0 && index < cells, `${completedRuns} → ${index}`);
  }
  const tooLong = "0,".repeat(GRID.width * GRID.height * 8 + 100);
  const clipped = parseLiveMessage(state({ completedRuns: tooLong }), SELF, GRID);
  assert.ok(clipped && clipped.kind === "state" && clipped.completed.size === 0, "chaîne démesurée : écartée sans être lue");
  for (const completedRuns of [null, 12, {}, ["0"]]) {
    const message = parseLiveMessage(state({ completedRuns }), SELF, GRID);
    assert.ok(message && message.kind === "state" && message.completed.size === 0, JSON.stringify(completedRuns));
  }
  assert.ok(performance.now() - started < 1500, "aucune plage hostile ne doit bloquer la page");
});

test("nom reçu : nettoyé, tronqué, jamais interprété ; la couleur annoncée par l'expéditeur est ignorée", () => {
  const message = parseLiveMessage(state({ name: `<img src=x onerror=alert(1)>${"é".repeat(40)}`, color: "red;background:url(//evil)" }), SELF, GRID);
  assert.ok(message && message.kind === "state");
  if (!message || message.kind !== "state") return;
  assert.ok([...message.name].length <= LIVE_NAME_MAX);
  assert.ok(!("color" in message), "la couleur est attribuée localement");
  const unnamed = parseLiveMessage(state({ name: 12 }), SELF, GRID);
  assert.ok(unnamed && unnamed.kind === "state");
  if (unnamed && unnamed.kind === "state") assert.equal(unnamed.name, "Brodeuse");
});

test("couleurs : première libre, puis repli stable ; chaque couleur porte une étiquette blanche lisible", () => {
  assert.equal(pickPeerColor([], OTHER), LIVE_COLORS[0]);
  assert.equal(pickPeerColor([LIVE_COLORS[0]], OTHER), LIVE_COLORS[1]);
  assert.equal(pickPeerColor([LIVE_COLORS[0], LIVE_COLORS[2]], OTHER), LIVE_COLORS[1]);
  const full = pickPeerColor(LIVE_COLORS, OTHER);
  assert.ok(LIVE_COLORS.includes(full));
  assert.equal(pickPeerColor(LIVE_COLORS, OTHER), full, "stable pour un même identifiant");
  const linear = (channel: number) => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  for (const color of LIVE_COLORS) {
    const value = Number.parseInt(color.slice(1), 16);
    const luminance = 0.2126 * linear((value >> 16) & 255) + 0.7152 * linear((value >> 8) & 255) + 0.0722 * linear(value & 255);
    assert.ok(1.05 / (luminance + 0.05) >= 4.5, `${color} : texte blanc illisible`);
  }
});

test("noms affichés : deux brodeuses (ou vous) du même nom restent distinguables", () => {
  const peers = [{ id: "aaa111", name: "Alice" }, { id: "bbb222", name: "alice" }, { id: "ccc333", name: "Bruno" }];
  const labels = displayNames(peers, "Camille");
  assert.equal(labels.ccc333, "Bruno");
  assert.notEqual(labels.aaa111, labels.bbb222);
  assert.ok(labels.aaa111.startsWith("Alice") && labels.bbb222.startsWith("alice"));
  assert.notEqual(displayNames([{ id: "aaa111", name: "Camille" }], "Camille").aaa111, "Camille", "même nom que le vôtre");
  assert.equal(displayNames([{ id: "aaa111", name: "Alice" }], "Camille").aaa111, "Alice");
});

console.log(`\n${checks} tests de session live réussis.`);
