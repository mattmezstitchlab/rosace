import { Expand, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface View { k: number; x: number; y: number }

const clampView = (view: View): View => {
  const k = Math.min(3, Math.max(1, view.k));
  const limit = (k - 1) * 220;
  return { k, x: Math.min(limit, Math.max(-limit, view.x)), y: Math.min(limit, Math.max(-limit, view.y)) };
};

/**
 * La scène zoomable : pincement à deux doigts, molette + Ctrl, boutons et clavier (+, −, 0).
 * Le pincement capture les clics parasites : la couronne ne change pas de couleur pendant un zoom.
 */
export function ZoomStage({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ d: number; k: number; x: number; y: number; mx: number; my: number } | null>(null);
  const suppressClick = useRef(0);
  const frame = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById("zoom-slot")); }, []);

  const apply = useCallback((next: View) => setView(clampView(next)), []);
  const zoomBy = useCallback((factor: number) => {
    const current = viewRef.current;
    apply({ ...current, k: current.k * factor });
  }, [apply]);
  const reset = useCallback(() => apply({ k: 1, x: 0, y: 0 }), [apply]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Ctrl/⌘ + « + », « - », « 0 » sont les raccourcis de zoom du navigateur (Alt/⌘ servent aussi à d'autres commandes) : on ne les détourne pas.
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const { key } = event;
      if (key !== "+" && key !== "=" && key !== "-" && key !== "0") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      // Broder, import, loupe, catalogue : une fenêtre modale couvre l'atelier, ses touches ne le concernent pas.
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      if (key === "-") zoomBy(0.8);
      else if (key === "0") reset();
      else zoomBy(1.25);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBy, reset]);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    // React enregistre `wheel` en mode passif : preventDefault y est sans effet et le navigateur zoomerait toute la page en plus de la scène.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      // Un cran de molette (≈ 100 px, ou 3 lignes) vaut ≈ ×1,12 ; un pincement de pavé tactile envoie beaucoup de petits deltas.
      const unit = event.deltaMode === 0 ? 0.0012 : 0.04;
      zoomBy(Math.min(1.25, Math.max(0.8, Math.exp(-event.deltaY * unit))));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const onPointerDown = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        k: viewRef.current.k,
        x: viewRef.current.x,
        y: viewRef.current.y,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
      };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = gesture.current;
    if (pointers.current.size === 2 && start) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (start.d > 0) apply({ k: start.k * (d / start.d), x: start.x + (mx - start.mx), y: start.y + (my - start.my) });
      suppressClick.current = Date.now() + 250;
    } else if (pointers.current.size === 1 && viewRef.current.k > 1 && gesture.current === null) {
      // Un doigt déplace la vue agrandie (le tambour garde son appui court pour la loupe).
    }
  };

  const endPointer = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  return (
    <div
      ref={frame}
      className="zoom-scene"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={reset}
      onClickCapture={(event) => {
        if (Date.now() < suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div
        className="zoom-monde"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        {children}
      </div>
      {slot
        ? createPortal(
            <div className="zoom-commandes" role="group" aria-label="Zoom de l'atelier">
              <button type="button" className="zoom-bouton" onClick={() => zoomBy(0.8)} disabled={view.k <= 1} aria-label="Zoom arrière">
                <Minus size={16} aria-hidden="true" />
              </button>
              <button type="button" className="zoom-bouton zoom-recentre" onClick={reset} disabled={view.k === 1 && view.x === 0 && view.y === 0} aria-label={`Recentrer la vue, ${Math.round(view.k * 100)} %`}>
                <Expand size={15} aria-hidden="true" />
                <span>{Math.round(view.k * 100)} %</span>
              </button>
              <button type="button" className="zoom-bouton" onClick={() => zoomBy(1.25)} disabled={view.k >= 3} aria-label="Zoom avant">
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>,
            slot,
          )
        : null}
    </div>
  );
}
