import { useCallback, useState, type KeyboardEvent } from "react";
import { CROWN_INDEX, CROWN_THREADS } from "../data/crown";
import { HERO_PATTERN } from "./data";

/**
 * La couronne DMC de l'atelier, en grand sur la présentation : les 489 références, à survoler
 * ou à parcourir au clavier ; le centre affiche le fil visé — son code, son nom et sa couleur
 * d'écran, dite sRGB. Les cinq fils de la rosace du hero sont repérés sur l'anneau intérieur.
 */
const C = 500;
const R_IN = 330;
const R_OUT = 480;
const SWEEP = 300;
const START = -90 + (360 - SWEEP) / 2;

const point = (radius: number, degrees: number) => {
  const rad = (degrees * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) };
};

function segment(index: number, count: number, inner: number, outer: number, grow = 0) {
  const width = SWEEP / count;
  const a0 = START + index * width - grow;
  const a1 = START + (index + 1) * width + grow;
  const p0 = point(outer, a0);
  const p1 = point(outer, a1);
  const p2 = point(inner, a1);
  const p3 = point(inner, a0);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${outer} ${outer} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} A ${inner} ${inner} 0 0 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} Z`;
}

const SEGMENTS = CROWN_THREADS.map((thread, index) => ({ thread, d: segment(index, CROWN_THREADS.length, R_IN, R_OUT) }));
const HERO_CODES = new Set(HERO_PATTERN.config.palette);

export function Nuancier() {
  const [selected, setSelected] = useState(HERO_PATTERN.config.palette[0]);
  const [hovered, setHovered] = useState<string | null>(null);
  const activeCode = hovered ?? selected;
  const activeIndex = CROWN_INDEX.get(activeCode) ?? 0;
  const active = CROWN_THREADS[activeIndex];

  const onKey = useCallback((event: KeyboardEvent<SVGGElement>) => {
    const index = CROWN_INDEX.get(selected) ?? 0;
    const count = CROWN_THREADS.length;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    const code = CROWN_THREADS[next].code;
    setSelected(code);
    setHovered(null);
    window.requestAnimationFrame(() => document.getElementById(`nuancier-${code}`)?.focus());
  }, [selected]);

  return (
    <div className="nuancier">
      <svg className="nuancier-svg" viewBox="0 0 1000 1000" role="group" aria-label="Couronne des 489 références DMC Mouliné" onPointerLeave={() => setHovered(null)}>
        <g role="listbox" aria-label="Nuancier DMC : survolez ou parcourez avec les flèches, le fil visé s'affiche au centre" onKeyDown={onKey}>
          {SEGMENTS.map(({ thread, d }) => (
            <path
              key={thread.code}
              id={`nuancier-${thread.code}`}
              d={d}
              fill={thread.hex}
              className={`nuancier-seg${thread.code === selected ? " is-selected" : ""}`}
              role="option"
              aria-selected={thread.code === selected}
              aria-label={`DMC ${thread.code}, ${thread.name}`}
              tabIndex={thread.code === selected ? 0 : -1}
              onPointerEnter={() => setHovered(thread.code)}
              onClick={() => { setSelected(thread.code); setHovered(null); }}
            >
              <title>DMC {thread.code} · {thread.name}</title>
            </path>
          ))}
        </g>
        {/* Le fil visé, soulevé hors de l'anneau. */}
        <path className="nuancier-focus" d={segment(activeIndex, CROWN_THREADS.length, R_IN - 10, R_OUT + 14, 0.35)} fill={active.hex} pointerEvents="none" />
        {/* Les cinq fils de la rosace, repérés sur l'anneau intérieur. */}
        {HERO_PATTERN.config.palette.map((code) => {
          const index = CROWN_INDEX.get(code);
          if (index === undefined) return null;
          return <path key={code} d={segment(index, CROWN_THREADS.length, R_IN - 26, R_IN - 16, 0.25)} fill="#14110f" pointerEvents="none" />;
        })}
        <circle cx={C} cy={C} r={R_IN - 40} fill="none" stroke="#14110f" strokeWidth="1" opacity="0.18" />
      </svg>

      <div className="nuancier-centre" aria-live="polite">
        <span className="nuancier-pastille" style={{ background: active.hex }} aria-hidden="true" />
        <strong>DMC {active.code}</strong>
        <span className="nuancier-nom">{active.name}</span>
        <span className="nuancier-ecran">écran sRGB <code>{active.hex.toUpperCase()}</code></span>
        {HERO_CODES.has(active.code) && <span className="nuancier-marque">dans la rosace du haut</span>}
        <span className="nuancier-aide">Survolez la couronne, ou parcourez-la avec les flèches.</span>
      </div>
    </div>
  );
}
