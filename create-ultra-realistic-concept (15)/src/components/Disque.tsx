import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useRef, type KeyboardEvent } from "react";
import { CROWN_INDEX, CROWN_THREADS } from "../data/crown";
import { getThread } from "../data/dmc";
import { useRosaceApi } from "../state/rosace-store";
import { EmbroideryHoop } from "./RosaceCanvas";

/**
 * Le Disque ROSACE, minimal : le tambour occupe le centre, la couronne des 161 fils DMC l'entoure.
 * Un clic sur une couleur recolore immédiatement la rosace avec sa complémentaire et ses analogues.
 * Aucune bague : les transformations se règlent par les curseurs sous le tambour.
 */
const C = 500;
const CROWN_IN = 402;
const CROWN_OUT = 496;
const CROWN_SWEEP = 344;
const CROWN_START = -90 + (360 - CROWN_SWEEP) / 2;

const point = (radius: number, degrees: number) => {
  const rad = (degrees * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) };
};

function crownPath(index: number, count: number, inner: number, outer: number, grow = 0) {
  const width = CROWN_SWEEP / count;
  const a0 = CROWN_START + index * width + 0.14 - grow;
  const a1 = CROWN_START + (index + 1) * width - 0.14 + grow;
  const p0 = point(outer, a0);
  const p1 = point(outer, a1);
  const p2 = point(inner, a1);
  const p3 = point(inner, a0);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${outer} ${outer} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} A ${inner} ${inner} 0 0 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} Z`;
}

const CROWN_PATHS = CROWN_THREADS.map((thread, index) => ({
  thread,
  d: crownPath(index, CROWN_THREADS.length, CROWN_IN, CROWN_OUT),
  middle: CROWN_START + (index + 0.5) * (CROWN_SWEEP / CROWN_THREADS.length),
}));

export function Disque() {
  const api = useRosaceApi();
  const { config, pattern, baseCode, inspectedCode, applyColor, inspectThread } = api;
  const reduceMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);

  const onCrownKey = useCallback((event: KeyboardEvent) => {
    const index = CROWN_INDEX.get(inspectedCode) ?? CROWN_INDEX.get(baseCode) ?? 0;
    const count = CROWN_THREADS.length;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      applyColor(inspectedCode ?? baseCode);
      return;
    } else return;
    event.preventDefault();
    const code = CROWN_THREADS[next].code;
    inspectThread(code);
    window.requestAnimationFrame(() => document.getElementById(`crown-${code}`)?.focus());
  }, [applyColor, baseCode, inspectedCode, inspectThread]);

  const activeCrownIndex = CROWN_INDEX.get(inspectedCode) ?? CROWN_INDEX.get(baseCode) ?? 0;
  const activeThread = getThread(inspectedCode ?? baseCode);

  return (
    <div className="disque">
      <div className="disque-layer">
        <svg ref={svgRef} className="disque-svg" viewBox="0 0 1000 1000" role="group" aria-label="Couronne des fils DMC : un clic teinte la rosace">
          <g
            className="crown"
            role="listbox"
            aria-label={`Nuancier DMC, ${CROWN_THREADS.length} références. Un clic applique la couleur ; les flèches parcourent, Entrée applique.`}
            onKeyDown={onCrownKey}
          >
            {CROWN_PATHS.map(({ thread, d }) => {
              const selected = thread.code === baseCode;
              return (
                <path
                  key={thread.code}
                  id={`crown-${thread.code}`}
                  d={d}
                  fill={thread.hex}
                  className={`crown-seg ${selected ? "is-selected" : ""}`}
                  role="option"
                  aria-selected={selected}
                  aria-label={`DMC ${thread.code}, ${thread.name}${selected ? ", couleur de la rosace" : ""}`}
                  tabIndex={thread.code === (inspectedCode ?? baseCode) ? 0 : -1}
                  onClick={() => applyColor(thread.code)}
                  onPointerEnter={() => inspectThread(thread.code)}
                >
                  <title>DMC {thread.code} · {thread.name} — cliquer pour teinter la rosace</title>
                </path>
              );
            })}
            <path
              className="crown-focus"
              d={crownPath(activeCrownIndex, CROWN_THREADS.length, CROWN_IN - 7, CROWN_OUT + 10, 0.32)}
              fill={activeThread.hex}
              pointerEvents="none"
            />
            <circle className="crown-halo" cx={C} cy={C} r={CROWN_IN - 20} />
          </g>
        </svg>

        <motion.div
          className="disque-hoop"
          key={`${config.seed}-${config.structure}-${config.trace}-${config.density}-${config.scale}-${config.twist}-${config.wave}`}
          initial={reduceMotion ? { opacity: 0.5 } : { opacity: 0.4, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <EmbroideryHoop pattern={pattern} />
          <button className="hoop-touch" onClick={() => api.setLoupeOpen(true)} aria-label="Agrandir la broderie pour compter les points de croix" />
          <span className="hoop-loupe" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M8 11h6M11 8v6" /></svg>
          </span>
        </motion.div>
      </div>

    </div>
  );
}
