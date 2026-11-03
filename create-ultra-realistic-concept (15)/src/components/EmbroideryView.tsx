import { ChevronLeft, Download, FolderOpen, Grid3X3, ListChecks, Minus, Navigation, Palette, Plus, Redo2, RotateCcw, Undo2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DMC_ALL_THREADS, getThread } from "../data/dmc";
import { chartGeometry, paintPattern, type CanvasMode } from "../lib/paint";
import { shortFingerprint } from "../lib/pattern-id";
import { workTitle } from "../lib/exporters";
import {
  MAX_ZOOM, MIN_ZOOM, clampViewport, emptyProgress, loadPatternProgress, parseRuns, progressPercent,
  progressStorageKey, readPeerProgress, reconcileProgress, remainingByColor, saveProgress, serializeRuns, stitchIndex,
  type EmbroideryProgress, type Viewport,
} from "../lib/progress";
import { computeRhythm, forecast, formatMinutes, recordStitches, type StitchSession } from "../lib/sessions";
import { readThreadBox } from "../lib/threadbox";
import { useRosaceApi } from "../state/rosace-store";

const BASE = 1800;

function luminanceOf(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return ((value >> 16) & 255) * 0.2126 + ((value >> 8) & 255) * 0.7152 + (value & 255) * 0.0722;
}

type Highlight = "all" | "thread" | "remaining";
/** Affichage de la grille : symboles (lecture classique), couleurs des fils, ou les deux. Mémorisé par appareil. */
type Display = "symbols" | "colors" | "both" | "fabric";
const DISPLAY_KEY = "aime-rosace-broder-affichage-v1";
const DISPLAY_MODE: Record<Display, CanvasMode> = { symbols: "chart", colors: "color", both: "color-chart", fabric: "chart" };
function readDisplay(): Display {
  try {
    const stored = localStorage.getItem(DISPLAY_KEY);
    return stored === "colors" || stored === "both" || stored === "fabric" ? stored : "symbols";
  } catch { return "symbols"; }
}
const PEER_KEY = (fingerprint: string) => `aime-rosace-amie-v1:${fingerprint}`;

/** Fil conducteur : la zone compacte de croix restantes la plus proche d'un point, pour un fil donné (composante connexe, 8 voisins). */
function nearestCluster(pattern: { width: number; height: number; cells: Int16Array }, completed: Set<number>, paletteIndex: number, from: { x: number; y: number }): { cells: number[]; nearest: { x: number; y: number } } | null {
  const { width, height, cells } = pattern;
  let best: { index: number; d: number } | null = null;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = y * width + x;
    if (cells[index] !== paletteIndex || completed.has(index)) continue;
    const d = (x - from.x) ** 2 + (y - from.y) ** 2;
    if (!best || d < best.d) best = { index, d };
  }
  if (!best) return null;
  const seen = new Set<number>([best.index]);
  const queue = [best.index];
  while (queue.length && seen.size < 4000) {
    const index = queue.shift()!;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (seen.has(next) || cells[next] !== paletteIndex || completed.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return { cells: [...seen], nearest: { x: best.index % width, y: Math.floor(best.index / width) } };
}
interface Tap { startX: number; startY: number; moved: boolean; pointerId: number }

/**
 * Mode BRODERIE.
 * Le patron est immuable : cette vue ne modifie jamais `pattern`.
 * La progression (cases cochées, fil sélectionné, dernière vue) est stockée
 * séparément sous l'empreinte exacte du patron.
 */
export function EmbroideryView() {
  const { work: pattern, embroideryOpen, setEmbroideryOpen, progressRevision, notify, exportActions } = useRosaceApi();
  const fingerprint = pattern.fingerprint;
  /** Codes DMC de l'ouvrage, dans l'ordre de la palette (rosace : 3 à 6 fils ; patron importé : autant que nécessaire). */
  const paletteCodes = useMemo(() => pattern.palette.map((entry) => entry.code), [pattern]);
  const config = useMemo(() => ({ palette: paletteCodes, ...pattern.textile }), [paletteCodes, pattern.textile]);
  const symbolOf = (index: number) => pattern.palette[index]?.symbol ?? "·";
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
  const [display, setDisplay] = useState<Display>(readDisplay);
  const [history, setHistory] = useState<Array<{ index: number; added: boolean }>>([]);
  const [future, setFuture] = useState<Array<{ index: number; added: boolean }>>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [sessions, setSessions] = useState<StitchSession[]>([]);
  const [guide, setGuide] = useState(true);
  const [peer, setPeer] = useState<{ completed: Set<number>; updatedAt: string } | null>(null);
  const [threadBox] = useState<Set<string>>(() => readThreadBox());
  const peerRef = useRef<HTMLInputElement>(null);
  const fabricRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; k: number; x: number; y: number; mx: number; my: number } | null>(null);
  const tap = useRef<Tap | null>(null);
  const suppressTap = useRef(0);
  const liveRef = useRef({ completed, selectedCode, view, history, sessions });
  liveRef.current = { completed, selectedCode, view, history, sessions };

  const progress = useMemo(() => progressPercent(pattern, completed), [pattern, completed]);
  const remaining = useMemo(() => remainingByColor(pattern, completed), [pattern, completed]);
  const selectedRemaining = selectedCode ? remaining.find((line) => line.code === selectedCode) : null;
  const rhythm = useMemo(() => computeRhythm(sessions), [sessions]);
  const prediction = useMemo(() => forecast(rhythm, progress.total - progress.done, sessions), [rhythm, progress.total, progress.done, sessions]);
  /** Fil conducteur : prochaine zone compacte du fil sélectionné, depuis le curseur ou la dernière croix. */
  const nextZone = useMemo(() => {
    if (!guide || !selectedCode) return null;
    const paletteIndex = paletteCodes.indexOf(selectedCode);
    if (paletteIndex < 0) return null;
    const last = history.length ? history[history.length - 1].index : -1;
    const from = cursor ?? (last >= 0 ? { x: last % pattern.width, y: Math.floor(last / pattern.width) } : { x: Math.floor(pattern.width / 2), y: Math.floor(pattern.height / 2) });
    return nearestCluster(pattern, completed, paletteIndex, from);
  }, [guide, selectedCode, paletteCodes, history, cursor, pattern, completed]);
  const peerDone = peer ? [...peer.completed].filter((index) => pattern.cells[index] >= 0).length : 0;

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
      sessions,
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
  }, [completed, fingerprint, history, notify, selectedCode, sessions, view]);

  /** Toute modification de croix passe par ici : état, journal, séances et stockage restent cohérents. */
  const commitProgress = useCallback((next: {
    completed: Set<number>;
    history: Array<{ index: number; added: boolean }>;
    future: Array<{ index: number; added: boolean }>;
  }) => {
    const added = Math.max(0, next.completed.size - completed.size);
    const nextSessions = recordStitches(sessions, added);
    setCompleted(next.completed);
    setHistory(next.history);
    setFuture(next.future);
    setSessions(nextSessions);
    persist({
      version: 2,
      fingerprint,
      completedRuns: serializeRuns(next.completed),
      selectedCode,
      viewport: view,
      journal: next.history,
      sessions: nextSessions,
      updatedAt: new Date().toISOString(),
    });
  }, [completed.size, fingerprint, persist, selectedCode, sessions, view]);

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
      // Fil conducteur : le fil choisi explicitement est conservé ; à défaut, celui de la dernière croix cochée.
      const lastEntry = saved.journal?.length ? saved.journal[saved.journal.length - 1] : null;
      const lastCode = lastEntry && pattern.cells[lastEntry.index] >= 0 ? config.palette[pattern.cells[lastEntry.index]] : null;
      const savedCode = saved.selectedCode && config.palette.includes(saved.selectedCode) ? saved.selectedCode : null;
      setSelectedCode(savedCode ?? lastCode ?? config.palette[0] ?? null);
      setView(clampViewport(saved.viewport));
      setAnnounce(`Progression restaurée : ${valid.size} croix sur ${pattern.stitches.length}.${savedCode ?? lastCode ? ` Fil en cours DMC ${savedCode ?? lastCode}.` : ""}`);
    } else {
      setCompleted(new Set());
      setSelectedCode(config.palette[0] ?? null);
      setView({ k: 1, x: 0, y: 0 });
      setAnnounce("Nouvelle progression pour ce patron.");
    }
    setHistory(saved?.journal ?? []);
    setSessions(saved?.sessions ?? []);
    setFuture([]);
    try {
      const rawPeer = localStorage.getItem(PEER_KEY(fingerprint));
      if (rawPeer) {
        const parsed = JSON.parse(rawPeer) as { runs?: string; updatedAt?: string };
        setPeer(parsed.runs ? { completed: parseRuns(parsed.runs), updatedAt: parsed.updatedAt ?? "" } : null);
      } else setPeer(null);
    } catch { setPeer(null); }
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
        sessions: live.sessions,
        updatedAt: new Date().toISOString(),
      };
      const merged = reconcileProgress(remote, localSnapshot, baseProgressRef.current);
      suppressSaveRef.current = true;
      setCompleted(parseRuns(merged.completedRuns));
      setHistory(merged.journal ?? []);
      setSessions(merged.sessions ?? []);
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
    paintPattern(base, pattern, DISPLAY_MODE[display], BASE);
    baseRef.current = base;
    if (display === "fabric") {
      // Toile qui se remplit : la toile photoréaliste sert de réserve, copiée case par case pour les croix brodées.
      const fabric = document.createElement("canvas");
      fabric.width = BASE;
      fabric.height = BASE;
      paintPattern(fabric, pattern, "fabric", BASE);
      fabricRef.current = fabric;
    } else fabricRef.current = null;
    draw();
    try { localStorage.setItem(DISPLAY_KEY, display); } catch { /* préférence d'affichage seulement */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embroideryOpen, pattern, display]);

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
    chart: chartGeometry(BASE, pattern.width, pattern.height, "chart"),
    fabric: chartGeometry(BASE, pattern.width, pattern.height, "fabric"),
  }), [pattern.width, pattern.height, size]);

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

    const toBase = (x: number, y: number) => ({ bx: -BASE / 2 + chart.originX + x * chart.cell, by: -BASE / 2 + chart.originY + y * chart.cell });
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
        const index = stitchIndex(pattern.width, stitch.x, stitch.y);
        if (completed.has(index)) continue;
        ctx.fillStyle = getThread(config.palette[selectedIndex]).hex;
        ctx.fillRect(bx - cell / 2, by - cell / 2, cell + 0.35, cell + 0.35);
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.font = `${Math.round(cell * 0.8)}px "Inter Tight", Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(symbolOf(selectedIndex), bx, by + 0.5);
      }
    }

    // Fil conducteur : la prochaine zone compacte du fil en cours, en halo.
    if (nextZone && highlight !== "remaining") {
      ctx.fillStyle = "rgba(111,63,98,0.22)";
      for (const index of nextZone.cells) {
        const { bx, by } = toBase(index % pattern.width, Math.floor(index / pattern.width));
        ctx.fillRect(bx - cell / 2, by - cell / 2, cell, cell);
      }
      const { bx, by } = toBase(nextZone.nearest.x, nextZone.nearest.y);
      ctx.strokeStyle = "rgba(111,63,98,0.95)";
      ctx.lineWidth = Math.max(1.2, cell * 0.16);
      ctx.strokeRect(bx - cell / 2 - 1, by - cell / 2 - 1, cell + 2, cell + 2);
    }

    // Broder ensemble : les croix de l'amie, en contour, jamais confondues avec les miennes.
    if (peer) {
      ctx.strokeStyle = "rgba(20,120,110,0.85)";
      ctx.lineWidth = Math.max(0.8, cell * 0.12);
      for (const index of peer.completed) {
        if (pattern.cells[index] < 0 || completed.has(index)) continue;
        const { bx, by } = toBase(index % pattern.width, Math.floor(index / pattern.width));
        ctx.strokeRect(bx - cell / 2 + 1, by - cell / 2 + 1, cell - 2, cell - 2);
      }
    }

    // Croix brodées : remplissage couleur du fil, symbole masqué ; en mode toile, le vrai fil bombé.
    const fabricBase = fabricRef.current;
    const fabricGeometry = geometry.fabric;
    for (const index of completed) {
      const x = index % pattern.width;
      const y = Math.floor(index / pattern.width);
      const paletteIndex = pattern.cells[index];
      if (paletteIndex < 0) continue;
      const { bx, by } = toBase(x, y);
      if (highlight === "remaining") {
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.fillRect(bx - cell / 2, by - cell / 2, cell, cell);
        continue;
      }
      if (highlight === "thread" && paletteIndex !== selectedIndex) continue;
      const hex = getThread(config.palette[paletteIndex]).hex;
      if (display === "fabric" && fabricBase) {
        const sx = fabricGeometry.originX + x * fabricGeometry.cell - fabricGeometry.cell / 2;
        const sy = fabricGeometry.originY + y * fabricGeometry.cell - fabricGeometry.cell / 2;
        ctx.drawImage(fabricBase, sx, sy, fabricGeometry.cell, fabricGeometry.cell, bx - cell / 2, by - cell / 2, cell, cell);
      } else if (display === "symbols") {
        ctx.fillStyle = hex;
        ctx.fillRect(bx - cell / 2, by - cell / 2, cell + 0.35, cell + 0.35);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 0.9;
        ctx.strokeRect(bx - cell / 2, by - cell / 2, cell, cell);
      } else {
        // La case est déjà de la couleur du fil : une croix brodée se reconnaît à son trait diagonal net.
        ctx.strokeStyle = luminanceOf(hex) > 150 ? "rgba(20,14,18,0.9)" : "rgba(255,255,255,0.92)";
        ctx.lineWidth = Math.max(0.8, cell * 0.14);
        ctx.beginPath();
        ctx.moveTo(bx - cell * 0.32, by - cell * 0.32);
        ctx.lineTo(bx + cell * 0.32, by + cell * 0.32);
        ctx.moveTo(bx - cell * 0.32, by + cell * 0.32);
        ctx.lineTo(bx + cell * 0.32, by - cell * 0.32);
        ctx.stroke();
      }
    }

    if (cursor) {
      const { bx, by } = toBase(cursor.x, cursor.y);
      ctx.strokeStyle = "#141214";
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - cell / 2 - 1, by - cell / 2 - 1, cell + 2, cell + 2);
    }
    ctx.restore();
  }, [completed, config.palette, cursor, display, geometry, highlight, nextZone, pattern, peer, selectedCode, size, view]);

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
    const x = Math.round((bx - chart.originX) / chart.cell);
    const y = Math.round((by - chart.originY) / chart.cell);
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return null;
    return { x, y };
  }, [geometry, pattern.width, pattern.height, view.k, view.x, view.y]);

  const toggleAt = useCallback((x: number, y: number) => {
    const index = stitchIndex(pattern.width, x, y);
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
        const base = current ?? { x: Math.floor(pattern.width / 2), y: Math.floor(pattern.height / 2) };
        const next = {
          x: Math.max(0, Math.min(pattern.width - 1, base.x + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0))),
          y: Math.max(0, Math.min(pattern.height - 1, base.y + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0))),
        };
        const index = stitchIndex(pattern.width, next.x, next.y);
        const paletteIndex = pattern.cells[index];
        setAnnounce(paletteIndex >= 0
          ? `Colonne ${next.x + 1}, ligne ${next.y + 1}, DMC ${config.palette[paletteIndex]}, ${completed.has(index) ? "brodée" : "restante"}.`
          : `Colonne ${next.x + 1}, ligne ${next.y + 1}, case vide.`);
        return next;
      });
    } else if (event.key === " " || event.key === "Enter") {
      handled();
      const current = cursor ?? { x: Math.floor(pattern.width / 2), y: Math.floor(pattern.height / 2) };
      toggleAt(current.x, current.y);
    }
  };

  /** Fil conducteur : amène le curseur et la vue sur la prochaine croix du fil en cours. */
  const goNext = () => {
    if (!nextZone) {
      setAnnounce(selectedCode ? `Toutes les croix de DMC ${selectedCode} sont brodées.` : "Choisissez un fil.");
      return;
    }
    const { x, y } = nextZone.nearest;
    setCursor({ x, y });
    const { fit, chart } = geometry;
    const scale = fit * Math.max(view.k, 2.5);
    const bx = -BASE / 2 + chart.originX + x * chart.cell;
    const by = -BASE / 2 + chart.originY + y * chart.cell;
    setView(clampViewport({ k: Math.max(view.k, 2.5), x: -bx * scale, y: -by * scale }));
    canvasRef.current?.focus();
    setAnnounce(`Prochaine zone : ${nextZone.cells.length} croix de DMC ${selectedCode} à partir de la colonne ${x + 1}, ligne ${y + 1}.`);
  };

  const importPeer = async (file: File) => {
    try {
      const result = readPeerProgress(JSON.parse(await file.text()), pattern);
      if (!result.ok) { notify("Projet refusé", result.error); return; }
      setPeer({ completed: result.completed, updatedAt: result.updatedAt });
      try { localStorage.setItem(PEER_KEY(fingerprint), JSON.stringify({ runs: serializeRuns(result.completed), updatedAt: result.updatedAt })); } catch { /* calque de séance seulement */ }
      notify("Vous brodez ensemble", `${result.completed.size.toLocaleString("fr-FR")} croix de votre amie affichées en contour. Votre progression n'a pas changé.`);
    } catch { notify("Projet illisible", "Le fichier n'est pas un JSON valide."); }
  };
  const clearPeer = () => {
    setPeer(null);
    try { localStorage.removeItem(PEER_KEY(fingerprint)); } catch { /* rien à retirer */ }
  };

  const resetProgress = () => {
    commitProgress({ completed: new Set(), history: [], future: [] });
    setConfirmReset(false);
    setAnnounce("Progression remise à zéro.");
  };

  const selectedLine = selectedRemaining;
  const colorsUsed = pattern.palette.map(({ code, symbol }, index) => ({
    code,
    symbol,
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
    sessions,
    updatedAt: new Date().toISOString(),
  });
  const exportProject = () => {
    const snapshot = projectSnapshot();
    persist(snapshot);
    exportActions.project(snapshot);
  };

  if (!embroideryOpen) return null;

  return (
    <section className="broder" role="dialog" aria-modal="true" aria-label={`Mode broderie, ${workTitle(pattern)}`}>
      <header className="broder-tete">
        <button ref={closeRef} className="outil outil-icone" onClick={close} aria-label="Fermer le mode broderie et enregistrer la progression">
          <ChevronLeft size={21} aria-hidden="true" />
        </button>
        <div className="broder-titre">
          <strong>{workTitle(pattern)}</strong>
          <span>{progress.done.toLocaleString("fr-FR")} / {progress.total.toLocaleString("fr-FR")} · {progress.percent} %</span>
        </div>
        <div className="broder-actions">
          <button className="outil broder-suivante" onClick={goNext} disabled={!selectedCode} aria-label="Aller à la prochaine zone du fil en cours"><Navigation size={16} aria-hidden="true" /><span>Suivante</span></button>
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
            aria-label={`Grille de broderie, ${pattern.width} par ${pattern.height} points. Flèches pour déplacer le curseur, Espace ou Entrée pour cocher, plus et moins pour zoomer.`}
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
            {nextZone && <span> · prochaine zone : {nextZone.cells.length}</span>}
          </div>
          <p>
            {prediction
              ? `À votre rythme (${rhythm.stitchesPerHour} croix/h) : ${formatMinutes(prediction.low)} à ${formatMinutes(prediction.high)} restantes${prediction.finishDate ? `, vers le ${prediction.finishDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}`
              : `${rhythm.minutes > 0 ? `${formatMinutes(rhythm.minutes)} brodées · ` : ""}Empreinte ${shortFingerprint(fingerprint)} · ${config.strands} brins · Aïda ${config.aida}`}
          </p>
        </div>
        {peer && (
          <p className="broder-amie" role="status">
            <Users size={14} aria-hidden="true" /> Votre amie : <strong>{peerDone.toLocaleString("fr-FR")}</strong> / {progress.total.toLocaleString("fr-FR")} croix, en contour vert{peer.updatedAt ? ` (${new Date(peer.updatedAt).toLocaleDateString("fr-FR")})` : ""}.
            <button type="button" onClick={clearPeer}>Retirer</button>
          </p>
        )}
        <div className="broder-filtres-ligne">
          <div className="broder-filtres" role="group" aria-label="Croix affichées">
            <button className={highlight === "all" ? "is-active" : ""} aria-pressed={highlight === "all"} onClick={() => setHighlight("all")}><Grid3X3 size={14} aria-hidden="true" /> Tout</button>
            <button className={highlight === "remaining" ? "is-active" : ""} aria-pressed={highlight === "remaining"} onClick={() => setHighlight("remaining")}><ListChecks size={14} aria-hidden="true" /> Restants</button>
            <button className={highlight === "thread" ? "is-active" : ""} aria-pressed={highlight === "thread"} onClick={() => setHighlight("thread")} disabled={!selectedCode}>Ce fil</button>
          </div>
          <div className="broder-filtres" role="group" aria-label="Lecture de la grille">
            <button className={display === "symbols" ? "is-active" : ""} aria-pressed={display === "symbols"} onClick={() => setDisplay("symbols")}>Symboles</button>
            <button className={display === "colors" ? "is-active" : ""} aria-pressed={display === "colors"} onClick={() => setDisplay("colors")}><Palette size={14} aria-hidden="true" /> Couleurs</button>
            <button className={display === "both" ? "is-active" : ""} aria-pressed={display === "both"} onClick={() => setDisplay("both")}>Les deux</button>
            <button className={display === "fabric" ? "is-active" : ""} aria-pressed={display === "fabric"} onClick={() => setDisplay("fabric")}>Toile</button>
          </div>
          <div className="broder-filtres" role="group" aria-label="Fil conducteur">
            <button className={guide ? "is-active" : ""} aria-pressed={guide} onClick={() => setGuide((value) => !value)}><Navigation size={14} aria-hidden="true" /> Fil conducteur</button>
          </div>
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
                aria-label={`Mettre en évidence DMC ${line.code}, ${getThread(line.code).name}, ${line.remaining} croix restantes${threadBox.size ? (threadBox.has(line.code) ? ", dans votre boîte" : ", manque dans votre boîte") : ""}`}
              >
                <i style={{ background: getThread(line.code).hex }} aria-hidden="true">{line.symbol}</i>
                <span>DMC {line.code}{threadBox.size > 0 && <em className={threadBox.has(line.code) ? "is-owned" : "is-missing"} aria-hidden="true">{threadBox.has(line.code) ? "✓" : "manque"}</em>}</span>
                <small>{line.remaining} rest.</small>
              </button>
            );
          })}
        </div>
        <div className="broder-outils">
          <button className="bouton bouton-petit" onClick={exportProject}><Download size={15} aria-hidden="true" /> Projet</button>
          <button className="bouton bouton-petit" onClick={() => fileRef.current?.click()}><FolderOpen size={15} aria-hidden="true" /> Importer</button>
          <button className="bouton bouton-petit" onClick={() => peerRef.current?.click()}><Users size={15} aria-hidden="true" /> Broder ensemble</button>
          <input
            ref={peerRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Afficher la progression d'une amie sur ce même ouvrage"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importPeer(file);
              event.target.value = "";
            }}
          />
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
