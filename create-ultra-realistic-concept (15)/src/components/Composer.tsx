import { Download, Flower2, Heart, Palette, PenTool, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { formatDuration } from "../lib/rosace";
import { formatSeed, useRosaceApi, type PanelId } from "../state/rosace-store";
import { Disque } from "./Disque";
import { PANEL_COMPONENTS } from "./Panels";
import { ZoomStage } from "./ZoomStage";

const CATEGORIES: Array<{ id: PanelId | "broder" | "collection"; label: string; icon: typeof Flower2 }> = [
  { id: "forme", label: "Forme", icon: Flower2 },
  { id: "couleurs", label: "Couleurs", icon: Palette },
  { id: "reglages", label: "Réglages", icon: SlidersHorizontal },
  { id: "broder", label: "Broder", icon: PenTool },
  { id: "collection", label: "Collection", icon: Heart },
  { id: "export", label: "Export", icon: Download },
];

const PANEL_TITLES: Record<PanelId, string> = {
  forme: "Forme de la rosace",
  couleurs: "Couleurs et harmonie",
  reglages: "Toile et signature",
  export: "Exporter et partager",
};

/**
 * L'atelier : écran fixe, sans défilement de page.
 * La scène garde le tambour visible ; le panneau monte depuis le dock et la scène se réduit.
 */
export function Composer() {
  const api = useRosaceApi();
  const { config, pattern, panel, setPanel, embroideryOpen, setEmbroideryOpen, warnings } = api;
  const panelRef = useRef<HTMLElement>(null);
  const dragStart = useRef<number | null>(null);
  const usedThreads = pattern.usage.filter((usage) => usage.count > 0).length;

  const choose = useCallback((id: PanelId | "broder" | "collection") => {
    if (id === "broder") {
      setEmbroideryOpen(true);
      setPanel(null);
      return;
    }
    if (id === "collection") {
      api.setCollectionOpen(true);
      setPanel(null);
      return;
    }
    setPanel(panel === id ? null : id);
  }, [api, panel, setEmbroideryOpen, setPanel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Le mode Broderie est plein écran : ses touches ne doivent pas ouvrir un panneau derrière lui.
      if (embroideryOpen) return;
      // Échap ferme le panneau même si un curseur, une recherche ou un champ a le focus.
      if (event.key === "Escape") {
        if (panel) {
          event.preventDefault();
          setPanel(null);
        }
        return;
      }
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const index = ["1", "2", "3", "4", "5", "6"].indexOf(event.key);
      if (index >= 0 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        choose(CATEGORIES[index].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, panel, setPanel, embroideryOpen]);

  const PanelBody = panel ? PANEL_COMPONENTS[panel] : null;

  const onPanelPointerDown = (event: React.PointerEvent) => {
    dragStart.current = event.clientY;
  };
  const onPanelPointerMove = (event: React.PointerEvent) => {
    if (dragStart.current === null) return;
    if (event.clientY - dragStart.current > 56) {
      dragStart.current = null;
      setPanel(null);
    }
  };
  const endPanelDrag = () => { dragStart.current = null; };

  return (
    <section id="composer" className="studio" aria-label={`Atelier ROSACE, rosace n° ${formatSeed(config.seed)}`}>
      <div className="studio-main">
        <div className="studio-stage">
          <ZoomStage>
            <Disque />
          </ZoomStage>
        </div>
        <div className="studio-stats">
          <p aria-live="polite">
            <strong>{pattern.stitches.length.toLocaleString("fr-FR")}</strong> croix
            <span aria-hidden="true">·</span> {usedThreads} fils
            <span aria-hidden="true">·</span> {pattern.size} × {pattern.size}
            <span className="stat-cm" aria-hidden="true">·</span> <span className="stat-cm">{String(pattern.motifCm).replace(".", ",")} cm</span>
            <span aria-hidden="true">·</span> {formatDuration(pattern.minutes)}
          </p>
          <div id="zoom-slot" className="zoom-slot" />
        </div>
      </div>

      {panel && PanelBody && (
        <section ref={panelRef} className="studio-panel" aria-label={PANEL_TITLES[panel]}>
          <header
            className="panel-tete"
            onPointerDown={onPanelPointerDown}
            onPointerMove={onPanelPointerMove}
            onPointerUp={endPanelDrag}
            onPointerCancel={endPanelDrag}
          >
            <span className="panel-poignee" aria-hidden="true" />
            <h2>{PANEL_TITLES[panel]}</h2>
            <button type="button" className="icone" onClick={() => setPanel(null)} aria-label="Fermer le panneau">
              <X size={17} aria-hidden="true" />
            </button>
          </header>
          <div className="panel-corps">
            <PanelBody />
          </div>
        </section>
      )}

      <span id="dock-alerte-aide" className="sr-only">Contraste à vérifier dans les couleurs</span>
      <nav className="studio-dock" aria-label="Catégories d'outils">
        {CATEGORIES.map((category, index) => {
          const Icon = category.icon;
          const isPanel = category.id === panel;
          const isBroder = category.id === "broder" && embroideryOpen;
          const hasAlert = category.id === "couleurs" && warnings.length > 0;
          return (
            <button
              key={category.id}
              id={category.id === "broder" ? "dock-broder" : undefined}
              type="button"
              className={`dock-categorie ${isPanel || isBroder ? "is-active" : ""}`}
              aria-pressed={isPanel || isBroder}
              aria-describedby={hasAlert ? "dock-alerte-aide" : undefined}
              onClick={() => choose(category.id)}
            >
              <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
              <span>{category.label}</span>
              {hasAlert && <span className="dock-alerte" aria-hidden="true" />}
              <kbd>{index + 1}</kbd>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
