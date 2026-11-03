import { ChevronLeft, Download, FolderOpen, Grid3X3, ListChecks, Minus, Plus, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DMC_ALL_THREADS, getThread } from "../data/dmc";
import { chartGeometry, paintPattern } from "../lib/paint";
import { patternFingerprint, shortFingerprint } from "../lib/pattern-id";
import { SYMBOLS } from "../lib/rosace";
import {
  MAX_ZOOM, MIN_ZOOM, clampViewport, emptyProgress, loadPatternProgress, parseRuns, progressPercent,
  progressStorageKey, reconcileProgress, remainingByColor, saveProgress, serializeRuns, stitchIndex,
  type EmbroideryProgress, type Viewport,
} from "../lib/progress";
import { formatSeed, useRosaceApi } from "../state/rosace-store";

const BASE = 1800;

type Highlight = "all" | "thread" | "remaining";
interface Tap { startX: number; startY: number; moved: boolean; pointerId: number }

/**
 * Mode BRODERIE.
 * Le patron est immuable : cette vue ne modifie jamais `pattern`.
 * La progression (cases cochées, fil sélectionné, dernière vue) est stockée
 * séparément sous l'empreinte exacte du patron.
 */
export function EmbroideryView() {
  const { pattern, config, embroideryOpen, setEmbroideryOpen, progressRevision, notify, exportActions } = useRosaceApi();
  const fingerprint = useMemo(() => patternFingerprint(pattern), [pattern]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hydrated = useRef(false);
  const storageWarned = useRef(false);
  const saveTimer = useRef<number | null>(null);
  /** Dernier état connu du stockage : sert de base à la fusion entre onglets. */
  const baseProgressRef = useRef<EmbroideryProgress | null>(null);
  /** Évite une réécriture immédiate après l'intégration d'un événement `storage`. */
  const suppressSaveRef = useRef(false);

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
  const liveRef = useRef({ completed, selectedCode, view, history });
  liveRef.current = { completed, selectedCode, view, history };

  const progress = useMemo(() => progressPercent(pattern, completed), [pattern, completed]);
  const remaining = useMemo(() => remainingByColor(pattern, completed), [pattern, completed]);
  const selectedRemaining = selectedCode ? remaining.find((line) => line.code === selectedCode) : null;

  /* ---------- Progression : une seule écriture canonique ---------- */
  const persist = useCallback((snapshot?: EmbroideryProgress): EmbroideryProgress | null => {
    if (!hydrated.current) return null;
    const record: EmbroideryProgress = snapshot ?? {
      version: 2,
      fingerprint,
      completedRuns: serializeRuns(completed),
      selectedCode,
      viewport: view,
      journal: history,
      updatedAt: new Date().toISOString(),
    };
    if (record.fingerprint !== fingerprint) return null;
    try {
      const saved = saveProgress(record, baseProgressRef.current);
      baseProgressRef.current = saved;
      return saved;
    } catch {
      if (!storageWarned.current) {
        storageWarned.current = true;
        notify("Progression non enregistrée", "Le stockage du navigateur est plein ou indisponible.");
      }
      return null;
    }
  }, [completed, fingerprint, history, notify, selectedCode, view]);

  /** Toute modification de croix passe par ici : état, journal et stockage restent cohérents. */
  const commitProgress = useCallback((next: {
    completed: Set<number>;
    history: Array<{ index: number; added: boolean }>;
    future: Array<{ index: number; added: boolean }>;
  }) => {
    setCompleted(next.completed);
    setHistory(next.history);
    setFuture(next.future);
    persist({
      version: 2,
      fingerprint,
      completedRuns: serializeRuns(next.completed),
      selectedCode,
      viewport: view,
      journal: next.history,
      updatedAt: new Date().toISOString(),
    });
  }, [fingerprint, persist, selectedCode, view]);

  const close = useCallback(() => {
    persist();
    setEmbroideryOpen(false);
    notify(`Progression enregistrée · ${progress.percent} %`, `${progress.done.toLocaleString("fr-FR")} / ${progress.total.toLocaleString("fr-FR")} croix`);
  }, [notify, persist, progress.done, progress.percent, progress.total, setEmbroideryOpen]);
  const closeActionRef = useRef<() => void>(() => {});
  closeActionRef.current = close;

  /* ---------- Chargement validé, séparé du patron ---------- */
  useEffect(() => {
    if (!embroideryOpen) return;
    const saved = loadPatternProgress(pattern);
    if (saved) {
      const valid = parseRuns(saved.completedRuns);
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
    setHistory(saved?.journal ?? []);
    setFuture([]);
    baseProgressRef.current = saved ?? emptyProgress(pattern);
    suppressSaveRef.current = false;
    hydrated.current = true;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 80);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeActionRef.current();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      hydrated.current = false;
    };
    // volontairement lié à l'empreinte et à l'import : une nouvelle recette recharge sa progression
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embroideryOpen, fingerprint, progressRevision]);

  useEffect(() => {
    if (!embroideryOpen || !hydrated.current) return;
    if (suppressSaveRef.current) {
      suppressSaveRef.current = false;
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      persist();
    }, 350);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [completed, selectedCode, view, history, persist, embroideryOpen]);

  /** Un autre onglet a écrit : on fusionne les croix au lieu d'écraser la progression locale. */
  useEffect(() => {
    if (!embroideryOpen) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== progressStorageKey(fingerprint)) return;
      const remote = loadPatternProgress(pattern);
      if (!remote) return;
      const live = liveRef.current;
      const localSnapshot: EmbroideryProgress = {
        version: 2,
        fingerprint,
        completedRuns: serializeRuns(live.completed),
        selectedCode: live.selectedCode,
        viewport: live.view,
        journal: live.history,
        updatedAt: new Date().toISOString(),
      };
      const merged = reconcileProgress(remote, localSnapshot, baseProgressRef.current);
      suppressSaveRef.current = true;
      setCompleted(parseRuns(merged.completedRuns));
      setHistory(merged.journal ?? []);
      setSelectedCode(merged.selectedCode);
      setView(merged.viewport);
      baseProgressRef.current = remote;
      notify("Progression synchronisée", "Un autre onglet a modifié cet ouvrage : les croix ont été fusionnées.");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [embroideryOpen, fingerprint, notify, pattern]);

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
    const nextCompleted = new Set(completed);
    if (added) nextCompleted.add(index); else nextCompleted.delete(index);
    commitProgress({
      completed: nextCompleted,
      history: [...history.slice(-99), { index, added }],
      future: [],
    });
    const color = getThread(config.palette[pattern.cells[index]]);
    setAnnounce(`Colonne ${x + 1}, ligne ${y + 1}, DMC ${color.code} : ${added ? "marquée brodée" : "démarquée"}.`);
  }, [commitProgress, completed, config.palette, history, pattern]);

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    const nextCompleted = new Set(completed);
    if (last.added) nextCompleted.delete(last.index); else nextCompleted.add(last.index);
    commitProgress({
      completed: nextCompleted,
      history: history.slice(0, -1),
      future: [...future, last],
    });
    setAnnounce("Dernière opération annulée.");
  };
  const redo = () => {
    const last = future[future.length - 1];
    if (!last) return;
    const nextCompleted = new Set(completed);
    if (last.added) nextCompleted.add(last.index); else nextCompleted.delete(last.index);
    commitProgress({
      completed: nextCompleted,
      history: [...history.slice(-99), last],
      future: future.slice(0, -1),
    });
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
      setView(clampViewport({
        k: nextK,
        x: pinch.current.x + (mx - pinch.current.mx),
        y: pinch.current.y + (my - pinch.current.my),
      }));
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
    const key = event.key.toLowerCase();
    // Les raccourcis du tambour et de la recette ne doivent pas agir derrière la Broderie.
    const handled = () => { event.preventDefault(); event.stopPropagation(); };
    if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
      handled();
      if (key === "y" || (key === "z" && event.shiftKey)) redo(); else undo();
    }
    else if (event.key === "+" || event.key === "=") { handled(); zoom(1.25); }
    else if (event.key === "-") { handled(); zoom(0.8); }
    else if (event.key === "0") { handled(); fit(); }
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      handled();
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
      handled();
      const current = cursor ?? { x: Math.floor(pattern.size / 2), y: Math.floor(pattern.size / 2) };
      toggleAt(current.x, current.y);
    }
  };

  const resetProgress = () => {
    commitProgress({ completed: new Set(), history: [], future: [] });
    setConfirmReset(false);
    setAnnounce("Progression remise à zéro.");
  };

  const selectedLine = selectedRemaining;
  const colorsUsed = pattern.config.palette.map((code, index) => ({
    code,
    symbol: SYMBOLS[index],
    total: pattern.usage[index]?.count ?? 0,
    remaining: remaining[index]?.remaining ?? 0,
  })).filter((line) => line.total > 0);

  /** Instantané complet, journal compris : le même service de projet sert les deux points d'entrée. */
  const projectSnapshot = (): EmbroideryProgress => ({
    version: 2,
    fingerprint,
    completedRuns: serializeRuns(completed),
    selectedCode,
    viewport: view,
    journal: history,
    updatedAt: new Date().toISOString(),
  });
  const exportProject = () => {
    const snapshot = projectSnapshot();
    persist(snapshot);
    exportActions.project(snapshot);
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
              if (file) void exportActions.projectImport(file);
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
