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
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1.25); }
      else if (event.key === "-") { event.preventDefault(); zoomBy(0.8); }
      else if (event.key === "0") { event.preventDefault(); reset(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBy, reset]);

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

  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.12 : 0.89);
  };

  return (
    <div
      ref={frame}
      className="zoom-scene"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
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
              <button type="button" className="zoom-bouton zoom-recentre" onClick={reset} disabled={view.k === 1 && view.x === 0 && view.y === 0} aria-label="Recentrer la vue">
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
