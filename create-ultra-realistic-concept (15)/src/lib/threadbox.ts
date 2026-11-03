import { getThread, resolveThreadCode } from "../data/dmc";
import type { StitchWork } from "./work";

/**
 * Ma boîte à fils : les références DMC que la brodeuse possède. Liste locale, par appareil,
 * sans compte. Croisée avec n'importe quel ouvrage, elle dit ce qui manque et combien acheter.
 */
export const THREADBOX_KEY = "aime-rosace-boite-a-fils-v1";

export function readThreadBox(): Set<string> {
  try {
    const raw = localStorage.getItem(THREADBOX_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((code) => resolveThreadCode(code)).filter((code): code is string => code !== null));
  } catch {
    return new Set();
  }
}

export function writeThreadBox(codes: Iterable<string>) {
  const list = [...new Set([...codes].map((code) => resolveThreadCode(code)).filter((code): code is string => code !== null))];
  localStorage.setItem(THREADBOX_KEY, JSON.stringify(list));
  return new Set(list);
}

/** Lit des codes collés en vrac (« 310, 321 3799 ; DMC 677 ») : les codes inconnus sont rendus séparément. */
export function parseThreadCodes(text: string): { codes: string[]; unknown: string[] } {
  const codes: string[] = [];
  const unknown: string[] = [];
  for (const token of text.split(/[\s,;|]+/)) {
    const cleaned = token.replace(/^dmc[:#-]?/i, "").trim();
    if (!cleaned) continue;
    const code = resolveThreadCode(cleaned);
    if (code) { if (!codes.includes(code)) codes.push(code); } else unknown.push(cleaned);
  }
  return { codes, unknown };
}

export interface ShoppingLine {
  code: string;
  name: string;
  hex: string;
  skeins: number;
  stitches: number;
  meters: number;
  owned: boolean;
}

/** Croise un ouvrage et la boîte : ce qu'il faut, ce qu'on a, ce qu'il reste à acheter. */
export function shoppingList(work: StitchWork, box: ReadonlySet<string>): { lines: ShoppingLine[]; owned: number; missing: number; skeinsToBuy: number } {
  const lines = work.usage
    .filter((line) => line.count > 0)
    .map((line) => {
      const thread = getThread(line.code);
      return { code: line.code, name: thread.name, hex: thread.hex, skeins: line.skeins, stitches: line.count, meters: line.meters, owned: box.has(line.code) };
    });
  const missing = lines.filter((line) => !line.owned);
  return {
    lines,
    owned: lines.length - missing.length,
    missing: missing.length,
    skeinsToBuy: missing.reduce((sum, line) => sum + line.skeins, 0),
  };
}

/** CSV « liste de courses » : uniquement les fils manquants, avec le nombre d'échevettes. */
export function shoppingCsv(work: StitchWork, box: ReadonlySet<string>) {
  const { lines } = shoppingList(work, box);
  const rows = [
    ["Référence DMC", "Nom", "Échevettes à acheter", "Croix", "Longueur aiguille (m)"],
    ...lines.filter((line) => !line.owned).map((line) => [line.code, line.name, line.skeins, line.stitches, String(line.meters).replace(".", ",")]),
  ];
  return `﻿${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n")}`;
}
