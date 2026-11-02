import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getThread, type ThreadFamily } from "../data/dmc";
import type { ToastMessage } from "../components/Overlays";
import { auditPalette } from "../lib/color";
import { harmonyCodes, type Harmony } from "../lib/harmony";
import { exportPng, exportSvg, exportThreadCsv, printWorksheet } from "../lib/exporters";
import {
  DEFAULT_CONFIG, FABRIC_COLORS, decodeConfig, encodeConfig, generateRosace, normalizeConfig, sameRecipe,
  type AidaCount, type DimensionKey, type FabricTone, type RosaceConfig, type SavedRosace,
} from "../lib/rosace";

/**
 * Source de vérité de l'interface. Une recette (RosaceConfig) → un ouvrage calculé (pattern) →
 * toutes les représentations : tambour, grille, fiche, bibliothèque, PDF et exports.
 * Rien d'autre n'est recalculé ailleurs.
 */
const CURRENT_KEY = "aime-rosace-current-v1";
const FAVORITES_KEY = "aime-rosace-favorites-v1";

export type FamilyFilter = ThreadFamily | "toutes";
/** Catégories du dock dont les réglages s'affichent dans le panneau. Grille et Collection sont des actions. */
export type PanelId = "forme" | "couleurs" | "reglages" | "export";
export interface CatalogState { open: boolean; intent: "replace" | "add"; family: FamilyFilter }

export function formatSeed(seed: number) {
  return String(seed).padStart(3, "0");
}

function readInitialConfig(): RosaceConfig {
  const shared = window.location.hash.match(/^#r=([A-Za-z0-9_-]+)/)?.[1];
  if (shared) {
    const decoded = decodeConfig(shared);
    if (decoded) return decoded;
  }
  try {
    const stored = localStorage.getItem(CURRENT_KEY);
    if (stored) return normalizeConfig(JSON.parse(stored));
  } catch { /* Un stockage indisponible ne bloque pas l'instrument. */ }
  return normalizeConfig(DEFAULT_CONFIG);
}

function readFavorites(): SavedRosace[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    const entries = JSON.parse(stored);
    if (!Array.isArray(entries)) return [];
    return entries.slice(0, 24).map((entry, index) => ({
      id: typeof entry.id === "string" ? entry.id : `saved-${index}`,
      name: typeof entry.name === "string" ? entry.name : `Rosace ${index + 1}`,
      config: normalizeConfig(entry.config),
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
      stitches: Number(entry.stitches) || 0,
    }));
  } catch { return []; }
}

function nextSeed(current: number) {
  const values = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(values);
  else values[0] = Math.floor(Math.random() * 0xffffffff);
  const seed = (values[0] % 9999) + 1;
  return seed === current ? (seed % 9999) + 1 : seed;
}

export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToSequence(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

function useRosaceState() {
  const [config, setConfigState] = useState<RosaceConfig>(readInitialConfig);
  const configRef = useRef(config);
  const historyRef = useRef<RosaceConfig[]>([]);
  const futureRef = useRef<RosaceConfig[]>([]);
  const [future, setFuture] = useState<RosaceConfig[]>([]);
  const gesture = useRef({ active: false, pushed: false });
  const [history, setHistory] = useState<RosaceConfig[]>([]);
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [inspectCode, setInspectCode] = useState<string | null>(null);
  const [activeDimension, setActiveDimension] = useState<DimensionKey>("structure");
  const [favorites, setFavorites] = useState<SavedRosace[]>(readFavorites);
  const [embroideryOpen, setEmbroideryOpen] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [loupeOpen, setLoupeOpen] = useState(false);
  const [harmony, setHarmony] = useState<Harmony>("complementaire");
  const [catalog, setCatalog] = useState<CatalogState>({ open: false, intent: "replace", family: "toutes" });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastId = useRef(0);

  const pattern = useMemo(() => generateRosace(config), [config]);
  const activeIndex = Math.min(activeColorIndex, config.palette.length - 1);
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;
  const inspectedCode = inspectCode ?? config.palette[activeIndex];
  const warnings = useMemo(
    () => auditPalette(config.palette, FABRIC_COLORS[config.fabric].base, FABRIC_COLORS[config.fabric].name),
    [config.palette, config.fabric],
  );
  const baseCode = config.palette[2] ?? config.palette[0];
  const paletteStops = config.palette.map((code, role) => ({ code, role, thread: getThread(code) }));
  const configSignature = JSON.stringify(config);
  const savedCurrent = favorites.find((entry) => sameRecipe(entry.config, config));
  const shareUrl = `${window.location.origin}${window.location.pathname}#r=${encodeConfig(config)}`;

  const notify = useCallback((title: string, detail?: string) => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, title, detail }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3800);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CURRENT_KEY, configSignature); } catch { /* Mode privé : la séance reste utilisable. */ }
  }, [configSignature]);
  useEffect(() => {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* Les favoris restent disponibles pendant la séance. */ }
  }, [favorites]);
  useEffect(() => {
    if (window.location.hash.startsWith("#r=")) window.setTimeout(() => scrollToSequence("composer"), 250);
  }, []);

  /** Unique point d'entrée de modification de la recette. Un geste continu (glisser une poignée) = une seule entrée d'historique. */
  const commit = useCallback((next: RosaceConfig) => {
    const current = configRef.current;
    const normalized = normalizeConfig(next);
    if (JSON.stringify(normalized) === JSON.stringify(current)) return;
    const flow = gesture.current;
    if (!(flow.active && flow.pushed)) {
      historyRef.current = [...historyRef.current.slice(-29), current];
      setHistory(historyRef.current);
    }
    if (flow.active) flow.pushed = true;
    futureRef.current = [];
    setFuture([]);
    configRef.current = normalized;
    setConfigState(normalized);
  }, []);

  const beginGesture = useCallback(() => { gesture.current = { active: true, pushed: false }; }, []);
  const endGesture = useCallback(() => { gesture.current = { active: false, pushed: false }; }, []);

  const setDimension = useCallback((key: DimensionKey, value: number) => {
    commit({ ...configRef.current, [key]: value });
  }, [commit]);

  const undo = useCallback(() => {
    const entries = historyRef.current;
    if (!entries.length) return;
    const previous = entries[entries.length - 1];
    historyRef.current = entries.slice(0, -1);
    setHistory(historyRef.current);
    futureRef.current = [...futureRef.current.slice(-29), configRef.current];
    setFuture(futureRef.current);
    configRef.current = previous;
    setConfigState(previous);
    setInspectCode(null);
    notify("Version précédente restaurée");
  }, [notify]);

  const redo = useCallback(() => {
    const entries = futureRef.current;
    if (!entries.length) return;
    const next = entries[entries.length - 1];
    futureRef.current = entries.slice(0, -1);
    setFuture(futureRef.current);
    historyRef.current = [...historyRef.current.slice(-29), configRef.current];
    setHistory(historyRef.current);
    configRef.current = next;
    setConfigState(next);
    setInspectCode(null);
    notify("Version suivante rétablie");
  }, [notify]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo]);

  const generateVariation = useCallback(() => {
    const seed = nextSeed(configRef.current.seed);
    commit({ ...configRef.current, seed });
    notify("Nouvelle rosace calculée", `Signature ${formatSeed(seed)} · dimensions et fils conservés`);
  }, [commit, notify]);

  const setSeed = useCallback((seed: number) => {
    if (seed >= 1 && seed <= 9999) commit({ ...configRef.current, seed: Math.round(seed) });
  }, [commit]);

  const setFabric = useCallback((fabric: FabricTone) => commit({ ...configRef.current, fabric }), [commit]);
  const setAida = useCallback((aida: AidaCount) => commit({ ...configRef.current, aida }), [commit]);

  const isDefault = sameRecipe(config, DEFAULT_CONFIG);
  const reset = useCallback(() => {
    if (sameRecipe(configRef.current, DEFAULT_CONFIG)) return;
    commit({ ...DEFAULT_CONFIG, palette: [...DEFAULT_CONFIG.palette] });
    setActiveColorIndex(0);
    setInspectCode(null);
    notify("Rosace réinitialisée", "Annuler restaure votre réglage précédent");
  }, [commit, notify]);

  /** Ouvre une recette exacte (étude de la bibliothèque, favori) dans l'unique instrument. */
  const loadRecipe = useCallback((recipe: RosaceConfig, title: string, detail?: string) => {
    commit({ ...recipe, palette: [...recipe.palette] });
    setActiveColorIndex(0);
    setInspectCode(null);
    setEmbroideryOpen(false);
    setCollectionOpen(false);
    window.setTimeout(() => scrollToSequence("composer"), 30);
    notify(`${title} est sur le tambour`, detail ?? `Recette exacte · signature ${formatSeed(recipe.seed)}`);
  }, [commit, notify]);

  const selectSlot = useCallback((index: number) => {
    setActiveColorIndex(index);
    setInspectCode(null);
  }, []);

  /** Consulter un fil : s'il est dans l'ouvrage, son emplacement devient actif ; sinon il est seulement inspecté. */
  const inspectThread = useCallback((code: string) => {
    const index = configRef.current.palette.indexOf(code);
    if (index >= 0) {
      setActiveColorIndex(index);
      setInspectCode(null);
    } else {
      setInspectCode(code);
    }
  }, []);

  const applyThread = useCallback((code: string, intent: "replace" | "add" = "replace") => {
    const current = configRef.current;
    const existing = current.palette.indexOf(code);
    if (existing >= 0) {
      setActiveColorIndex(existing);
      setInspectCode(null);
      setCatalog((state) => ({ ...state, open: false }));
      notify("Fil déjà dans l'ouvrage", `DMC ${code} est le fil ${existing + 1}`);
      return;
    }
    if (intent === "add") {
      if (current.palette.length >= 6) return;
      commit({ ...current, palette: [...current.palette, code] });
      setActiveColorIndex(current.palette.length);
    } else {
      const palette = [...current.palette];
      palette[activeRef.current] = code;
      commit({ ...current, palette });
    }
    setInspectCode(null);
    setCatalog((state) => ({ ...state, open: false }));
    notify(intent === "add" ? "Fil ajouté à l'ouvrage" : "Fil remplacé", `DMC ${code} · ${getThread(code).name}`);
  }, [commit, notify]);

  const removeThread = useCallback((index: number) => {
    const current = configRef.current;
    if (current.palette.length <= 3) return;
    const palette = current.palette.filter((_, paletteIndex) => paletteIndex !== index);
    commit({ ...current, palette });
    setInspectCode(null);
    setActiveColorIndex((value) => (value === index ? Math.min(index, palette.length - 1) : value > index ? value - 1 : value));
    notify("Fil retiré de l'ouvrage", `DMC ${current.palette[index]}`);
  }, [commit, notify]);

  const openCatalog = useCallback((intent: "replace" | "add" = "replace", family: FamilyFilter = "toutes") => {
    setCatalog({ open: true, intent, family });
  }, []);
  const closeCatalog = useCallback(() => setCatalog((state) => ({ ...state, open: false })), []);

  /** Un clic sur une couleur : le fil choisi devient le corps, les quatre autres suivent l'harmonie. */
  const applyColor = useCallback((code: string, scheme: Harmony = harmony) => {
    const current = configRef.current;
    const fabric = FABRIC_COLORS[current.fabric].base;
    const [p0, p1, p2, p3, p4] = harmonyCodes(code, scheme, fabric);
    commit({ ...current, palette: [p0, p1, p2, p3, p4], paletteShift: 1 });
    setInspectCode(code);
    notify(`Rosace teintée · DMC ${code}`, `${getThread(code).name} · harmonie ${scheme}`);
  }, [commit, harmony, notify]);

  const changeHarmony = useCallback((scheme: Harmony) => {
    setHarmony(scheme);
    const current = configRef.current;
    const fabric = FABRIC_COLORS[current.fabric].base;
    const code = current.palette[2] ?? current.palette[0];
    const [p0, p1, p2, p3, p4] = harmonyCodes(code, scheme, fabric);
    commit({ ...current, palette: [p0, p1, p2, p3, p4], paletteShift: 1 });
    notify("Harmonie changée", `${scheme} · autour de DMC ${code}`);
  }, [commit, notify]);

  const toggleFavorite = useCallback(() => {
    const current = configRef.current;
    const existing = favorites.find((entry) => sameRecipe(entry.config, current));
    if (existing) {
      setFavorites((list) => list.filter((entry) => entry.id !== existing.id));
      notify("Rosace retirée de votre collection");
      return;
    }
    if (favorites.length >= 24) {
      notify("La collection est complète", "Supprimez une rosace avant d'en enregistrer une nouvelle");
      setCollectionOpen(true);
      return;
    }
    const entry: SavedRosace = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `rosace-${Date.now()}`,
      name: `Rosace n° ${formatSeed(current.seed)}`,
      config: { ...current, palette: [...current.palette] },
      createdAt: new Date().toISOString(),
      stitches: pattern.stitches.length,
    };
    setFavorites((list) => [entry, ...list]);
    notify("Recette enregistrée dans votre collection", "Retrouvez-la dans Outils et dans Explorer");
  }, [favorites, notify, pattern.stitches.length]);

  const deleteFavorite = useCallback((id: string) => {
    setFavorites((list) => list.filter((entry) => entry.id !== id));
    notify("Rosace supprimée de la collection");
  }, [notify]);

  const exportActions = useMemo(() => ({
    print: () => {
      if (!printWorksheet(pattern)) notify("La fenêtre d'impression est bloquée", "Autorisez les fenêtres pop-up pour créer la fiche PDF");
      else notify("Fiche technique ouverte", "Utilisez « Imprimer / PDF » dans la nouvelle fenêtre");
    },
    png: async (chart: boolean) => {
      try {
        await exportPng(pattern, chart);
        notify("PNG exporté", `Vue ${chart ? "grille" : "toile"} · 1600 × 1600 px`);
      } catch (error) { notify("Export impossible", error instanceof Error ? error.message : "Réessayez dans un instant"); }
    },
    svg: (chart: boolean) => {
      exportSvg(pattern, chart);
      notify("SVG exporté", `${chart ? "Grille" : "Motif"} vectoriel · croix groupées par référence DMC`);
    },
    csv: () => {
      exportThreadCsv(pattern);
      notify("Liste de fils exportée", "Compatible avec votre tableur");
    },
    share: async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(shareUrl);
        else {
          const textarea = document.createElement("textarea");
          textarea.value = shareUrl;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          const copied = document.execCommand("copy");
          textarea.remove();
          if (!copied) throw new Error("Copie refusée");
        }
        notify("Lien de partage copié", "La signature, la palette et tous les réglages sont inclus");
      } catch { notify("Copie automatique impossible", "Sélectionnez manuellement le lien affiché dans Outils"); }
    },
  }), [pattern, notify, shareUrl]);

  return {
    config, pattern, warnings, history, future, isDefault, shareUrl,
    activeIndex, inspectedCode, activeDimension, setActiveDimension,
    favorites, savedCurrent, toasts,
    embroideryOpen, setEmbroideryOpen, collectionOpen, setCollectionOpen, loupeOpen, setLoupeOpen,
    panel, setPanel,
    harmony, changeHarmony, applyColor, baseCode, paletteStops,
    catalog, openCatalog, closeCatalog,
    commit, beginGesture, endGesture, setDimension, undo, redo, reset, generateVariation, setSeed, setFabric, setAida,
    loadRecipe, selectSlot, inspectThread, applyThread, removeThread,
    toggleFavorite, deleteFavorite, notify, exportActions,
  };
}

export type RosaceApi = ReturnType<typeof useRosaceState>;

const RosaceContext = createContext<RosaceApi | null>(null);

export function RosaceProvider({ children }: { children: ReactNode }) {
  const api = useRosaceState();
  return <RosaceContext.Provider value={api}>{children}</RosaceContext.Provider>;
}

export function useRosaceApi(): RosaceApi {
  const api = useContext(RosaceContext);
  if (!api) throw new Error("useRosaceApi doit être utilisé dans <RosaceProvider>.");
  return api;
}
