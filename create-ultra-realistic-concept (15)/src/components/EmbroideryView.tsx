import { ChevronLeft, Download, FolderOpen, Grid3X3, ListChecks, Minus, Plus, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DMC_ALL_THREADS, getThread } from "../data/dmc";
import { chartGeometry } from "../lib/paint";
import { patternFingerprint, shortFingerprint } from "../lib/pattern-id";
import { paintPattern } from "../lib/paint";
import { SYMBOLS } from "../lib/rosace";
import {
  buildProject, importProject, loadProgress, parseRuns, progressPercent, remainingByColor,
  saveProgress, serializeRuns, stitchIndex, type EmbroideryProgress, type Viewport,
} from "../lib/progress";
import { formatSeed, useRosaceApi } from "../state/rosace-store";
import { downloadBlob } from "../lib/exporters";

const BASE = 1800;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 8;

type Highlight = "all" | "thread" | "remaining";
interface Tap { startX: number; startY: number; moved: boolean; pointerId: number }

function clampViewport(view: Viewport): Viewport {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k));
  const limit = 900 * k;
  return { k, x: Math.max(-limit, Math.min(limit, view.x)), y: Math.max(-limit, Math.min(limit, view.y)) };
}

/**
 * Mode BRODERIE.
 * Le patron est immuable : cette vue ne modifie jamais `pattern`.
 * La progression (cases cochées, fil sélectionné, dernière vue) est stockée
 * séparément sous l'empreinte exacte du patron.
 */
export function EmbroideryView() {
  const api = useRosaceApi();
  const { pattern, config, embroideryOpen, setEmbroideryOpen } = api;
  const fingerprint = useMemo(() => patternFingerprint(pattern), [pattern]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hydrated = useRef(false);
  const storageWarned = useRef(false);
  const saveTimer = useRef<number | null>(null);

  const [size, setSize] = useState({ w: 320, h: 420 });
  const [view, setView] = useState<Viewport>({ k: 1, x: 0, y: 0 });
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [selectedCode, setSelectedCode] = useState<string | null>(config.palette[0] ?? null);
  const [highlight, setHighlight] = useState<Highlight>("all");
  const [history, setHistory] = useState<Array<{ index: number; added: boolean }>>([]);
  const [future, setFuture] = useState<Array<{ index: number; added: boolean }>>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; k: number; x: number; y: number; mx: number; my: number } | null>(null);
  const tap = useRef<Tap | null>(null);
  const suppressTap = useRef(0);

  const progress = useMemo(() => progressPercent(pattern, completed), [pattern, completed]);
  const remaining = useMemo(() => remainingByColor(pattern, completed), [pattern, completed]);
  const selectedRemaining = selectedCode ? remaining.find((line) => line.code === selectedCode) : null;

  /* ---------- Chargement et sauvegarde séparés du patron ---------- */
  useEffect(() => {
    if (!embroideryOpen) return;
    const saved = loadProgress(fingerprint);
    if (saved) {
      const parsed = parseRuns(saved.completedRuns);
      // On ne conserve que des cases réellement brodées du patron canonique.
      const valid = new Set<number>();
      for (const index of parsed) if (pattern.cells[index] >= 0) valid.add(index);
      setCompleted(valid);
      setSelectedCode(saved.selectedCode && config.palette.includes(saved.selectedCode) ? saved.selectedCode : config.palette[0] ?? null);
      setView(clampViewport(saved.viewport));
      setAnnounce(`Progression restaurée : ${valid.size} croix sur ${pattern.stitches.length}.`);
    } else {
      setCompleted(new Set());
      setSelectedCode(config.palette[0] ?? null);
      setView({ k: 1, x: 0, y: 0 });
      setAnnounce("Nouvelle progression pour ce patron.");
    }
    setHistory(Array.isArray(saved?.journal) ? saved.journal.slice(-100) : []);
    setFuture([]);
    hydrated.current = true;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 80);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // volontairement lié à l'empreinte : une nouvelle recette recharge sa progression
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embroideryOpen, fingerprint]);

  const persist = useCallback((next?: Partial<EmbroideryProgress>) => {
    if (!hydrated.current) return;
    const record: EmbroideryProgress = {
      version: 2,
      fingerprint,
      completedRuns: next?.completedRuns ?? serializeRuns(completed),
      selectedCode: next?.selectedCode !== undefined ? next.selectedCode : selectedCode,
      viewport: next?.viewport ?? view,
      journal: next?.journal ?? history,
      updatedAt: new Date().toISOString(),
    };
    try {
      saveProgress(record);
    } catch {
      if (!storageWarned.current) {
        storageWarned.current = true;
        api.notify("Progression non enregistrée", "Le stockage du navigateur est plein ou indisponible.");
      }
    }
  }, [api, completed, fingerprint, selectedCode, view]);

  useEffect(() => {
    if (!embroideryOpen || !hydrated.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      persist();
    }, 350);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [completed, selectedCode, view, persist, embroideryOpen]);

  const close = useCallback(() => {
    persist();
    setEmbroideryOpen(false);
    api.notify(`Progression enregistrée · ${progress.percent} %`, `${progress.done.toLocaleString("fr-FR")} / ${progress.total.toLocaleString("fr-FR")} croix`);
  }, [api, persist, progress.done, progress.percent, progress.total, setEmbroideryOpen]);

  /* ---------- Base graphique et dessin ---------- */
  useEffect(() => {
    if (!embroideryOpen) return;
    const base = document.createElement("canvas");
    base.width = BASE;
    base.height = BASE;
    paintPattern(base, pattern, "chart", BASE);
    baseRef.current = base;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embroideryOpen, pattern]);

  useEffect(() => {
    if (!embroideryOpen) return;
    const element = wrapRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ w: Math.max(220, rect.width), h: Math.max(220, rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [embroideryOpen]);

  const geometry = useMemo(() => ({
    fit: Math.min(size.w, size.h) * 0.985 / BASE,
    centerX: size.w / 2,
    centerY: size.h / 2,
    chart: chartGeometry(BASE, pattern.size, "chart"),
  }), [pattern.size, size]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--fond")?.trim() || "#f6f6f4";
    ctx.fillRect(0, 0, size.w, size.h);
    const { fit, centerX, centerY, chart } = geometry;
    const scale = fit * view.k;
    ctx.save();
    ctx.translate(centerX + view.x, centerY + view.y);
    ctx.scale(scale, scale);
    ctx.drawImage(base, -BASE / 2, -BASE / 2);

    const toBase = (x: number, y: number) => ({ bx: -BASE / 2 + chart.origin + x * chart.cell, by: -BASE / 2 + chart.origin + y * chart.cell });
    const cell = chart.cell;
    const selectedIndex = selectedCode ? config.palette.indexOf(selectedCode) : -1;

    // Le filtre « fil » masque visuellement toutes les autres croix, y compris le fond de grille.
    if (highlight === "thread" && selectedIndex >= 0) {
      ctx.fillStyle = "rgba(255,255,255,0.93)";
      ctx.fillRect(-BASE / 2, -BASE / 2, BASE, BASE);
    }

    // Mise en évidence du fil choisi (toutes ses croix, même terminées).
    if (selectedIndex >= 0 && highlight === "thread") {
      ctx.strokeStyle = getThread(config.palette[selectedIndex]).hex;
      ctx.lineWidth = 1.2;
      for (const stitch of pattern.stitches) {
        if (stitch.color !== selectedIndex) continue;
        const { bx, by } = toBase(stitch.x, stitch.y);
        const index = stitchIndex(pattern.size, stitch.x, stitch.y);
        if (completed.has(index)) continue;
        ctx.fillStyle = getThread(config.palette[selectedIndex]).hex;
        ctx.fillRect(bx - cell / 2, by - cell / 2, cell + 0.35, cell + 0.35);
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.font = `${Math.round(cell * 0.8)}px "Inter Tight", Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(SYMBOLS[selectedIndex], bx, by + 0.5);
      }
    }

    // Croix brodées : remplissage couleur du fil, symbole masqué.
    for (const index of completed) {
      const x = index % pattern.size;
      const y = Math.floor(index / pattern.size);
      const paletteIndex = pattern.cells[index];
      if (paletteIndex < 0) continue;
      const { bx, by } = toBase(x, y);
      if (highlight === "remaining") {
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.fillRect(bx - cell / 2, by - cell / 2, cell, cell);
        continue;
      }
      if (highlight === "thread" && paletteIndex !== selectedIndex) continue;
      ctx.fillStyle = getThread(config.palette[paletteIndex]).hex;
      ctx.fillRect(bx - cell / 2, by - cell / 2, cell + 0.35, cell + 0.35);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 0.9;
      ctx.strokeRect(bx - cell / 2, by - cell / 2, cell, cell);
    }

    if (cursor) {
      const { bx, by } = toBase(cursor.x, cursor.y);
      ctx.strokeStyle = "#141214";
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - cell / 2 - 1, by - cell / 2 - 1, cell + 2, cell + 2);
    }
    ctx.restore();
  }, [completed, config.palette, cursor, geometry, highlight, pattern, selectedCode, size, view]);

  useEffect(() => { draw(); }, [draw]);

  /* ---------- Coordonnées et interactions ---------- */
  const cellAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { fit, centerX, centerY, chart } = geometry;
    const scale = fit * view.k;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const bx = (px - centerX - view.x) / scale + BASE / 2;
    const by = (py - centerY - view.y) / scale + BASE / 2;
    const x = Math.round((bx - chart.origin) / chart.cell);
    const y = Math.round((by - chart.origin) / chart.cell);
    if (x < 0 || y < 0 || x >= pattern.size || y >= pattern.size) return null;
    return { x, y };
  }, [geometry, pattern.size, view.k, view.x, view.y]);

  const toggleAt = useCallback((x: number, y: number) => {
    const index = stitchIndex(pattern.size, x, y);
    if (pattern.cells[index] < 0) {
      setAnnounce(`Colonne ${x + 1}, ligne ${y + 1} : case vide, rien à broder.`);
      return;
    }
    const added = !completed.has(index);
    setCompleted((current) => {
      const next = new Set(current);
      if (added) next.add(index); else next.delete(index);
      return next;
    });
    const nextSet = new Set(completed);
    if (added) nextSet.add(index); else nextSet.delete(index);
    try {
      saveProgress({ version: 2, fingerprint, completedRuns: serializeRuns(nextSet), selectedCode, viewport: view, journal: [...history.slice(-99), { index, added }], updatedAt: new Date().toISOString() });
    } catch {
      if (!storageWarned.current) {
        storageWarned.current = true;
        api.notify("Progression non enregistrée", "Le stockage du navigateur est plein ou indisponible.");
      }
    }
    setHistory((current) => [...current.slice(-99), { index, added }]);
    setFuture([]);
    const color = getThread(config.palette[pattern.cells[index]]);
    setAnnounce(`Colonne ${x + 1}, ligne ${y + 1}, DMC ${color.code} : ${added ? "marquée brodée" : "démarquée"}.`);
  }, [completed, config.palette, pattern]);

  const applyAndSave = (index: number, brodé: boolean) => {
    const next = new Set(completed);
    if (brodé) next.add(index); else next.delete(index);
    setCompleted(next);
    try {
      saveProgress({ version: 2, fingerprint, completedRuns: serializeRuns(next), selectedCode, viewport: view, journal: history, updatedAt: new Date().toISOString() });
    } catch { /* signalé au prochain marquage */ }
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [...current, last]);
    applyAndSave(last.index, !last.added);
    setAnnounce("Dernière opération annulée.");
  };
  const redo = () => {
    const last = future[future.length - 1];
    if (!last) return;
    setFuture((current) => current.slice(0, -1));
    setHistory((current) => [...current, last]);
    applyAndSave(last.index, last.added);
    setAnnounce("Opération rétablie.");
  };

  const zoom = useCallback((factor: number, anchorX?: number, anchorY?: number) => {
    setView((current) => {
      const nextK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * factor));
      const ratio = nextK / current.k;
      const ax = anchorX ?? 0;
      const ay = anchorY ?? 0;
      return clampViewport({ k: nextK, x: ax - (ax - current.x) * ratio, y: ay - (ay - current.y) * ratio });
    });
  }, []);

  const fit = useCallback(() => setView({ k: 1, x: 0, y: 0 }), []);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, x: view.x, y: view.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      tap.current = null;
      suppressTap.current = Date.now() + 300;
    } else {
      tap.current = { startX: event.clientX, startY: event.clientY, moved: false, pointerId: event.pointerId };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const nextK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.current.k * (distance / Math.max(1, pinch.current.distance))));
      const ratio = nextK / pinch.current.k;
      setView(clampViewport({
        k: nextK,
        x: pinch.current.x + (mx - pinch.current.mx),
        y: pinch.current.y + (my - pinch.current.my),
      }));
      void ratio;
      return;
    }
    if (tap.current && event.pointerId === tap.current.pointerId) {
      const dx = event.clientX - tap.current.startX;
      const dy = event.clientY - tap.current.startY;
      if (!tap.current.moved && Math.hypot(dx, dy) > 7) tap.current.moved = true;
      if (tap.current.moved) {
        setView((current) => clampViewport({ ...current, x: current.x + dx, y: current.y + dy }));
        tap.current.startX = event.clientX;
        tap.current.startY = event.clientY;
      }
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (tap.current && tap.current.pointerId === event.pointerId) {
      const wasTap = !tap.current.moved && Date.now() > suppressTap.current;
      const cell = wasTap ? cellAt(event.clientX, event.clientY) : null;
      tap.current = null;
      if (cell) toggleAt(cell.x, cell.y);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.25); }
    else if (event.key === "-") { event.preventDefault(); zoom(0.8); }
    else if (event.key === "0") { event.preventDefault(); fit(); }
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setCursor((current) => {
        const base = current ?? { x: Math.floor(pattern.size / 2), y: Math.floor(pattern.size / 2) };
        const next = {
          x: Math.max(0, Math.min(pattern.size - 1, base.x + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0))),
          y: Math.max(0, Math.min(pattern.size - 1, base.y + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0))),
        };
        const index = stitchIndex(pattern.size, next.x, next.y);
        const paletteIndex = pattern.cells[index];
        setAnnounce(paletteIndex >= 0
          ? `Colonne ${next.x + 1}, ligne ${next.y + 1}, DMC ${config.palette[paletteIndex]}, ${completed.has(index) ? "brodée" : "restante"}.`
          : `Colonne ${next.x + 1}, ligne ${next.y + 1}, case vide.`);
        return next;
      });
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const current = cursor ?? { x: Math.floor(pattern.size / 2), y: Math.floor(pattern.size / 2) };
      toggleAt(current.x, current.y);
    }
  };

  const resetProgress = () => {
    setCompleted(new Set());
    setHistory([]);
    setFuture([]);
    setConfirmReset(false);
    try {
      saveProgress({ version: 2, fingerprint, completedRuns: "", selectedCode, viewport: view, journal: [], updatedAt: new Date().toISOString() });
    } catch { /* signalé au prochain marquage */ }
    setAnnounce("Progression remise à zéro.");
  };

  const selectedLine = selectedRemaining;
  const colorsUsed = pattern.config.palette.map((code, index) => ({
    code,
    symbol: SYMBOLS[index],
    total: pattern.usage[index]?.count ?? 0,
    remaining: remaining[index]?.remaining ?? 0,
  })).filter((line) => line.total > 0);

  const projectPayload = () => buildProject(pattern, {
    version: 2, fingerprint, completedRuns: serializeRuns(completed), selectedCode, viewport: view, updatedAt: new Date().toISOString(),
  });
  const exportProject = () => {
    persist();
    const payload = projectPayload();
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `rosace-${formatSeed(config.seed)}-${shortFingerprint(fingerprint)}.rosace.json`);
    api.notify("Projet exporté", "Recette + progression, liées à l'empreinte du patron");
  };
  const importProjectFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const result = importProject(parsed);
      if (!result.ok) { api.notify("Projet refusé", result.error); return; }
      saveProgress(result.progress);
      api.commit(result.config);
      setEmbroideryOpen(false);
      api.notify("Projet importé", `Recette et progression restaurées · ${shortFingerprint(result.progress.fingerprint)}`);
    } catch {
      api.notify("Projet illisible", "Le fichier n'est pas un JSON valide.");
    }
  };

  if (!embroideryOpen) return null;

  return (
    <section className="broder" role="dialog" aria-modal="true" aria-label={`Mode broderie, rosace n° ${formatSeed(config.seed)}`}>
      <header className="broder-tete">
        <button ref={closeRef} className="outil outil-icone" onClick={close} aria-label="Fermer le mode broderie et enregistrer la progression">
          <ChevronLeft size={21} aria-hidden="true" />
        </button>
        <div className="broder-titre">
          <strong>Rosace n° {formatSeed(config.seed)}</strong>
          <span>{progress.done.toLocaleString("fr-FR")} / {progress.total.toLocaleString("fr-FR")} · {progress.percent} %</span>
        </div>
        <div className="broder-actions">
          <button className="outil outil-icone" onClick={undo} disabled={!history.length} aria-label="Annuler la dernière croix cochée"><Undo2 size={18} aria-hidden="true" /></button>
          <button className="outil outil-icone" onClick={redo} disabled={!future.length} aria-label="Rétablir la croix décochée"><Redo2 size={18} aria-hidden="true" /></button>
        </div>
      </header>
      <div className="broder-progression" aria-hidden="true"><span style={{ width: `${progress.percent}%` }} /></div>

      <div className="broder-plateau">
        <div ref={wrapRef} className="broder-scene">
          <canvas
            ref={canvasRef}
            className="broder-canvas"
            tabIndex={0}
            role="application"
            aria-label={`Grille de broderie, ${pattern.size} par ${pattern.size} points. Flèches pour déplacer le curseur, Espace ou Entrée pour cocher, plus et moins pour zoomer.`}
            aria-describedby="broder-aide"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onWheel={(event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              zoom(event.deltaY < 0 ? 1.12 : 0.89, event.clientX - rect.left - size.w / 2, event.clientY - rect.top - size.h / 2);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setCursor(null)}
          />
          <div className="broder-zoom" role="group" aria-label="Zoom de la broderie">
            <button className="zoom-bouton" onClick={() => zoom(1.25)} disabled={view.k >= MAX_ZOOM} aria-label="Zoom avant"><Plus size={16} aria-hidden="true" /></button>
            <button className="zoom-bouton broder-jauge" onClick={fit} aria-label="Ajuster la grille à l'écran">{Math.round(view.k * 100)} %</button>
            <button className="zoom-bouton" onClick={() => zoom(0.8)} disabled={view.k <= MIN_ZOOM} aria-label="Zoom arrière"><Minus size={16} aria-hidden="true" /></button>
          </div>
          <p id="broder-aide" className="sr-only">Touchez une croix pour la cocher. Faites glisser pour déplacer. Pincez pour zoomer. Sur ordinateur, utilisez les flèches et Espace.</p>
          <p className="sr-only" aria-live="polite">{announce}</p>
        </div>
      </div>

      <footer className="broder-pied">
        <div className="broder-resume">
          <div>
            <strong>{progress.total - progress.done}</strong> croix restantes
            {selectedLine && <span> · DMC {selectedLine.code} : {selectedLine.remaining}</span>}
          </div>
          <p>Empreinte {shortFingerprint(fingerprint)} · {config.strands} brins · Aïda {config.aida}</p>
        </div>
        <div className="broder-filtres" role="group" aria-label="Affichage de la grille">
          <button className={highlight === "all" ? "is-active" : ""} aria-pressed={highlight === "all"} onClick={() => setHighlight("all")}><Grid3X3 size={14} aria-hidden="true" /> Tout</button>
          <button className={highlight === "remaining" ? "is-active" : ""} aria-pressed={highlight === "remaining"} onClick={() => setHighlight("remaining")}><ListChecks size={14} aria-hidden="true" /> Restants</button>
          <button className={highlight === "thread" ? "is-active" : ""} aria-pressed={highlight === "thread"} onClick={() => setHighlight("thread")} disabled={!selectedCode}>Ce fil</button>
        </div>
        <div className="broder-fils" role="group" aria-label="Choisir un fil DMC à mettre en évidence">
          {colorsUsed.map((line) => {
            const active = highlight === "thread" && line.code === selectedCode;
            return (
              <button
                key={line.code}
                className={`broder-fil ${active ? "is-active" : ""}`}
                aria-pressed={active}
                onClick={() => {
                  setSelectedCode(line.code);
                  setHighlight(active ? "all" : "thread");
                }}
                aria-label={`Mettre en évidence DMC ${line.code}, ${getThread(line.code).name}, ${line.remaining} croix restantes`}
              >
                <i style={{ background: getThread(line.code).hex }} aria-hidden="true">{line.symbol}</i>
                <span>DMC {line.code}</span>
                <small>{line.remaining} rest.</small>
              </button>
            );
          })}
        </div>
        <div className="broder-outils">
          <button className="bouton bouton-petit" onClick={exportProject}><Download size={15} aria-hidden="true" /> Projet</button>
          <button className="bouton bouton-petit" onClick={() => fileRef.current?.click()}><FolderOpen size={15} aria-hidden="true" /> Importer</button>
          {confirmReset ? (
            <button className="bouton bouton-petit broder-danger" onClick={resetProgress}>Confirmer le zéro</button>
          ) : (
            <button className="bouton bouton-petit" onClick={() => setConfirmReset(true)}><RotateCcw size={15} aria-hidden="true" /> Zéro</button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Importer un projet ROSACE"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importProjectFile(file);
              event.target.value = "";
            }}
          />
        </div>
        <p className="broder-note">
          {DMC_ALL_THREADS.length} références DMC disponibles · la progression est liée à l'empreinte {shortFingerprint(fingerprint)} et ne modifie jamais le patron.
          Vérifiez toujours vos échevettes à la lumière naturelle.
        </p>
      </footer>
    </section>
  );
}
