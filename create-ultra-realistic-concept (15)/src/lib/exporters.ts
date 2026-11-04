import { getThread } from "../data/dmc";
import { paintPattern } from "./paint";
import { chartRegions, type ChartRegion } from "./chart";
import { shortFingerprint } from "./pattern-id";
import { FABRIC_COLORS, encodeConfig, formatDuration, getPatternName, type RosacePattern } from "./rosace";
import { toWork, type StitchWork } from "./work";

type WorkLike = RosacePattern | StitchWork;

/** Nom de fichier : signature pour une rosace, nom du PDF pour un ouvrage importé. */
export function safeName(source: WorkLike) {
  const work = toWork(source);
  if (work.origin.kind === "rosace") return `rosace-${String(work.origin.config.seed).padStart(3, "0")}-${shortFingerprint(work.fingerprint)}`;
  if (work.origin.kind === "text") return `rosace-texte-${shortFingerprint(work.fingerprint)}`;
  if (work.origin.kind === "photo") return `rosace-photo-${shortFingerprint(work.fingerprint)}`;
  const base = work.origin.provenance.file.replace(/\.pdf$/i, "").replace(/[^a-z0-9àâäéèêëîïôöùûüç-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "patron";
  return `rosace-import-${base}-${shortFingerprint(work.fingerprint)}`;
}

/** Titre lisible d'un ouvrage, pour les fiches et les descriptions. */
export function workTitle(source: WorkLike) {
  const work = toWork(source);
  if (work.origin.kind === "rosace") return `Rosace n° ${work.origin.config.seed}`;
  if (work.origin.kind === "text") return `Texte « ${work.origin.text ?? work.origin.provenance.title ?? ""} »`;
  if (work.origin.kind === "photo") return `Photo ${work.origin.provenance.title ?? work.origin.provenance.file}`;
  return work.origin.provenance.title || work.origin.provenance.file.replace(/\.pdf$/i, "") || "Patron importé";
}

function workSubtitle(work: StitchWork) {
  if (work.origin.kind === "rosace") return getPatternName(work.origin.config);
  if (work.origin.kind === "text") return `Texte brodé · police 5 × 7 · ${work.palette.length} fil${work.palette.length > 1 ? "s" : ""}`;
  if (work.origin.kind === "photo") return `Photo convertie · ${work.palette.length} fil${work.palette.length > 1 ? "s" : ""} DMC, couleurs estimées`;
  const { provenance } = work.origin;
  return `Patron importé · ${provenance.pages} page${provenance.pages > 1 ? "s" : ""} · lecture ${provenance.mode}`;
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function withoutXmlDeclaration(svg: string) {
  return svg.replace(/^<\?xml[^>]*>\s*/, "");
}

function chartInk(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  if (luminance <= 160) return hex;
  const amount = luminance > 205 ? 0.72 : 0.42;
  const channel = (v: number) => Math.round(v * (1 - amount)).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Rendu SVG. `region` est un rectangle de la grille, pas un carré : la découpe PDF
 * couvre ainsi exactement toutes les cases, y compris sur les grilles impaires.
 */
export function patternToSvg(source: WorkLike, chart = false, region?: ChartRegion) {
  const pattern = toWork(source);
  const regionX = region?.x ?? 0;
  const regionY = region?.y ?? 0;
  const width = region?.width ?? pattern.width;
  const height = region?.height ?? pattern.height;
  const cell = 12;
  const margin = chart ? 36 : 24;
  const sideW = width * cell + margin * 2;
  const sideH = height * cell + margin * 2;
  const palette = pattern.palette.map((entry) => entry.code);
  const stitches = pattern.stitches.filter((stitch) => stitch.x >= regionX && stitch.x < regionX + width && stitch.y >= regionY && stitch.y < regionY + height);
  const paths = palette.map(() => ({ under: [] as string[], over: [] as string[] }));
  const symbols = palette.map(() => [] as string[]);
  stitches.forEach((stitch) => {
    const x = margin + (stitch.x - regionX) * cell;
    const y = margin + (stitch.y - regionY) * cell;
    if (chart) symbols[stitch.color].push(`<text x="${x}" y="${y + 0.5}">${xml(pattern.palette[stitch.color].symbol)}</text>`);
    else {
      const radius = cell * 0.36;
      paths[stitch.color].under.push(`M${x - radius},${y - radius}L${x + radius},${y + radius}`);
      paths[stitch.color].over.push(`M${x - radius},${y + radius}L${x + radius},${y - radius}`);
    }
  });

  let grid = "";
  let coordinates = "";
  if (chart) {
    const major: string[] = [];
    const labels: string[] = [];
    const startX = margin - cell / 2;
    const startY = margin - cell / 2;
    const endX = startX + width * cell;
    const endY = startY + height * cell;
    for (let i = 0; i <= width; i += 10) {
      const position = startX + i * cell;
      major.push(`M${position},${startY}V${endY}`);
    }
    for (let i = 0; i <= height; i += 10) {
      const position = startY + i * cell;
      major.push(`M${startX},${position}H${endX}`);
    }
    for (let i = 0; i < width; i += 10) labels.push(`<text x="${margin + i * cell}" y="${margin - 17}">${regionX + i + 1}</text>`);
    for (let i = 0; i < height; i += 10) labels.push(`<text x="${margin - 19}" y="${margin + i * cell + 2}">${regionY + i + 1}</text>`);
    grid = `<defs><pattern id="smallGrid" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><path d="M${cell} 0L0 0 0 ${cell}" fill="none" stroke="#6f5966" stroke-opacity=".17" stroke-width=".65"/></pattern></defs><rect x="${startX}" y="${startY}" width="${width * cell}" height="${height * cell}" fill="url(#smallGrid)"/><path d="${major.join("")}" fill="none" stroke="#6f5966" stroke-opacity=".48" stroke-width="1.1"/>`;
    coordinates = `<g fill="#766c72" font-family="Arial,sans-serif" font-size="7" text-anchor="middle">${labels.join("")}</g>`;
  } else {
    grid = `<defs><pattern id="weave" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><path d="M0 0V${cell}M0 0H${cell}" stroke="${FABRIC_COLORS[pattern.textile.fabric].warp}" stroke-opacity=".18" stroke-width=".8"/><path d="M1 0V${cell}M0 1H${cell}" stroke="#fff" stroke-opacity=".3" stroke-width=".6"/></pattern></defs><rect width="100%" height="100%" fill="url(#weave)"/>`;
  }

  const artwork = chart
    ? symbols.map((entries, index) => `<g fill="${chartInk(getThread(palette[index]).hex)}" font-family="Arial,sans-serif" font-size="10.5" font-weight="600" text-anchor="middle" dominant-baseline="central">${entries.join("")}</g>`).join("")
    : paths.map((path, index) => `<g fill="none" stroke="${getThread(palette[index]).hex}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${path.under.join("")}"/><path d="${path.over.join("")}"/></g>`).join("");
  const regionCopy = region ? ` Planche colonnes ${region.x + 1}–${region.x + region.width}, lignes ${region.y + 1}–${region.y + region.height}.` : "";
  const description = `${pattern.stitches.length} croix. ${workSubtitle(pattern)}. Fils ${palette.map((code) => `DMC ${code}`).join(", ")}.${regionCopy}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${sideW}" height="${sideH}" viewBox="0 0 ${sideW} ${sideH}">
<title>${xml(`${workTitle(pattern)} · empreinte ${pattern.fingerprint}`)}</title><desc>${xml(description)}</desc>
<rect width="100%" height="100%" fill="${chart ? "#fffefa" : FABRIC_COLORS[pattern.textile.fabric].base}"/>${grid}${coordinates}${artwork}
<metadata>Symboles et géométrie calculés par ROSACE. Couleurs écran indicatives ; références DMC Mouliné. Color data: craft-color-codes by MakeBead, https://makebead.com — CC BY 4.0.</metadata></svg>`;
}

export function exportSvg(pattern: WorkLike, chart: boolean) {
  const blob = new Blob([patternToSvg(pattern, chart)], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, `${safeName(pattern)}-${chart ? "grille" : "motif"}.svg`);
}

export function exportPng(pattern: WorkLike, chart: boolean) {
  return new Promise<void>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    paintPattern(canvas, pattern, chart ? "chart" : "fabric", 1600);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("L'image n'a pas pu être créée."));
        return;
      }
      downloadBlob(blob, `${safeName(pattern)}-${chart ? "grille" : "toile"}.png`);
      resolve();
    }, "image/png");
  });
}

export function exportThreadCsv(source: WorkLike) {
  const pattern = toWork(source);
  const rows = [
    ["Symbole", "Référence DMC", "Nom", "Croix", "Longueur de brins (m)", `Longueur aiguille ${pattern.textile.strands} brins (m)`, "Échevettes commerciales"],
    ...pattern.usage.filter((usage) => usage.count > 0).map((usage) => [
      usage.symbol,
      usage.code,
      getThread(usage.code).name,
      usage.count,
      String(usage.strandMeters).replace(".", ","),
      String(usage.meters).replace(".", ","),
      usage.skeins,
    ]),
    ["Total", "", "Toutes références", pattern.stitches.length, String(pattern.totalStrandMeters).replace(".", ","), String(pattern.totalNeedleMeters).replace(".", ","), pattern.totalSkeins],
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n")}`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${safeName(pattern)}-fils.csv`);
}

/** Marqueur imprimé sur la couverture d'une fiche ROSACE : il permet de réimporter la fiche sans lire l'image. */
export const WORKSHEET_MARK = "ROSACE-FICHE";
export const WORKSHEET_END = "FIN-FICHE";

/** La fiche imprimable complète (couverture + planches), comme chaîne HTML : sert à l'impression et aux tests. */
export function worksheetHtml(source: WorkLike): string {
  const pattern = toWork(source);
  const fingerprint = pattern.fingerprint;
  const rows = pattern.usage.filter((usage) => usage.count > 0).map((usage) => {
    const thread = getThread(usage.code);
    return `<tr><td class="symbol">${usage.symbol}</td><td><span class="color" style="background:${thread.hex}"></span></td><td><strong>${usage.code}</strong><br><small>${thread.name}</small></td><td>${usage.count.toLocaleString("fr-FR")}</td><td>${String(usage.strandMeters).replace(".", ",")} m</td><td>${String(usage.meters).replace(".", ",")} m</td><td>${usage.skeins}</td></tr>`;
  }).join("");
  const regions = chartRegions(pattern.width, pattern.height);
  const tiles = regions.map((region, index) => `<section class="tile-page"><div class="tile-head"><div><span>ROSACE · ${fingerprint.slice(0, 8)}</span><h1>Patron · planche ${index + 1} / ${regions.length}</h1></div><div><strong>Colonnes ${region.x + 1}–${region.x + region.width}</strong><br>Lignes ${region.y + 1}–${region.y + region.height}<br>${region.width} × ${region.height} cases</div></div><div class="chart">${withoutXmlDeclaration(patternToSvg(pattern, true, region))}</div><p class="tile-note">1 case = 1 croix · Repères lourds toutes les 10 cases · Cette planche couvre exactement ses colonnes et lignes, sans recouvrement.</p></section>`).join("");
  const preview = withoutXmlDeclaration(patternToSvg(pattern, false));
  const pageCount = 1 + regions.length;
  const textile = pattern.textile;
  const recipeBlock = pattern.origin.kind === "rosace"
    ? `<div class="print-hint"><strong>Recette exacte</strong><br>Empreinte ${fingerprint}<br><span class="recette-code">${WORKSHEET_MARK} ${fingerprint} r=${encodeConfig(pattern.origin.config).replace(/(.{36})/g, "$1 ")} ${WORKSHEET_END}</span><br>Structure ${pattern.origin.config.structure} · Tracé ${pattern.origin.config.trace} · Densité ${pattern.origin.config.density} · Échelle ${pattern.origin.config.scale} · Géométrie ${pattern.origin.config.geometry} · Tourbillon ${pattern.origin.config.twist} · Ondulation ${pattern.origin.config.wave}<br>Toile ${textile.fabric} · Aïda ${textile.aida} · ${textile.strands} brins · marge ${textile.wastePercent} %</div>`
    : `<div class="print-hint"><strong>Provenance</strong><br>Empreinte ${fingerprint}<br>Fichier ${xml(pattern.origin.provenance.file)} · ${pattern.origin.provenance.pages} page(s) · lecture ${pattern.origin.provenance.mode}${pattern.origin.provenance.author ? ` · ${xml(pattern.origin.provenance.author)}` : ""}<br>Montage : ${pattern.origin.montage.tiles.length} carte(s), ${pattern.origin.montage.overlaps} recouvrement(s), ${pattern.origin.montage.holes} case(s) non couverte(s)${pattern.origin.montage.scaled ? " · grille réduite pour l'atelier" : ""}<br>Toile ${textile.fabric} · Aïda ${textile.aida} · ${textile.strands} brins · marge ${textile.wastePercent} %</div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche ${xml(workTitle(pattern))}</title><style>
  @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#241f22;margin:0;font-size:11px}header,.tile-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #bbb;padding-bottom:12px}h1{font-family:Georgia,serif;font-weight:400;font-size:29px;margin:4px 0}h2{font-size:12px;text-transform:uppercase;letter-spacing:1.3px;margin:16px 0 9px}.meta,.tile-head>div:last-child{text-align:right;line-height:1.65}.cover{display:grid;grid-template-columns:.78fr 1.22fr;gap:10mm;margin-top:15px}.preview svg,.chart svg{display:block;width:100%;height:auto}.preview{border:1px solid #ddd}.notes{line-height:1.6;color:#5f565b}table{border-collapse:collapse;width:100%}td,th{padding:5px 4px;border-bottom:1px solid #e5e0dc;text-align:left}th{font-size:8px;text-transform:uppercase;letter-spacing:.5px}.symbol{font-size:17px}.color{display:block;width:17px;height:17px;border-radius:50%;border:1px solid #ddd}.print{position:fixed;right:20px;bottom:20px;background:#693c60;color:white;border:0;border-radius:30px;padding:13px 20px;cursor:pointer}.tile-page{break-before:page;page-break-before:always}.tile-head h1{font-size:24px}.tile-head span{font-size:8px;letter-spacing:1px}.tile-page .chart{margin-top:12px}.tile-note{font-size:8px;color:#6f6269;text-align:center}.print-hint{margin-top:14px;padding:9px;border:1px solid #ddd;line-height:1.5}.recette-code{display:block;font-family:monospace;font-size:6px;line-height:1.5;word-break:break-word;color:#8a7f86}@media print{.print{display:none}.cover{grid-template-columns:.78fr 1.22fr}header{padding-bottom:8px}h2{margin-top:10px}td,th{padding:4px 3px}}
  </style></head><body><button class="print" onclick="window.print()">Imprimer / PDF · ${pageCount} pages</button><section><header><div><div>ROSACE · ATELIER</div><h1>${xml(workTitle(pattern))}</h1><div>${xml(workSubtitle(pattern))}</div></div><div class="meta"><strong>${pattern.stitches.length} croix</strong><br>${pattern.width} × ${pattern.height} points<br>Aïda ${textile.aida} · ${FABRIC_COLORS[textile.fabric].name}<br>Motif ${String(pattern.motifWidthCm).replace(".", ",")} × ${String(pattern.motifHeightCm).replace(".", ",")} cm<br>2 brins par défaut · ${textile.strands} brins choisis<br>Empreinte ${fingerprint}</div></header><div class="cover"><div><h2>Aperçu du motif</h2><div class="preview">${preview}</div><p class="notes">Le patron est divisé en ${regions.length} planches rectangulaires qui couvrent exactement la grille. Chaque planche reprend les coordonnées du motif complet.</p></div><div><h2>Fils et fournitures</h2><table><thead><tr><th>Symb.</th><th>Fil</th><th>DMC</th><th>Croix</th><th>Brins</th><th>Aiguille</th><th>Éch.</th></tr></thead><tbody>${rows}</tbody></table><h2>Hypothèses textiles</h2><p class="notes">Métrage « brins » = somme des brins individuels, marge ${textile.wastePercent} %. Métrage « aiguille » = longueur du faisceau enfilé. Une échevette DMC Mouliné = 8 m à 6 brins (48 m de brins). Base de calcul 2,5 cm par croix pour 2 brins sur Aïda 14, ajustée au comptage Aïda et au nombre de brins. Estimation, non mesure : la tension et les arrêts varient.</p><p class="notes">Temps indicatif ${formatDuration(pattern.minutes)} (${pattern.timeEstimate.assumedRate}). Couleurs écran approximatives, vérifier les échevettes à la lumière naturelle. Color data: craft-color-codes by MakeBead, https://makebead.com — CC BY 4.0.</p>${recipeBlock}</div></div></section>${tiles}</body></html>`;
}

export function printWorksheet(source: WorkLike) {
  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.write(worksheetHtml(source));
  printWindow.document.close();
  return true;
}
