import { useEffect, useRef, type CSSProperties } from "react";
import { paintPattern, type CanvasMode } from "../lib/paint";
import type { RosacePattern } from "../lib/rosace";
import type { StitchWork } from "../lib/work";

/**
 * Rendu d'un ouvrage dans la présentation. La toile n'est peinte qu'à l'approche du
 * viewport : la page reste légère même avec une dizaine de rosaces.
 */
export function RosaceRender({
  pattern,
  mode = "fabric",
  resolution = 720,
  className,
  label,
  decorative = false,
  style,
}: {
  pattern: RosacePattern | StitchWork;
  mode?: CanvasMode;
  resolution?: number;
  className?: string;
  label?: string;
  /** Image purement décorative (son sens est porté par un parent) : cachée des lecteurs d'écran. */
  decorative?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let painted = false;
    const paint = () => {
      if (painted) return;
      painted = true;
      paintPattern(canvas, pattern, mode, resolution);
    };
    if (typeof IntersectionObserver === "undefined") {
      paint();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        paint();
      },
      { rootMargin: "320px" },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [pattern, mode, resolution]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={style}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined :
        label ??
        `${mode === "chart" ? "Grille technique" : "Broderie sur aïda"} de ${pattern.stitches.length.toLocaleString("fr-FR")} croix, ${"size" in pattern ? `${pattern.size} par ${pattern.size}` : `${pattern.width} par ${pattern.height}`} points`
      }
    />
  );
}
