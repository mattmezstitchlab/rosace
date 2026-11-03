import { Download, FileUp, Flower2, Grid3x3, Heart, Palette, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { workTitle } from "../lib/exporters";
import { formatDuration } from "../lib/rosace";
import { useRosaceApi, type PanelId } from "../state/rosace-store";
import { Disque } from "./Disque";
import { PANEL_COMPONENTS } from "./Panels";
import { ZoomStage } from "./ZoomStage";

/**
 * Le dock, à gauche sur bureau et au pouce sur mobile. Chaque entrée est un verbe :
 * on compose, on colore, on ajuste, on brode, on sauvegarde, on exporte, on importe.
 * Les identifiants internes (PanelId) restent inchangés : seule la lecture change.
 */
type DockId = PanelId | "broder" | "collection" | "importer";
const CATEGORIES: Array<{ id: DockId; label: string; icon: typeof Flower2 }> = [
  { id: "forme", label: "Composer", icon: Flower2 },
  { id: "couleurs", label: "Colorer", icon: Palette },
  { id: "reglages", label: "Ajuster", icon: SlidersHorizontal },
  { id: "broder", label: "Broder", icon: Grid3x3 },
  { id: "collection", label: "Sauvegarder", icon: Heart },
  { id: "export", label: "Exporter", icon: Download },
  { id: "importer", label: "Importer", icon: FileUp },
];
const DOCK_KEYS = ["1", "2", "3", "4", "5", "6", "7"];

const PANEL_TITLES: Record<PanelId, string> = {
  forme: "Composer la forme",
  couleurs: "Colorer les fils",
  reglages: "Ajuster la toile",
  export: "Exporter et partager",
};

/**
 * L'atelier : écran fixe, sans défilement de page.
 * La scène garde le tambour visible ; le panneau monte depuis le dock et la scène se réduit.
 */
export function Composer() {
  const api = useRosaceApi();
  const { work, imported, panel, setPanel, embroideryOpen, setEmbroideryOpen, warnings, importOpen, openImport } = api;
  const panelRef = useRef<HTMLElement>(null);
  const dragStart = useRef<number | null>(null);
  const usedThreads = work.usage.filter((usage) => usage.count > 0).length;

  const choose = useCallback((id: DockId) => {
    if (id === "broder") {
      setEmbroideryOpen(true);
      setPanel(null);
      return;
    }
    if (id === "importer") {
      openImport();
      return;
    }
    if (id === "collection") {
      api.setCollectionOpen(true);
      setPanel(null);
      return;
    }
    setPanel(panel === id ? null : id);
  }, [api, openImport, panel, setEmbroideryOpen, setPanel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Le mode Broderie et l'import sont plein écran : leurs touches ne doivent pas ouvrir un panneau derrière eux.
      if (embroideryOpen || importOpen) return;
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
      const index = DOCK_KEYS.indexOf(event.key);
      if (index >= 0 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        choose(CATEGORIES[index].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, panel, setPanel, embroideryOpen, importOpen]);

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
    <section id="composer" className="studio" aria-label={`Atelier ROSACE, ${workTitle(work)}`}>
      <div className="studio-main">
        <div className="studio-stage">
          <ZoomStage>
            <Disque />
          </ZoomStage>
        </div>
        <div className="studio-stats">
          <p aria-live="polite">
            <strong>{work.stitches.length.toLocaleString("fr-FR")}</strong> croix
            <span aria-hidden="true">·</span> {usedThreads} fils
            <span aria-hidden="true">·</span> {work.width} × {work.height}
            <span className="stat-cm" aria-hidden="true">·</span> <span className="stat-cm">{String(work.motifCm).replace(".", ",")} cm</span>
            <span aria-hidden="true">·</span> {formatDuration(work.minutes)}
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
            {imported && panel !== "export" ? <ImportedNotice /> : <PanelBody />}
          </div>
        </section>
      )}

      <span id="dock-alerte-aide" className="sr-only">Contraste à vérifier dans les couleurs</span>
      <nav className="studio-dock" aria-label="Catégories d'outils">
        {CATEGORIES.map((category, index) => {
          const Icon = category.icon;
          const isPanel = category.id === panel;
          const isBroder = (category.id === "broder" && embroideryOpen) || (category.id === "importer" && importOpen);
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
              <Icon size={26} strokeWidth={1.65} aria-hidden="true" />
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

/** Un patron importé n'a ni recette ni couleurs à régler : les panneaux le disent plutôt que de montrer des curseurs inertes. */
function ImportedNotice() {
  const { work, clearImportedWork, openImport, setEmbroideryOpen } = useRosaceApi();
  if (work.origin.kind !== "pdf") return null;
  const { provenance, montage, importedAt } = work.origin;
  return (
    <div className="panneau-import">
      <p className="panneau-label">Patron importé</p>
      <p className="panneau-aide">
        <strong>{provenance.title || provenance.file}</strong> · {work.width} × {work.height} points · {work.palette.length} fils DMC
        {provenance.author ? ` · ${provenance.author}` : ""}. Lecture {provenance.mode}, {montage.tiles.length} carte(s), importé le {new Date(importedAt).toLocaleDateString("fr-FR")}.
      </p>
      <p className="panneau-aide">Ce patron vient d'un PDF : sa forme et ses couleurs ne se règlent pas ici. Brodez-le, exportez ses planches ou sa liste de fils, ou revenez à votre rosace.</p>
      <ul className="panneau-fils-import" aria-label="Fils du patron">
        {work.usage.filter((line) => line.count > 0).map((line) => (
          <li key={line.code}><i aria-hidden="true">{line.symbol}</i> DMC {line.code} <small>{line.count.toLocaleString("fr-FR")} croix · {String(line.meters).replace(".", ",")} m</small></li>
        ))}
      </ul>
      <div className="options">
        <button type="button" className="option" onClick={() => setEmbroideryOpen(true)}>Broder ce patron</button>
        <button type="button" className="option" onClick={() => openImport()}>Importer un autre PDF</button>
        <button type="button" className="option" onClick={clearImportedWork}>Revenir à ma rosace</button>
      </div>
    </div>
  );
}
