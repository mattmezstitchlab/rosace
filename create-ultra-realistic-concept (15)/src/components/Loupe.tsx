import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getThread } from "../data/dmc";
import { workTitle } from "../lib/exporters";
import { FABRIC_COLORS, getPatternName } from "../lib/rosace";
import { useRosaceApi } from "../state/rosace-store";
import { RosaceCanvas } from "./RosaceCanvas";

/**
 * La loupe : la même rosace, dessinée pour la main.
 * Au lieu d'une croix de 3 px, chaque point occupe une dizaine de pixels : on voit le lin,
 * les trous de l'aïda, le brin qui passe au-dessus de l'autre.
 * Aucun calcul ici : cette vue lit exactement l'ouvrage du tambour.
 */
export function Loupe() {
  const api = useRosaceApi();
  const { work: pattern, loupeOpen, setLoupeOpen } = api;
  const config = pattern.textile;
  const title = workTitle(pattern);
  const subtitle = pattern.origin.kind === "rosace" ? getPatternName(pattern.origin.config) : `${pattern.origin.provenance.file} · patron importé`;
  const [zoom, setZoom] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const used = pattern.usage.filter((usage) => usage.count > 0);

  useEffect(() => {
    if (!loupeOpen) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    setZoom(1);
    const timer = window.setTimeout(() => closeRef.current?.focus(), 60);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLoupeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [loupeOpen, setLoupeOpen]);

  if (!loupeOpen) return null;

  return (
    <div className="loupe" role="dialog" aria-modal="true" aria-label={`Détail, ${title}`}>
      <header className="loupe-tete">
        <div>
          <p className="surtitre">Détail · {pattern.width} × {pattern.height} points</p>
          <p className="loupe-titre">{title} <span>{subtitle}</span></p>
        </div>
        <div className="loupe-outils">
          <div className="zoom" role="group" aria-label="Zoom du détail">
            <button className="icone" onClick={() => setZoom((value) => Math.max(1, value - 1))} disabled={zoom === 1} aria-label="Réduire le zoom"><Minus size={16} /></button>
            <span aria-live="polite">×{zoom}</span>
            <button className="icone" onClick={() => setZoom((value) => Math.min(4, value + 1))} disabled={zoom === 4} aria-label="Agrandir le zoom"><Plus size={16} /></button>
          </div>
          <button ref={closeRef} className="bouton noir bouton-petit" onClick={() => setLoupeOpen(false)}>
            <X size={16} aria-hidden="true" /> Fermer le détail
          </button>
        </div>
      </header>

      <div className="loupe-defilement" tabIndex={0} aria-label="Détail de la broderie, défilable">
        <RosaceCanvas
          pattern={pattern}
          resolution={2400}
          className="loupe-canvas"
          style={{ "--zoom": zoom } as React.CSSProperties}
          label={`Détail de la broderie : ${pattern.stitches.length} croix sur toile ${FABRIC_COLORS[config.fabric].name.toLowerCase()}`}
        />
      </div>

      <footer className="loupe-pied">
        <ul className="loupe-legende" aria-label="Fils de l'ouvrage">
          {used.map((usage) => {
            const thread = getThread(usage.code);
            return (
              <li key={usage.paletteIndex}>
                <b aria-hidden="true">{usage.symbol}</b>
                <i style={{ background: thread.hex }} aria-hidden="true" />
                <span>DMC {usage.code}</span>
              </li>
            );
          })}
        </ul>
        <p className="loupe-note">
          {pattern.stitches.length.toLocaleString("fr-FR")} croix à {config.strands} brin{config.strands > 1 ? "s" : ""} · toile {FABRIC_COLORS[config.fabric].name.toLowerCase()} aïda {config.aida} ·
          les trous sont au centre de chaque case, le brin supérieur croise toujours dans le même sens.
        </p>
      </footer>
    </div>
  );
}
