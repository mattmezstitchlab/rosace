import type { RosacePattern } from "./rosace";

/**
 * Empreinte stable du patron canonique : taille, matrice de cases et codes de fils.
 * Elle ne dépend ni de la toile, ni de l'Aïda, ni du nombre de brins, qui ne modifient
 * pas la grille. La progression est stockée sous cette empreinte, jamais dans le motif.
 */
export function patternFingerprint(pattern: RosacePattern): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const mix = (value: number) => {
    h1 = Math.imul(h1 ^ (value & 0xff), 16777619);
    h2 = Math.imul(h2 ^ ((value >>> 8) & 0xff), 2246822519);
  };
  mix(pattern.size & 0xff);
  mix((pattern.size >>> 8) & 0xff);
  for (let i = 0; i < pattern.cells.length; i += 1) mix(pattern.cells[i] + 2);
  for (const code of pattern.config.palette) {
    for (let i = 0; i < code.length; i += 1) mix(code.charCodeAt(i));
    mix(0xff);
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
  return `${hex(h1)}${hex(h2)}`.toUpperCase();
}

export function shortFingerprint(fingerprint: string) {
  return fingerprint.slice(0, 8);
}
