/**
 * Génère LICENSES.md à partir du lockfile et des métadonnées réellement installées.
 * Aucune licence n'est déduite : les champs absents restent « non déclarée ».
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
const entries = [];

for (const [location, meta] of Object.entries(lock.packages ?? {})) {
  if (!location.startsWith("node_modules/")) continue;
  const packageJsonPath = path.join(root, location, "package.json");
  let installed = {};
  if (existsSync(packageJsonPath)) {
    try { installed = JSON.parse(readFileSync(packageJsonPath, "utf8")); } catch { /* métadonnées illisibles */ }
  }
  const name = meta.name ?? installed.name ?? location.replace(/^.*node_modules\//, "");
  const version = meta.version ?? installed.version ?? "?";
  const license = meta.license ?? installed.license ?? (Array.isArray(installed.licenses) ? installed.licenses.map((item) => item.type).join("/") : null) ?? "non déclarée";
  entries.push({ name, version, license: String(license), dev: Boolean(meta.dev ?? installed.dev) });
}

entries.sort((a, b) => a.name.localeCompare(b.name, "fr"));
const groups = new Map();
for (const entry of entries) {
  if (!groups.has(entry.license)) groups.set(entry.license, []);
  groups.get(entry.license).push(entry);
}

const lines = [
  "# Inventaire des licences — dépendances, polices et données",
  "",
  "Généré par `npm run licenses` depuis `package-lock.json` et les `package.json` installés.",
  `Date de génération : ${new Date().toISOString()}`,
  "",
  "## Application",
  "",
  "**Aucune licence de code n'est attribuée à ce stade.** Le choix doit être fait explicitement par le propriétaire du dépôt ; voir `NOTICE.md` et le rapport final.",
  "",
  "## Données et polices",
  "",
  "| Élément | Origine | Licence |",
  "|---|---|---|",
  "| 489 références DMC | MakeBead `craft-color-codes`, `data/json/dmc-floss.json` | CC BY 4.0 |",
  "| Bodoni Moda | `@fontsource/bodoni-moda` | SIL Open Font License 1.1 |",
  "",
  "## Dépendances npm",
  "",
  `Total : ${entries.length} paquets installés (directs et transitifs). Les textes complets se trouvent dans chaque dossier \`node_modules/<paquet>/LICENSE*\`.`,
  "",
  "| Paquet | Version | Licence | Dev |",
  "|---|---|---|---|",
];

for (const entry of entries) {
  lines.push(`| \`${entry.name}\` | ${entry.version} | ${entry.license} | ${entry.dev ? "oui" : "non"} |`);
}

lines.push("", "## Répartition", "");
for (const [license, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`- **${license}** : ${items.length} paquet(s)`);
}
lines.push("");

writeFileSync(path.join(root, "LICENSES.md"), lines.join("\n"));
console.log(`LICENSES.md généré : ${entries.length} paquets, ${groups.size} licences distinctes.`);
