import { useEffect, useRef, type CSSProperties } from "react";
import { paintPattern, type CanvasMode } from "../lib/paint";
import type { RosacePattern } from "../lib/rosace";

interface RosaceCanvasProps {
  pattern: RosacePattern;
  mode?: CanvasMode;
  resolution?: number;
  className?: string;
  style?: CSSProperties;
  label?: string;
  onPointerMove?: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave?: () => void;
}

/** Lecture visuelle d'un ouvrage calculé. Ne calcule rien : peint exactement les croix du pattern reçu. */
export function RosaceCanvas({ pattern, mode = "fabric", resolution = 1200, className, style, label, onPointerMove, onPointerLeave }: RosaceCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) paintPattern(ref.current, pattern, mode, resolution);
  }, [pattern, mode, resolution]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={style}
      role="img"
      aria-label={label ?? `${mode === "chart" ? "Grille" : "Broderie"} de ${pattern.stitches.length} croix, ${pattern.size} par ${pattern.size} points`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    />
  );
}

/** Le tambour : cadre de bois, vis de laiton et toile. C'est l'unique tambour de l'application. */
export function EmbroideryHoop({ pattern }: { pattern: RosacePattern }) {
  return (
    <div className="hoop">
      <div className="hoop-clasp" aria-hidden="true">
        <span className="hoop-clasp-neck" />
        <span className="hoop-clasp-screw" />
        <span className="hoop-clasp-knob" />
      </div>
      <div className="hoop-inner">
        <RosaceCanvas pattern={pattern} className="hoop-canvas" />
        <div className="hoop-glass" aria-hidden="true" />
      </div>
      <div className="hoop-rim-light" aria-hidden="true" />
    </div>
  );
}
