import { useEffect, useRef, type CSSProperties } from "react";
import { CROWN_INDEX, CROWN_THREADS } from "../data/crown";
import { paintPattern, type CanvasMode } from "../lib/paint";
import type { RosacePattern } from "../lib/rosace";

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
  style,
}: {
  pattern: RosacePattern;
  mode?: CanvasMode;
  resolution?: number;
  className?: string;
  label?: string;
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
      role="img"
      aria-label={
        label ??
        `${mode === "chart" ? "Grille technique" : "Broderie sur aïda"} de ${pattern.stitches.length.toLocaleString("fr-FR")} croix, ${pattern.size} par ${pattern.size} points`
      }
    />
  );
}

/* ---------- La couronne DMC, dessinée comme dans l'atelier ---------- */

const C = 200;
const R_IN = 143;
const R_OUT = 186;
const SWEEP = 300;
const START = -90 + (360 - SWEEP) / 2;

const point = (radius: number, degrees: number) => {
  const rad = (degrees * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) };
};

function segment(index: number, count: number, inner: number, outer: number) {
  const width = SWEEP / count;
  const a0 = START + index * width + 0.2;
  const a1 = START + (index + 1) * width - 0.2;
  const p0 = point(outer, a0);
  const p1 = point(outer, a1);
  const p2 = point(inner, a1);
  const p3 = point(inner, a0);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${outer} ${outer} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} A ${inner} ${inner} 0 0 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} Z`;
}

const CROWN_SEGMENTS = CROWN_THREADS.map((thread, index) => ({
  code: thread.code,
  hex: thread.hex,
  d: segment(index, CROWN_THREADS.length, R_IN, R_OUT),
}));

/**
 * Les 489 références DMC, en couronne. Les cinq fils de la palette sont repérés
 * par un trait clair sur l'anneau intérieur : on voit d'où vient la couleur.
 */
export function DmcCrown({ palette }: { palette: string[] }) {
  const selected = palette
    .map((code, role) => ({ role, index: CROWN_INDEX.get(code) }))
    .filter((entry): entry is { role: number; index: number } => typeof entry.index === "number");

  return (
    <svg className="couronne" viewBox="0 0 400 400" role="img" aria-label={`Couronne des ${CROWN_THREADS.length} références DMC Mouliné, cinq fils retenus`}>
      <circle cx={C} cy={C} r={196} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.22" />
      {CROWN_SEGMENTS.map((entry) => (
        <path key={entry.code} d={entry.d} fill={entry.hex} />
      ))}
      {selected.map((entry) => (
        <path
          key={`marque-${entry.role}`}
          d={segment(entry.index, CROWN_THREADS.length, R_IN - 13, R_IN - 6)}
          fill="none"
          stroke="#14110f"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      ))}
      <circle cx={C} cy={C} r={R_IN - 22} fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <circle cx={C} cy={C} r={R_IN - 34} fill="currentColor" opacity="0.05" />
    </svg>
  );
}
