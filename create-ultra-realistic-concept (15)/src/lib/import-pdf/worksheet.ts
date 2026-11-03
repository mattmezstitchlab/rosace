import { WORKSHEET_MARK } from "../exporters";
import { fromRosace } from "../work";
import { decodeConfig, generateRosace, type RosaceConfig } from "../rosace";
import type { PdfHandle } from "./pdfimport";

/**
 * Réimport exact d'une fiche ROSACE.
 *
 * La couverture imprimée par `printWorksheet` porte, en texte, `ROSACE-FICHE <empreinte> r=<recette>`.
 * Si ce texte est présent dans le PDF, la recette est régénérée et son empreinte comparée à celle
 * imprimée : en cas d'égalité, la rosace est retrouvée à l'identique, sans lecture d'image.
 * Sinon on dit pourquoi, et le puzzle ordinaire prend le relais.
 */
export type WorksheetReading =
  | { kind: "rosace"; config: RosaceConfig; fingerprint: string; page: number }
  | { kind: "mismatch"; printed: string; regenerated: string; page: number }
  | { kind: "none" };

export async function readRosaceWorksheet(handle: PdfHandle): Promise<WorksheetReading> {
  const pattern = new RegExp(`${WORKSHEET_MARK}\\s*([0-9A-F]{16})\\s*r=([A-Za-z0-9_-]+)`);
  for (let n = 1; n <= Math.min(handle.pages, 3); n += 1) {
    const items = await handle.text(n, 1000);
    // pdf.js peut couper le marqueur en plusieurs éléments : on recolle le texte de la page.
    const joined = items.map((item) => item.str).join(" ").replace(/\s+/g, " ");
    const compact = items.map((item) => item.str).join("");
    const match = pattern.exec(joined) ?? pattern.exec(compact);
    if (!match) continue;
    const printed = match[1];
    const config = decodeConfig(match[2]);
    if (!config) continue;
    const regenerated = fromRosace(generateRosace(config)).fingerprint;
    if (regenerated === printed) return { kind: "rosace", config, fingerprint: printed, page: n };
    return { kind: "mismatch", printed, regenerated, page: n };
  }
  return { kind: "none" };
}
