import type { RosacePattern } from "./rosace";

/**
 * Empreinte stable d'une matrice canonique : dimensions, cases et codes de fils.
 * Elle ne dépend ni de la toile, ni de l'Aïda, ni du nombre de brins, qui ne modifient
 * pas la grille. La progression est stockée sous cette empreinte, jamais dans le motif.
 *
 * Pour une grille carrée (`width === height`), `workFingerprint` rend exactement la valeur
 * historique de `patternFingerprint` : les progressions et projets existants sont préservés.
 * Pour une grille rectangulaire, la hauteur entre aussi dans le calcul, après un séparateur.
 */
export function workFingerprint(width: number, height: number, cells: ArrayLike<number>, codes: readonly string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const mix = (value: number) => {
    h1 = Math.imul(h1 ^ (value & 0xff), 16777619);
    h2 = Math.imul(h2 ^ ((value >>> 8) & 0xff), 2246822519);
  };
  mix(width & 0xff);
  mix((width >>> 8) & 0xff);
  if (height !== width) {
    mix(0xfefe);
    mix(height & 0xff);
    mix((height >>> 8) & 0xff);
  }
  for (let i = 0; i < cells.length; i += 1) mix(cells[i] + 2);
  for (const code of codes) {
    for (let i = 0; i < code.length; i += 1) mix(code.charCodeAt(i));
    mix(0xff);
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
  return `${hex(h1)}${hex(h2)}`.toUpperCase();
}

/** Empreinte d'une rosace générée : cas carré de `workFingerprint`, valeur inchangée. */
export function patternFingerprint(pattern: RosacePattern): string {
  return workFingerprint(pattern.size, pattern.size, pattern.cells, pattern.config.palette);
}

export function shortFingerprint(fingerprint: string) {
  return fingerprint.slice(0, 8);
}
