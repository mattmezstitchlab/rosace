/**
 * Apparence Auto / Jour / Nuit, identique à ATLAS : même clé de stockage, mêmes attributs
 * (data-theme = choix, data-mode = jour | nuit). Le choix fait dans ATLAS vaut donc pour ROSACE.
 */
export type ThemeChoice = "auto" | "jour" | "nuit";

const KEY = "atlas-theme";
const CHOICES: ThemeChoice[] = ["auto", "jour", "nuit"];

export const THEME_LABELS: Record<ThemeChoice, string> = { auto: "Auto", jour: "Jour", nuit: "Nuit" };
export const THEME_ORDER = CHOICES;

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && (CHOICES as string[]).includes(stored)) return stored as ThemeChoice;
  } catch { /* le choix vaut pour la séance */ }
  return "auto";
}

export function applyTheme(choice: ThemeChoice) {
  const html = document.documentElement;
  const dark = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)").matches : false;
  html.setAttribute("data-theme", choice);
  html.setAttribute("data-mode", choice === "nuit" || (choice === "auto" && dark) ? "nuit" : "jour");
}

export function saveThemeChoice(choice: ThemeChoice) {
  try { localStorage.setItem(KEY, choice); } catch { /* le choix vaut pour la séance */ }
  applyTheme(choice);
}

export function initTheme() {
  applyTheme(readThemeChoice());
  if (typeof matchMedia === "function") {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(readThemeChoice()));
  }
}
