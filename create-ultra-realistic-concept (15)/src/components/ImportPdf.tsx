import { ArrowLeft, ArrowRight, Check, FileUp, Grid3x3, Magnet, Minus, Plus, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { getThread } from "../data/dmc";
import { FLOSS, flossIndex } from "../lib/import-pdf/floss";
import { closestDmcAlternatives, flossCellsFromVector, gridFromFlossCells, remapGridPalette } from "../lib/import-pdf/grid";
import { assembleTiles, positionsPuzzle, snapPosition, tilesOverlap, uniformDimensions, type Tile, type TilePlacement } from "../lib/import-pdf/montage";
import {
  SymbolRegistry, analyzePdf, convertBlockAuto, convertBlockColor,
  type PdfAnalysis, type PdfBlock,
} from "../lib/import-pdf/pdfAnalysis";
import { readCompleteGlyphChart, type CompleteGlyphChart } from "../lib/import-pdf/pdfGlyphChart";
import type { PdfHandle } from "../lib/import-pdf/pdfimport";
import { readVectorChart, type VectorResult } from "../lib/import-pdf/pdfVector";
import { paintPattern } from "../lib/paint";
import { fromImport, type ImportLosses, type ImportedGrid, type StitchWork } from "../lib/work";
import { prefersReducedMotion, useRosaceApi } from "../state/rosace-store";

/**
 * Importer un patron PDF : Analyser · Caler · Assembler · Vérifier · Utiliser.
 *
 * Le moteur est celui de Point Zéro (src/lib/import-pdf/, voir PROVENANCE.md) ; cette vue
 * le réhabille aux jetons ROSACE et ajoute l'étape Vérifier : rien d'approximatif n'est
 * présenté comme exact, et l'ouvrage actif n'est touché qu'au bouton « Utiliser ».
 */
const STAGES = ["Analyser", "Caler", "Assembler", "Vérifier"] as const;
type Mode = "vecteur" | "auto" | "photo";

interface CachedBlock { cells: Int16Array; cols: number; rows: number; byColor: number; byLegend: number; unresolved: number }
interface Montage {
  assembly: ReturnType<typeof assembleTiles>;
  source: "glyphes" | "vectoriel" | "auto" | "photo";
  legendCodes: Set<string>;
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const keyOf = (b: PdfBlock, mode: Mode, colors: number) =>
  `${mode}|${colors}|${b.id}|${b.page}|${b.x0.toFixed(2)},${b.y0.toFixed(2)},${b.x1.toFixed(2)},${b.y1.toFixed(2)}|${b.cols}x${b.rows}`;
const clampInt = (raw: string | number, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const autoOrder = (blocks: PdfBlock[]) => [...blocks].sort((a, b) => a.page - b.page || a.y0 - b.y0 || a.x0 - b.x0);
const KIND_LABEL: Record<string, string> = { chart: "Grille", legend: "Légende", cover: "Couverture", other: "Autre" };

/** « 193 x 200 », « 120 × 80 stitches » : la dimension annoncée dans le texte du PDF, si elle existe. */
async function declaredSizeFromText(handle: PdfHandle): Promise<{ w: number; h: number } | null> {
  for (let n = 1; n <= handle.pages; n += 1) {
    const items = await handle.text(n, 1000);
    const text = items.map((item) => item.str).join(" ");
    for (const match of text.matchAll(/(\d{2,4})\s*[x×X]\s*(\d{2,4})/g)) {
      const w = Number(match[1]);
      const h = Number(match[2]);
      if (w >= 10 && h >= 10 && w <= 1000 && h <= 1000) return { w, h };
    }
  }
  return null;
}

export function ImportPdf() {
  const { importOpen, importFile, setImportFile, closeImport, loadImportedWork, notify, work: activeWork } = useRosaceApi();
  if (!importOpen) return null;
  return importFile
    ? <ImportWorkbench key={`${importFile.name}-${importFile.size}-${importFile.lastModified}`} file={importFile} onClose={closeImport} onUse={(work) => { loadImportedWork(work); notify("Patron prêt à broder", `${work.width} × ${work.height} points · ${work.palette.length} fils · empreinte ${work.fingerprint.slice(0, 8)}`); }} />
    : <DropZone onFile={setImportFile} onClose={closeImport} activeTitle={activeWork.origin.kind === "pdf" ? activeWork.origin.provenance.file : null} />;
}

function DropZone({ onFile, onClose, activeTitle }: { onFile: (file: File) => void; onClose: () => void; activeTitle: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => firstRef.current?.focus(), 60);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  const accept = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return;
    onFile(file);
  };
  return (
    <section className="importer" role="dialog" aria-modal="true" aria-label="Importer un patron PDF">
      <div className="importer-tete">
        <button className="outil outil-icone" onClick={onClose} aria-label="Fermer l'import"><ArrowLeft size={21} aria-hidden="true" /></button>
        <div className="importer-titre"><strong>Importer un patron PDF</strong><span>Analyser · Caler · Assembler · Vérifier · Utiliser</span></div>
      </div>
      <div className="importer-corps importer-corps-centre">
        <div
          className={`importer-depot ${over ? "is-over" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => { event.preventDefault(); setOver(false); accept(event.dataTransfer.files?.[0]); }}
        >
          <FileUp size={34} strokeWidth={1.5} aria-hidden="true" />
          <h2>Déposez votre patron PDF</h2>
          <p>Un patron multipage de point de croix. ROSACE lit ses pages, recompose la grille avec vous, puis vous brodez croix par croix.</p>
          <button ref={firstRef} type="button" className="bouton noir" onClick={() => inputRef.current?.click()}>Choisir un fichier PDF</button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Choisir un patron PDF" onChange={(event) => { accept(event.target.files?.[0]); event.target.value = ""; }} />
          <small>Le fichier reste sur votre appareil : rien n'est envoyé. {activeTitle ? `Votre patron actuel (${activeTitle}) sera remplacé seulement à l'étape Utiliser.` : "Votre rosace actuelle n'est modifiée qu'à l'étape Utiliser."}</small>
        </div>
      </div>
    </section>
  );
}

function ImportWorkbench({ file, onClose, onUse }: { file: File; onClose: () => void; onUse: (work: StitchWork) => void }) {
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [vector, setVector] = useState<VectorResult | null>(null);
  const [completeGlyph, setCompleteGlyph] = useState<CompleteGlyphChart | null>(null);
  const [glyphReason, setGlyphReason] = useState("");
  const [declaredFromText, setDeclaredFromText] = useState<{ w: number; h: number } | null>(null);
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pageN, setPageN] = useState(1);
  const [blocks, setBlocks] = useState<PdfBlock[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [perRow, setPerRow] = useState(3);
  const [mode, setMode] = useState<Mode>("auto");
  const [colors, setColors] = useState(24);
  const [montage, setMontage] = useState<Montage | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [author, setAuthor] = useState("");
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [uniformSizes, setUniformSizes] = useState(false);
  const [magnet, setMagnet] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [centerTab, setCenterTab] = useState<"puzzle" | "preview">("puzzle");
  const [addingZone, setAddingZone] = useState(false);
  const [zoneDraft, setZoneDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [boardPx, setBoardPx] = useState({ w: 780, h: 520 });
  const [checked, setChecked] = useState({ overlaps: false, holes: false, unresolved: false, lost: false });

  const zoneStart = useRef<{ x: number; y: number } | null>(null);
  const draggedCard = useRef<string | null>(null);
  const handleRef = useRef<PdfHandle | null>(null);
  const registry = useRef(new SymbolRegistry());
  const cache = useRef(new Map<string, CachedBlock>());
  const boardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragInfo = useRef<{ id: string; startClientX: number; startClientY: number; startTileX: number; startTileY: number; tileW: number; tileH: number } | null>(null);

  /** En mode B (vectoriel par graduations) les positions viennent du PDF ; bouger une carte impose la lecture automatique. En mode A (glyphes) le plateau est respecté. */
  const vectorIgnoresBoard = mode === "vecteur" && !completeGlyph?.ok;

  /* ---------- Analyse ---------- */
  useEffect(() => {
    let live = true;
    setBusy("Analyse du PDF…");
    registry.current = new SymbolRegistry();
    cache.current.clear();
    setCorrections({});
    setCompleteGlyph(null);
    setError("");
    analyzePdf(file, (message) => { if (live) setBusy(message); })
      .then(async ({ analysis: a, handle: h }) => {
        if (!live) { h.destroy(); return; }
        handleRef.current = h;
        setHandle(h);
        setAnalysis(a);
        setAuthor(a.author);
        a.legend.forEach((entry) => registry.current.addKnown(entry.bits, entry.code));
        setDeclaredFromText(await declaredSizeFromText(h));
        if (!live) return;
        setBusy("Lecture complète des symboles et codes DMC…");
        const full = await readCompleteGlyphChart(h);
        if (!live) return;
        if (full.ok) {
          setCompleteGlyph(full);
          const chart: PdfBlock[] = full.tiles.map((t) => ({ id: `glyph-${t.page}`, page: t.page, x0: t.bounds.x0, y0: t.bounds.y0, x1: t.bounds.x1, y1: t.bounds.y1, cols: t.cols, rows: t.rows, label: `Grille exacte · page ${t.page}` }));
          setBlocks(chart);
          setOrder(chart.map((b) => b.id));
          setPerRow(full.columns);
          setPageN(chart[0].page);
          setCenterTab("puzzle");
          setVector(null);
          setMode("vecteur");
          setBusy("");
          return;
        }
        setGlyphReason(full.reason);
        const pages = a.pages.filter((p) => p.kind === "chart");
        const chart = pages.flatMap((p) => p.blocks);
        setBlocks(chart);
        setOrder(autoOrder(chart).map((b) => b.id));
        const suggested = a.modelAspect >= 1.2 ? 4 : a.modelAspect <= 0.7 ? 2 : 3;
        setPerRow(Math.min(suggested, Math.max(1, chart.length)));
        if (pages[0]) setPageN(pages[0].n);
        const boxes = new Map<number, { x0: number; y0: number; x1: number; y1: number }[]>();
        for (const b of chart) {
          const list = boxes.get(b.page) ?? [];
          list.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
          boxes.set(b.page, list);
        }
        setBusy("Lecture vectorielle des axes du patron…");
        const v = await readVectorChart(h, boxes);
        if (!live) return;
        setVector(v);
        setMode(v.ok ? "vecteur" : "auto");
        setCenterTab(v.ok ? "preview" : "puzzle");
        setBusy("");
      })
      .catch((e) => { if (live) { setError(e instanceof Error ? e.message : "PDF illisible"); setBusy(""); } });
    return () => { live = false; handleRef.current?.destroy(); handleRef.current = null; };
  }, [file]);

  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current?.focus(), 60);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; };
  }, [busy, onClose]);

  useEffect(() => {
    const element = boardRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setBoardPx({ w: Math.max(240, rect.width - 24), h: Math.max(240, rect.height - 24) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [stage, centerTab]);

  /* ---------- Calage ---------- */
  const zonePoint = (event: RPointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)), y: Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)) };
  };
  const finishMissingZone = (event: RPointerEvent<HTMLDivElement>) => {
    const start = zoneStart.current;
    zoneStart.current = null;
    if (!start) return;
    const end = zonePoint(event);
    const x0 = Math.min(start.x, end.x), y0 = Math.min(start.y, end.y), x1 = Math.max(start.x, end.x), y1 = Math.max(start.y, end.y);
    setZoneDraft(null);
    if (x1 - x0 < 3 || y1 - y0 < 3) return;
    const nearby = blocks.find((b) => b.page === pageN) ?? blocks[0];
    const block: PdfBlock = { id: `manuelle-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, page: pageN, x0, y0, x1, y1, cols: nearby?.cols ?? 40, rows: nearby?.rows ?? 40, label: "Zone ajoutée à la main" };
    setBlocks((previous) => [...previous, block]);
    setOrder((previous) => [...previous, block.id]);
    // Une zone dessinée à la main n'a pas de lecture exacte : elle passe par l'image.
    setMode("auto");
    setVector(null);
    cache.current.clear();
    setAddingZone(false);
    setManualPositions({});
    setAnnounce(`Zone ajoutée sur la page ${pageN} : ${block.cols} × ${block.rows} cases, lecture automatique.`);
  };

  const page = analysis?.pages.find((p) => p.n === pageN);
  const pageBlocks = blocks.filter((b) => b.page === pageN);
  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const effective = useMemo(() => order.map((id) => byId.get(id)).filter((b): b is PdfBlock => !!b && !excluded.has(b.id)), [order, byId, excluded]);
  const uniformDim = useMemo(() => uniformDimensions(effective), [effective]);
  const blockW = (b: PdfBlock) => (uniformSizes ? uniformDim.cols : b.cols);
  const blockH = (b: PdfBlock) => (uniformSizes ? uniformDim.rows : b.rows);
  const defaultMosaic = useMemo(() => positionsPuzzle(effective, perRow, uniformSizes, uniformDim), [effective, perRow, uniformSizes, uniformDim]);
  const tileLayout = useMemo<Array<TilePlacement & { b: PdfBlock }>>(() => effective.map((b) => {
    const pos = manualPositions[b.id] ?? defaultMosaic[b.id] ?? { x: 0, y: 0 };
    return { id: b.id, b, x: pos.x, y: pos.y, w: blockW(b), h: blockH(b) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [effective, manualPositions, defaultMosaic, uniformSizes, uniformDim]);
  const boardSize = useMemo(() => {
    if (!tileLayout.length) return { w: 100, h: 100 };
    return { w: Math.max(10, Math.max(...tileLayout.map((t) => t.x + t.w))), h: Math.max(10, Math.max(...tileLayout.map((t) => t.y + t.h))) };
  }, [tileLayout]);
  const tableScale = useMemo(() => Math.max(0.25, Math.min(3, Math.min(boardPx.w / boardSize.w, boardPx.h / boardSize.h) * zoom)), [boardSize, boardPx, zoom]);
  const overlappingIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < tileLayout.length; i += 1) for (let j = i + 1; j < tileLayout.length; j += 1) if (tilesOverlap(tileLayout[i], tileLayout[j])) { ids.add(tileLayout[i].id); ids.add(tileLayout[j].id); }
    return ids;
  }, [tileLayout]);

  /* ---------- Plateau : glisser, aimanter, clavier ---------- */
  const placeTile = useCallback((id: string, x: number, y: number, moved: boolean) => {
    const tile = tileLayout.find((t) => t.id === id);
    if (!tile) return;
    const snapDist = Math.max(2, Math.round(14 / tableScale));
    const result = snapPosition({ ...tile, x, y }, tileLayout, snapDist, magnet);
    setSnapGuides(result.guides.x !== undefined || result.guides.y !== undefined ? result.guides : null);
    setManualPositions((previous) => ({ ...previous, [id]: { x: result.x, y: result.y } }));
    if (moved && vectorIgnoresBoard) setMode("auto");
    if (result.overlaps.length) setAnnounce(`Page ${tile.b.page} recouvre ${result.overlaps.length} carte(s).`);
  }, [magnet, tableScale, tileLayout, vectorIgnoresBoard]);

  const onPointerDownTile = (event: RPointerEvent, b: PdfBlock) => {
    event.preventDefault();
    event.stopPropagation();
    const t = tileLayout.find((item) => item.id === b.id);
    if (!t) return;
    dragInfo.current = { id: b.id, startClientX: event.clientX, startClientY: event.clientY, startTileX: t.x, startTileY: t.y, tileW: t.w, tileH: t.h };
    setActiveDragId(b.id);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    (event.currentTarget as HTMLElement).focus();
  };
  const onPointerMoveTile = (event: RPointerEvent) => {
    const drag = dragInfo.current;
    if (!drag) return;
    event.preventDefault();
    const dx = Math.round((event.clientX - drag.startClientX) / tableScale);
    const dy = Math.round((event.clientY - drag.startClientY) / tableScale);
    placeTile(drag.id, drag.startTileX + dx, drag.startTileY + dy, dx !== 0 || dy !== 0);
  };
  const onPointerUpTile = (event: RPointerEvent) => {
    if (!dragInfo.current) return;
    try { (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId); } catch { /* capture déjà libérée */ }
    dragInfo.current = null;
    setActiveDragId(null);
    setSnapGuides(null);
  };
  const onTileKey = (event: React.KeyboardEvent, tile: TilePlacement & { b: PdfBlock }) => {
    const step = event.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    placeTile(tile.id, tile.x + move[0], tile.y + move[1], true);
    setAnnounce(`Page ${tile.b.page} : colonne ${Math.max(0, tile.x + move[0]) + 1}, ligne ${Math.max(0, tile.y + move[1]) + 1}.`);
  };

  const arrangeMosaic = (cols: number) => {
    setPerRow(cols);
    setManualPositions(positionsPuzzle(effective, cols, uniformSizes, uniformDim));
    if (vectorIgnoresBoard) setMode("auto");
  };
  const moveCard = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    setOrder((previous) => { const next = previous.slice(); [next[index], next[target]] = [next[target], next[index]]; return next; });
    setManualPositions({});
    if (vectorIgnoresBoard) setMode("auto");
  };
  const toggleExcluded = (id: string) => {
    setExcluded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setManualPositions({});
  };

  /* ---------- Assemblage ---------- */
  const sig = effective.map((b) => keyOf(b, mode, colors)).join("|");
  const layoutSig = tileLayout.map((t) => `${t.id}:${t.x},${t.y},${t.w},${t.h}`).join("|");
  useEffect(() => {
    if (stage < 2 || !handle || !analysis) return;
    let dead = false;
    (async () => {
      try {
        if (!effective.length) { setMontage(null); setError("Aucune carte retenue : réintégrez au moins une page."); return; }
        setError("");
        const legendCodes = new Set<string>(analysis.legend.map((entry) => entry.code).filter(Boolean));
        if (mode === "vecteur") {
          if (completeGlyph?.ok) {
            const tiles: Tile[] = effective.map((b) => {
              const t = completeGlyph.tiles.find((tile) => tile.page === b.page);
              if (!t) throw new Error(`Page vectorielle manquante : ${b.page}`);
              return { id: b.id, page: b.page, cols: t.cols, rows: t.rows, cells: t.cells, byColor: 0, byLegend: t.mapped, unresolved: t.unresolved };
            });
            const assembly = assembleTiles(tiles, tileLayout);
            for (const idx of new Set(assembly.cells)) if (idx >= 0) legendCodes.add(FLOSS[idx].code);
            setMontage({ assembly, source: "glyphes", legendCodes });
            return;
          }
          if (!vector?.ok) { setMontage(null); setError(`Lecture vectorielle indisponible${vector?.reason ? ` (${vector.reason})` : ""} : choisissez Automatique pour lire les couleurs visibles.`); return; }
          const floss = flossCellsFromVector(vector);
          if (!floss) { setMontage(null); setError("Codes DMC vectoriels illisibles : choisissez Automatique."); return; }
          const miss = Object.values(vector.unmapped).reduce((sum, n) => sum + n, 0);
          const tile: Tile = { id: "vectoriel", page: 0, cols: floss.width, rows: floss.height, cells: floss.cells, byColor: 0, byLegend: vector.cells.size, unresolved: miss };
          const assembly = assembleTiles([tile], [{ id: "vectoriel", x: 0, y: 0, w: floss.width, h: floss.height }]);
          for (const [, code] of vector.cells) legendCodes.add(code);
          setMontage({ assembly: { ...assembly, scaled: assembly.scaled || floss.scaled, tiles: effective.length }, source: "vectoriel", legendCodes });
          return;
        }
        for (let i = 0; i < effective.length; i += 1) {
          const b = effective[i];
          const key = keyOf(b, mode, colors);
          if (cache.current.has(key)) continue;
          setBusy(`Lecture de la carte ${i + 1}/${effective.length} · page ${b.page}`);
          await tick();
          const v = mode === "auto" ? await convertBlockAuto(handle, b.page, b, registry.current) : await convertBlockColor(handle, b.page, b, colors);
          if (dead) return;
          cache.current.set(key, "byColor" in v
            ? { ...v, cols: b.cols, rows: b.rows }
            : { cells: v.cells, cols: b.cols, rows: b.rows, byColor: v.cells.filter((x) => x >= 0).length, byLegend: 0, unresolved: 0 });
        }
        if (dead) return;
        const tiles: Tile[] = effective.map((b) => { const data = cache.current.get(keyOf(b, mode, colors))!; return { id: b.id, page: b.page, cols: data.cols, rows: data.rows, cells: data.cells, byColor: data.byColor, byLegend: data.byLegend, unresolved: data.unresolved }; });
        setMontage({ assembly: assembleTiles(tiles, tileLayout), source: mode === "auto" ? "auto" : "photo", legendCodes });
      } catch (e) {
        if (!dead) { setMontage(null); setError(e instanceof Error ? e.message : "Assemblage impossible"); }
      } finally {
        if (!dead) setBusy("");
      }
    })();
    return () => { dead = true; };
  }, [stage, handle, analysis, sig, layoutSig, mode, colors, vector, completeGlyph]);

  /* ---------- Grille importée, corrections, ouvrage d'aperçu ---------- */
  const lost = useMemo<ImportLosses>(() => ({
    halfStitches: 0, quarterStitches: 0, backstitches: 0, knots: 0,
    blends: 0,
    unresolved: montage?.assembly.unresolved ?? 0,
  }), [montage]);
  const grid = useMemo<ImportedGrid | null>(() => {
    if (!montage || !analysis) return null;
    const raw = gridFromFlossCells(
      montage.assembly,
      { file: file.name, title: analysis.title || undefined, author: author.trim() || undefined, pages: analysis.pages.length, mode: montage.source },
      { tiles: tileLayout.map((t) => ({ page: t.b.page, x: t.x, y: t.y, width: t.w, height: t.h })), overlaps: montage.assembly.overlaps, holes: montage.assembly.holes, scaled: montage.assembly.scaled },
      lost,
      completeGlyph?.declared ?? declaredFromText ?? undefined,
      montage.legendCodes,
    );
    return remapGridPalette(raw, corrections);
  }, [montage, analysis, file.name, author, tileLayout, lost, completeGlyph, declaredFromText, corrections]);
  const outcome = useMemo(() => (grid ? fromImport(grid) : null), [grid]);
  const previewWork = outcome?.ok ? outcome.work : null;

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !previewWork) return;
    paintPattern(canvas, previewWork, "chart", Math.min(1600, Math.max(600, Math.max(previewWork.width, previewWork.height) * 9)));
  }, [previewWork, centerTab, stage]);

  const detectedColors = useMemo(() => {
    if (!montage) return [];
    const counts = new Map<number, number>();
    for (const idx of montage.assembly.cells) if (idx >= 0) counts.set(idx, (counts.get(idx) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [montage]);

  /* ---------- Vérifier ---------- */
  const checks = useMemo(() => {
    if (!montage || !previewWork) return [];
    const a = montage.assembly;
    const declared = completeGlyph?.declared ?? declaredFromText;
    const items: Array<{ id: keyof typeof checked | null; level: "ok" | "attention" | "bloquant"; text: string }> = [];
    items.push({ id: null, level: "ok", text: `Lecture ${montage.source === "glyphes" ? "exacte des symboles (police du PDF)" : montage.source === "vectoriel" ? "exacte par graduations (texte du PDF)" : montage.source === "auto" ? "automatique par image : à contrôler sur la légende" : "photo : couleurs estimées, à contrôler"}.` });
    items.push({ id: null, level: declared && (declared.w !== previewWork.width || declared.h !== previewWork.height) ? "attention" : "ok", text: declared ? `Dimensions ${previewWork.width} × ${previewWork.height} points ; le PDF annonce ${declared.w} × ${declared.h}.` : `Dimensions ${previewWork.width} × ${previewWork.height} points (aucune dimension annoncée dans le PDF).` });
    items.push({ id: a.overlaps ? "overlaps" : null, level: a.overlaps ? (a.conflicts ? "bloquant" : "attention") : "ok", text: a.overlaps ? `${a.overlaps.toLocaleString("fr-FR")} case(s) recouvertes par deux cartes, dont ${a.conflicts.toLocaleString("fr-FR")} avec des valeurs différentes (la carte la plus haute dans l'ordre gagne).` : "Aucun recouvrement entre les cartes." });
    items.push({ id: a.holes ? "holes" : null, level: a.holes ? "attention" : "ok", text: a.holes ? `${a.holes.toLocaleString("fr-FR")} case(s) du plateau ne sont couvertes par aucune carte : elles resteront vides.` : "Le plateau est entièrement couvert." });
    items.push({ id: a.unresolved ? "unresolved" : null, level: a.unresolved ? "attention" : "ok", text: a.unresolved ? `${a.unresolved.toLocaleString("fr-FR")} symbole(s) sans correspondance DMC, laissés vides. Vous pourrez les broder d'après le PDF.` : "Tous les symboles lus ont une référence DMC." });
    items.push({ id: null, level: "ok", text: `${previewWork.palette.length} fil(s) DMC, dont ${previewWork.palette.filter((_, i) => grid?.colors[i]?.fromLegend).length} confirmé(s) par la légende du PDF ; ${previewWork.stitches.length.toLocaleString("fr-FR")} croix.` });
    items.push({ id: "lost", level: "attention", text: "Points non repris : demi-points, quarts de point, points arrière, nœuds et mélanges de fils ne sont pas lus. Si le patron en contient, gardez le PDF pour ces détails." });
    if (a.scaled) items.push({ id: null, level: "attention", text: `Grille réduite pour tenir dans l'atelier (plateau d'origine ${a.rawWidth} × ${a.rawHeight}) : ce n'est pas la grille exacte du PDF.` });
    return items;
  }, [montage, previewWork, completeGlyph, declaredFromText, grid]);
  const blocking = checks.some((item) => item.level === "bloquant" && item.id && !checked[item.id]) || checks.some((item) => item.id && item.level === "attention" && !checked[item.id]);
  const canUse = !!previewWork && !busy && !blocking;

  const use = () => {
    if (!previewWork || !grid) return;
    const finalOutcome = fromImport({ ...grid, provenance: { ...grid.provenance, author: author.trim() || undefined } });
    if (!finalOutcome.ok) { setError(finalOutcome.error); return; }
    onUse(finalOutcome.work);
  };

  const stageTitle = STAGES[stage];
  const scroll = prefersReducedMotion() ? "auto" : "smooth";

  return (
    <section className="importer" role="dialog" aria-modal="true" aria-label={`Importer un patron PDF, étape ${stage + 1} sur 4 : ${stageTitle}`}>
      <div className="importer-tete">
        <button ref={closeRef} className="outil outil-icone" onClick={onClose} disabled={!!busy} aria-label="Fermer l'import sans rien changer à l'ouvrage actuel"><ArrowLeft size={21} aria-hidden="true" /></button>
        <div className="importer-titre">
          <strong>{analysis?.title || file.name}</strong>
          <span>{file.name}{analysis ? ` · ${analysis.pages.length} page${analysis.pages.length > 1 ? "s" : ""}` : ""}{stage >= 2 ? ` · plateau ${boardSize.w} × ${boardSize.h}` : ""}</span>
        </div>
        <ol className="importer-etapes" aria-label="Étapes">
          {STAGES.map((label, index) => (
            <li key={label}>
              <button type="button" disabled={index > stage || !!busy || (index > 1 && !effective.length)} aria-current={index === stage ? "step" : undefined} className={index === stage ? "is-active" : index < stage ? "is-done" : ""} onClick={() => setStage(index)}>
                <i aria-hidden="true">{index < stage ? <Check size={11} /> : index + 1}</i><span>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="importer-progression" aria-hidden="true"><span style={{ width: `${((stage + 1) / 4) * 100}%` }} /></div>

      <div className="importer-corps">
        {error && <p role="alert" className="importer-alerte">{error}</p>}

        {stage === 0 && analysis && (
          <div className="importer-colonne">
            <p className="surtitre">Analyser</p>
            <h2 className="importer-h2">{analysis.pages.filter((p) => p.kind === "chart").length} page{analysis.pages.filter((p) => p.kind === "chart").length > 1 ? "s" : ""} de grille, {blocks.length} bloc{blocks.length > 1 ? "s" : ""} détecté{blocks.length > 1 ? "s" : ""}</h2>
            <p className="importer-texte" role="status">
              {completeGlyph?.ok
                ? `Grille exacte reconnue dans le texte du PDF : ${completeGlyph.tiles.length} cartes en ${completeGlyph.columns} colonnes, ${completeGlyph.width} × ${completeGlyph.height} points, ${completeGlyph.legendCount} fils dans la légende, ${completeGlyph.unresolved} symbole(s) sans correspondance.`
                : vector?.ok
                  ? `Lecture vectorielle par graduations : ${vector.cells.size.toLocaleString("fr-FR")} cases avec codes DMC.${glyphReason ? ` Lecture par police de symboles impossible : ${glyphReason}.` : ""}`
                  : `Lecture par image : ${analysis.legend.length} correspondance(s) symbole → DMC dans la légende.${glyphReason ? ` Lecture exacte impossible : ${glyphReason}.` : ""}${vector && !vector.ok ? ` Graduations non exploitables : ${vector.reason}.` : ""}`}
            </p>
            <ul className="importer-pages" aria-label="Pages du PDF">
              {analysis.pages.map((p) => (
                <li key={p.n}>
                  <button type="button" className="importer-page" onClick={() => { setPageN(p.n); setStage(1); }} aria-label={`Page ${p.n}, ${KIND_LABEL[p.kind]}, ouvrir le calage`}>
                    <img src={p.thumb} alt="" />
                    <span>Page {p.n}<em className={p.kind === "chart" ? "is-chart" : ""}>{KIND_LABEL[p.kind]}</em></span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="importer-actions">
              <button type="button" className="bouton noir" disabled={!!busy || !blocks.length} onClick={() => setStage(1)}>Caler les grilles <ArrowRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        )}

        {stage === 1 && analysis && page && (
          <div className="importer-deux">
            <div className="importer-calage">
              <div className="importer-onglets" role="tablist" aria-label="Pages">
                {analysis.pages.map((p) => (
                  <button key={p.n} type="button" role="tab" aria-selected={p.n === pageN} className={p.n === pageN ? "is-active" : ""} onClick={() => setPageN(p.n)}>{p.n}{p.kind === "chart" ? " ✓" : ""}</button>
                ))}
              </div>
              <div
                className={`importer-feuille ${addingZone ? "is-dessin" : ""}`}
                style={{ aspectRatio: `1 / ${page.aspect}` }}
                onPointerDown={(event) => { if (!addingZone) return; const point = zonePoint(event); zoneStart.current = point; setZoneDraft({ x0: point.x, y0: point.y, x1: point.x, y1: point.y }); event.currentTarget.setPointerCapture?.(event.pointerId); }}
                onPointerMove={(event) => { const start = zoneStart.current; if (!addingZone || !start) return; const end = zonePoint(event); setZoneDraft({ x0: Math.min(start.x, end.x), y0: Math.min(start.y, end.y), x1: Math.max(start.x, end.x), y1: Math.max(start.y, end.y) }); }}
                onPointerUp={(event) => { if (addingZone) finishMissingZone(event); }}
                onPointerCancel={() => { zoneStart.current = null; setZoneDraft(null); }}
              >
                <img src={page.thumb} alt={`Page ${page.n} du PDF`} draggable={false} />
                {pageBlocks.map((b) => (
                  <div key={b.id} className={`importer-bloc ${excluded.has(b.id) ? "is-exclu" : ""}`} style={{ left: `${b.x0}%`, top: `${b.y0}%`, width: `${b.x1 - b.x0}%`, height: `${b.y1 - b.y0}%` }}>
                    <span>P.{b.page} · {b.cols} × {b.rows}</span>
                  </div>
                ))}
                {addingZone && zoneDraft && <div className="importer-bloc is-dessin" style={{ left: `${zoneDraft.x0}%`, top: `${zoneDraft.y0}%`, width: `${zoneDraft.x1 - zoneDraft.x0}%`, height: `${zoneDraft.y1 - zoneDraft.y0}%` }} />}
              </div>
              {addingZone && <p className="panneau-aide">Tracez un rectangle autour de la partie de grille oubliée.</p>}
            </div>
            <aside className="importer-cote">
              <p className="surtitre">Caler · page {pageN}</p>
              <button type="button" className="bouton bouton-petit bouton-large" aria-pressed={addingZone} onClick={() => { setAddingZone(!addingZone); setZoneDraft(null); zoneStart.current = null; }}>
                {addingZone ? "Annuler le tracé" : "Récupérer une zone oubliée"}
              </button>
              <p className="panneau-aide">Les rectangles sont les grilles détectées. Corrigez le nombre de cases si le repère diffère du PDF, ou écartez un bloc qui n'est pas une grille.</p>
              <ul className="importer-liste">
                {pageBlocks.map((b, i) => (
                  <li key={b.id} className={excluded.has(b.id) ? "is-exclu" : ""}>
                    <span>Bloc {i + 1}</span>
                    <label>cases<input type="number" min={5} max={400} value={b.cols} aria-label={`Colonnes du bloc ${i + 1}`} onChange={(event) => setBlocks((all) => all.map((v) => (v.id === b.id ? { ...v, cols: clampInt(event.target.value, 5, 400, v.cols) } : v)))} /></label>
                    <span aria-hidden="true">×</span>
                    <input type="number" min={5} max={400} value={b.rows} aria-label={`Rangées du bloc ${i + 1}`} onChange={(event) => setBlocks((all) => all.map((v) => (v.id === b.id ? { ...v, rows: clampInt(event.target.value, 5, 400, v.rows) } : v)))} />
                    <button type="button" className="outil outil-icone" aria-pressed={excluded.has(b.id)} aria-label={excluded.has(b.id) ? `Réintégrer le bloc ${i + 1}` : `Écarter le bloc ${i + 1}`} onClick={() => toggleExcluded(b.id)}><X size={15} aria-hidden="true" /></button>
                  </li>
                ))}
                {!pageBlocks.length && <li className="importer-vide">Aucune grille détectée sur cette page.</li>}
              </ul>
              <div className="importer-actions">
                <button type="button" className="bouton bouton-petit" onClick={() => setStage(0)}>Retour</button>
                <button type="button" className="bouton noir" disabled={!effective.length || !!busy} onClick={() => { setCenterTab(vectorIgnoresBoard ? "preview" : "puzzle"); setStage(2); }}>Assembler <ArrowRight size={16} aria-hidden="true" /></button>
              </div>
            </aside>
          </div>
        )}

        {stage === 2 && (
          <div className="importer-deux importer-montage">
            <div className="importer-plateau-zone">
              <div className="importer-barre">
                <div className="importer-segments" role="group" aria-label="Affichage central">
                  <button type="button" aria-pressed={centerTab === "puzzle"} onClick={() => setCenterTab("puzzle")}><Grid3x3 size={15} aria-hidden="true" /> Table de montage</button>
                  <button type="button" aria-pressed={centerTab === "preview"} onClick={() => setCenterTab("preview")}>Aperçu de la grille</button>
                </div>
                {centerTab === "puzzle" && (
                  <div className="importer-zoom" role="group" aria-label="Zoom du plateau">
                    <button type="button" className="zoom-bouton" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} aria-label="Zoom arrière"><Minus size={15} aria-hidden="true" /></button>
                    <span className="zoom-bouton broder-jauge" aria-live="polite">{Math.round(zoom * 100)} %</span>
                    <button type="button" className="zoom-bouton" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} aria-label="Zoom avant"><Plus size={15} aria-hidden="true" /></button>
                    <button type="button" className="zoom-bouton" onClick={() => setManualPositions({})} aria-label="Réaligner toutes les cartes en mosaïque"><Undo2 size={14} aria-hidden="true" /> Réaligner</button>
                  </div>
                )}
              </div>
              {centerTab === "puzzle" && (
                <div ref={boardRef} className="importer-plateau" onPointerMove={onPointerMoveTile} onPointerUp={onPointerUpTile} onPointerCancel={onPointerUpTile}
                  onWheel={(event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); setZoom((z) => Math.max(0.4, Math.min(3, z * (event.deltaY < 0 ? 1.1 : 0.9)))); }}>
                  {vectorIgnoresBoard && <p className="importer-note">En lecture exacte par graduations, les positions viennent du PDF : déplacer une carte passe en lecture automatique.</p>}
                  <div className="importer-table" style={{ width: `${boardSize.w * tableScale}px`, height: `${boardSize.h * tableScale}px`, backgroundSize: `${10 * tableScale}px ${10 * tableScale}px` }}>
                    {snapGuides?.x !== undefined && <div className="importer-guide importer-guide-v" style={{ left: `${snapGuides.x * tableScale}px` }} />}
                    {snapGuides?.y !== undefined && <div className="importer-guide importer-guide-h" style={{ top: `${snapGuides.y * tableScale}px` }} />}
                    {tileLayout.map((tile) => {
                      const { b, x, y, w: tw, h: th } = tile;
                      const pageObj = analysis?.pages.find((p) => p.n === b.page);
                      const cropW = Math.max(1, b.x1 - b.x0);
                      const cropH = Math.max(1, b.y1 - b.y0);
                      return (
                        <div
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Page ${b.page}, ${tw} par ${th} cases, colonne ${x + 1}, ligne ${y + 1}. Flèches pour déplacer, Maj pour aller plus vite.`}
                          onPointerDown={(event) => onPointerDownTile(event, b)}
                          onKeyDown={(event) => onTileKey(event, tile)}
                          className={`importer-carte ${activeDragId === b.id ? "is-drag" : ""} ${overlappingIds.has(b.id) ? "is-recouvre" : ""}`}
                          style={{ left: `${x * tableScale}px`, top: `${y * tableScale}px`, width: `${tw * tableScale}px`, height: `${th * tableScale}px` }}
                        >
                          {pageObj?.thumb && <img src={pageObj.thumb} alt="" draggable={false} style={{ left: `-${(b.x0 / cropW) * 100}%`, top: `-${(b.y0 / cropH) * 100}%`, width: `${(100 / cropW) * 100}%`, height: `${(100 / cropH) * 100}%` }} />}
                          <span className="importer-carte-badge">P.{b.page}<em>{tw}×{th}</em></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {centerTab === "preview" && (
                <div className="importer-apercu">
                  {previewWork ? <canvas ref={previewRef} role="img" aria-label={`Grille recomposée, ${previewWork.width} par ${previewWork.height} points, ${previewWork.palette.length} fils`} /> : <p>{busy || (outcome && !outcome.ok ? outcome.error : "Génération de l'aperçu…")}</p>}
                </div>
              )}
              {montage && previewWork && (
                <p className="importer-resume">
                  Grille {previewWork.width} × {previewWork.height} · {previewWork.palette.length} fils DMC · {montage.assembly.tiles} carte(s)
                  {montage.assembly.overlaps > 0 && <strong className="is-attention"> · {montage.assembly.overlaps} case(s) recouvertes</strong>}
                  {montage.assembly.holes > 0 && <strong className="is-attention"> · {montage.assembly.holes} case(s) vides</strong>}
                  {montage.assembly.scaled && <strong className="is-attention"> · réduite pour l'atelier</strong>}
                </p>
              )}
              <p className="sr-only" aria-live="polite">{announce}</p>
            </div>

            <aside className="importer-cote">
              <section className="importer-section">
                <p className="surtitre">Mosaïque</p>
                <div className="importer-segments" role="group" aria-label="Colonnes de la mosaïque">
                  {[2, 3, 4, 6].map((cols) => <button key={cols} type="button" aria-pressed={perRow === cols} onClick={() => arrangeMosaic(cols)}>{cols} col.</button>)}
                </div>
                <label className="importer-case"><input type="checkbox" checked={uniformSizes} onChange={(event) => setUniformSizes(event.target.checked)} /> Cartes de taille égale</label>
                <label className="importer-case"><input type="checkbox" checked={magnet} onChange={(event) => setMagnet(event.target.checked)} /> <Magnet size={13} aria-hidden="true" /> Aimantation aux bords</label>
              </section>

              <section className="importer-section">
                <p className="surtitre">Ordre des cartes</p>
                <ul className="importer-cartes-liste">
                  {effective.map((b, i) => (
                    <li key={b.id} draggable onDragStart={(event) => { draggedCard.current = b.id; event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { if (draggedCard.current) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const from = effective.findIndex((x) => x.id === draggedCard.current); if (from >= 0) moveCard(from, i - from); draggedCard.current = null; }} onDragEnd={() => { draggedCard.current = null; }}>
                      <i>{i + 1}</i>
                      {analysis?.pages.find((p) => p.n === b.page)?.thumb && <img src={analysis.pages.find((p) => p.n === b.page)!.thumb} alt="" draggable={false} />}
                      <span>Page {b.page} · {b.cols} × {b.rows}</span>
                      <button type="button" className="outil outil-icone" disabled={i === 0} aria-label={`Monter la carte ${i + 1}`} onClick={() => moveCard(i, -1)}>↑</button>
                      <button type="button" className="outil outil-icone" disabled={i === effective.length - 1} aria-label={`Descendre la carte ${i + 1}`} onClick={() => moveCard(i, 1)}>↓</button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="importer-section">
                <p className="surtitre">Lecture des points</p>
                <div className="importer-segments" role="group" aria-label="Mode de lecture">
                  {(vector?.ok || completeGlyph?.ok) && <button type="button" aria-pressed={mode === "vecteur"} onClick={() => { setMode("vecteur"); if (!completeGlyph?.ok) setCenterTab("preview"); }}>DMC exacts</button>}
                  <button type="button" aria-pressed={mode === "auto"} onClick={() => setMode("auto")}>Automatique</button>
                  <button type="button" aria-pressed={mode === "photo"} onClick={() => setMode("photo")}>Photo</button>
                </div>
                <p className="panneau-aide">
                  {mode === "vecteur"
                    ? completeGlyph?.ok ? "Symboles et codes DMC lus dans la police du PDF, case par case. L'ordre et la position des cartes sont respectés." : "Codes DMC et symboles lus dans le texte du PDF, positionnés par les graduations. Déplacer une carte passe en lecture automatique."
                    : mode === "auto" ? "Associe les symboles lisibles de l'image à la légende DMC ; pour les cases visiblement colorées, propose le fil le plus proche." : "Couleurs estimées depuis l'image imprimée. À vérifier sur la légende avant de broder."}
                </p>
                {mode === "photo" && <label className="importer-curseur">Fils au maximum : {colors}<input type="range" min={2} max={60} value={colors} onChange={(event) => setColors(Number(event.target.value))} /></label>}
              </section>

              {montage && grid && (
                <section className="importer-section" aria-label="Fils DMC reconnus">
                  <p className="surtitre">Fils et codes DMC</p>
                  <p className="panneau-aide">{montage.assembly.byLegend.toLocaleString("fr-FR")} croix liées à la légende · {montage.assembly.byColor.toLocaleString("fr-FR")} estimées par couleur{montage.assembly.unresolved > 0 ? ` · ${montage.assembly.unresolved} symbole(s) sans code, laissés vides` : ""}.</p>
                  <ul className="importer-fils">
                    {detectedColors.map(([idx, count]) => {
                      const floss = FLOSS[idx];
                      if (!floss) return null;
                      const selected = corrections[floss.code] ?? floss.code;
                      const valid = flossIndex(selected) >= 0;
                      const shown = valid ? FLOSS[flossIndex(selected)] : floss;
                      return (
                        <li key={floss.code}>
                          <div className="importer-fil-tete">
                            <i style={{ background: shown.hex }} aria-hidden="true" />
                            <span>DMC {floss.code} · {getThread(floss.code).name}</span>
                            <small>{count.toLocaleString("fr-FR")}</small>
                          </div>
                          <label>Remplacer par<input value={selected} aria-invalid={!valid} onChange={(event) => setCorrections((previous) => ({ ...previous, [floss.code]: event.target.value.toUpperCase().trim() }))} aria-label={`Code DMC de remplacement pour ${floss.code}`} /></label>
                          {!valid && <p className="importer-erreur">Code inconnu : le fil d'origine est conservé.</p>}
                          <div className="importer-suggestions">
                            {closestDmcAlternatives(floss.code, 3).map((s) => <button key={s.code} type="button" title={`Proche de DMC ${floss.code}, écart ${s.deltaE.toFixed(1)}`} onClick={() => setCorrections((previous) => ({ ...previous, [floss.code]: s.code }))}><i style={{ background: getThread(s.code).hex }} aria-hidden="true" />{s.code}</button>)}
                            {selected !== floss.code && <button type="button" onClick={() => setCorrections((previous) => ({ ...previous, [floss.code]: floss.code }))}>Rétablir</button>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section className="importer-section">
                <p className="surtitre">Auteur</p>
                <input className="importer-champ" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Créatrice ou boutique du patron" aria-label="Auteur du patron" />
                <p className="panneau-aide">Un patron acheté reste à usage personnel : la mention d'auteur voyage avec votre ouvrage.</p>
              </section>

              <div className="importer-actions">
                <button type="button" className="bouton bouton-petit" onClick={() => setStage(1)}>Caler</button>
                <button type="button" className="bouton noir" disabled={!previewWork || !!busy} onClick={() => { setStage(3); setChecked({ overlaps: false, holes: false, unresolved: false, lost: false }); window.setTimeout(() => document.querySelector(".importer-corps")?.scrollTo({ top: 0, behavior: scroll }), 0); }}>Vérifier <ArrowRight size={16} aria-hidden="true" /></button>
              </div>
            </aside>
          </div>
        )}

        {stage === 3 && previewWork && montage && (
          <div className="importer-deux">
            <div className="importer-apercu importer-apercu-final">
              <canvas ref={previewRef} role="img" aria-label={`Grille recomposée, ${previewWork.width} par ${previewWork.height} points`} />
            </div>
            <aside className="importer-cote">
              <p className="surtitre">Vérifier</p>
              <h2 className="importer-h2">{previewWork.width} × {previewWork.height} points · {previewWork.palette.length} fils · {previewWork.stitches.length.toLocaleString("fr-FR")} croix</h2>
              <ul className="importer-controles">
                {checks.map((item, index) => (
                  <li key={index} className={`is-${item.level}`}>
                    {item.id ? (
                      <label><input type="checkbox" checked={checked[item.id]} onChange={(event) => setChecked((previous) => ({ ...previous, [item.id as keyof typeof checked]: event.target.checked }))} /> <span>{item.text} <em>J'ai vu.</em></span></label>
                    ) : <span>{item.text}</span>}
                  </li>
                ))}
              </ul>
              <p className="panneau-aide">L'ouvrage reçoit l'empreinte {outcome?.ok ? outcome.work.fingerprint.slice(0, 8) : "…"} : votre progression y sera liée. Le PDF d'origine reste votre référence pour tout ce que ROSACE n'a pas pu lire.</p>
              <div className="importer-actions">
                <button type="button" className="bouton bouton-petit" onClick={() => setStage(2)}>Assembler</button>
                <button type="button" className="bouton noir" disabled={!canUse} onClick={use}><Check size={16} aria-hidden="true" /> Utiliser et broder</button>
              </div>
              {!canUse && previewWork && <p className="panneau-aide">Cochez chaque point à vérifier avant d'utiliser ce patron.</p>}
            </aside>
          </div>
        )}

        {busy && <div className="importer-busy" role="status"><span className="importer-spinner" aria-hidden="true" />{busy}</div>}
      </div>
    </section>
  );
}
