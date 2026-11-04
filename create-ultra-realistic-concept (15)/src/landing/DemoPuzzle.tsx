import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Check, Shuffle, Sparkles } from "lucide-react";
import { assembleTiles, snapPosition, type Tile, type TilePlacement } from "../lib/import-pdf/montage";
import { workFingerprint } from "../lib/pattern-id";
import { HERO_WORK, nombre } from "./data";

/**
 * La table de montage de l'import PDF, en démonstration directe sur la présentation.
 * Rien n'est simulé : les quatre cartes sont les quatre quarts de la matrice réelle de la
 * rosace, l'aimantation est `snapPosition`, le comptage des recouvrements, conflits et cases
 * vides est `assembleTiles`, et la réussite est prouvée par l'empreinte : la grille
 * recomposée doit avoir exactement l'empreinte de l'ouvrage d'origine.
 */
const SNAP = 5;
/** Plateau en cases : la grille, plus de quoi écarter les cartes. */
const BOARD = { w: 128, h: 118 };

interface DemoTile extends Tile {
  home: { x: number; y: number };
}

function buildTiles(): DemoTile[] {
  const { width, height, cells } = HERO_WORK;
  const cx = Math.ceil(width / 2);
  const cy = Math.ceil(height / 2);
  const parts = [
    { page: 1, x: 0, y: 0, w: cx, h: cy },
    { page: 2, x: cx, y: 0, w: width - cx, h: cy },
    { page: 3, x: 0, y: cy, w: cx, h: height - cy },
    { page: 4, x: cx, y: cy, w: width - cx, h: height - cy },
  ];
  return parts.map((part) => {
    const sub = new Int16Array(part.w * part.h);
    for (let r = 0; r < part.h; r += 1) for (let c = 0; c < part.w; c += 1) sub[r * part.w + c] = cells[(part.y + r) * width + (part.x + c)];
    return { id: `p${part.page}`, page: part.page, cols: part.w, rows: part.h, cells: sub, byColor: 0, byLegend: part.w * part.h, unresolved: 0, home: { x: part.x, y: part.y } };
  });
}

const TILES = buildTiles();
const SYMBOLS_BY_INDEX = HERO_WORK.palette.map((entry) => entry.symbol);
const CODES = HERO_WORK.palette.map((entry) => entry.code);

/** Positions « sorties du PDF » : écartées, l'une d'elles chevauchant sa voisine. */
const SCATTERED: TilePlacement[] = [
  { id: "p1", x: 8, y: 10, w: TILES[0].cols, h: TILES[0].rows },
  { id: "p2", x: 72, y: 7, w: TILES[1].cols, h: TILES[1].rows },
  { id: "p3", x: 7, y: 66, w: TILES[2].cols, h: TILES[2].rows },
  { id: "p4", x: 64, y: 46, w: TILES[3].cols, h: TILES[3].rows },
];
const HOME: TilePlacement[] = TILES.map((tile) => ({ id: tile.id, x: tile.home.x, y: tile.home.y, w: tile.cols, h: tile.rows }));

/** Peint une carte comme une page de patron PDF : un symbole par case, en noir sur blanc, repères tous les dix points. */
function paintTile(canvas: HTMLCanvasElement, tile: Tile) {
  const scale = 14;
  canvas.width = tile.cols * scale;
  canvas.height = tile.rows * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 1;
  for (let c = 0; c <= tile.cols; c += 1) {
    ctx.strokeStyle = c % 10 === 0 ? "rgba(20,17,15,.55)" : "rgba(20,17,15,.14)";
    ctx.beginPath(); ctx.moveTo(c * scale + 0.5, 0); ctx.lineTo(c * scale + 0.5, canvas.height); ctx.stroke();
  }
  for (let r = 0; r <= tile.rows; r += 1) {
    ctx.strokeStyle = r % 10 === 0 ? "rgba(20,17,15,.55)" : "rgba(20,17,15,.14)";
    ctx.beginPath(); ctx.moveTo(0, r * scale + 0.5); ctx.lineTo(canvas.width, r * scale + 0.5); ctx.stroke();
  }
  ctx.fillStyle = "#14110f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${scale * 0.78}px "Inter Tight", Arial, sans-serif`;
  for (let r = 0; r < tile.rows; r += 1) {
    for (let c = 0; c < tile.cols; c += 1) {
      const value = tile.cells[r * tile.cols + c];
      if (value < 0) continue;
      ctx.fillText(SYMBOLS_BY_INDEX[value] ?? "×", c * scale + scale / 2, r * scale + scale / 2 + 0.5);
    }
  }
}

function TileCanvas({ tile }: { tile: Tile }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) paintTile(ref.current, tile); }, [tile]);
  return <canvas ref={ref} aria-hidden="true" />;
}

export function DemoPuzzle() {
  const [layout, setLayout] = useState<TilePlacement[]>(SCATTERED);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const assembly = useMemo(() => assembleTiles(TILES, layout), [layout]);
  const fingerprint = useMemo(() => workFingerprint(assembly.width, assembly.height, assembly.cells, CODES), [assembly]);
  const exact = fingerprint === HERO_WORK.fingerprint;

  const cellPx = useCallback(() => {
    const rect = boardRef.current?.getBoundingClientRect();
    return rect ? rect.width / BOARD.w : 4;
  }, []);

  const place = useCallback((id: string, x: number, y: number, snap: boolean) => {
    setLayout((current) => {
      const moving = current.find((item) => item.id === id);
      if (!moving) return current;
      const bounded = { ...moving, x: Math.max(0, Math.min(BOARD.w - moving.w, x)), y: Math.max(0, Math.min(BOARD.h - moving.h, y)) };
      const result = snapPosition(bounded, current, snap ? SNAP : 0, snap);
      setGuides(snap ? result.guides : {});
      return current.map((item) => (item.id === id ? { ...item, x: result.x, y: result.y } : item));
    });
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, item: TilePlacement) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: item.id, startX: event.clientX, startY: event.clientY, originX: item.x, originY: item.y };
    setDragId(item.id);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const px = cellPx();
    // Comme dans l'atelier : l'aimantation guide déjà pendant le geste.
    place(drag.id, Math.round(drag.originX + (event.clientX - drag.startX) / px), Math.round(drag.originY + (event.clientY - drag.startY) / px), true);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragId(null);
    const px = cellPx();
    place(drag.id, Math.round(drag.originX + (event.clientX - drag.startX) / px), Math.round(drag.originY + (event.clientY - drag.startY) / px), true);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>, item: TilePlacement) => {
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    place(item.id, item.x + move[0], item.y + move[1], true);
  };

  const status = exact
    ? `Grille recomposée à l'identique : ${assembly.width} × ${assembly.height}, ${nombre(HERO_WORK.stitches.length)} croix, empreinte ${fingerprint.slice(0, 8)} vérifiée.`
    : `Grille ${assembly.width} × ${assembly.height} · ${assembly.overlaps} case${assembly.overlaps > 1 ? "s" : ""} recouverte${assembly.overlaps > 1 ? "s" : ""} · ${assembly.conflicts} conflit${assembly.conflicts > 1 ? "s" : ""} · ${nombre(assembly.holes)} case${assembly.holes > 1 ? "s" : ""} vide${assembly.holes > 1 ? "s" : ""}.`;

  return (
    <div className="puzzle">
      <div
        ref={boardRef}
        className="puzzle-plateau"
        style={{ aspectRatio: `${BOARD.w} / ${BOARD.h}` }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {guides.x !== undefined && <span className="puzzle-guide puzzle-guide--v" style={{ left: `${(guides.x / BOARD.w) * 100}%` }} aria-hidden="true" />}
        {guides.y !== undefined && <span className="puzzle-guide puzzle-guide--h" style={{ top: `${(guides.y / BOARD.h) * 100}%` }} aria-hidden="true" />}
        {layout.map((item) => {
          const tile = TILES.find((entry) => entry.id === item.id)!;
          const overlapped = assembly.overlappingPairs.some((pair) => pair.includes(item.id));
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`P.${tile.page} ${item.w}×${item.h} — page ${tile.page}, ${item.w} par ${item.h} cases, colonne ${item.x + 1}, ligne ${item.y + 1}. Flèches pour déplacer, Maj pour aller plus vite.`}
              className={`puzzle-carte${dragId === item.id ? " est-prise" : ""}${overlapped ? " est-recouverte" : ""}${exact ? " est-juste" : ""}`}
              style={{ left: `${(item.x / BOARD.w) * 100}%`, top: `${(item.y / BOARD.h) * 100}%`, width: `${(item.w / BOARD.w) * 100}%`, height: `${(item.h / BOARD.h) * 100}%` }}
              onPointerDown={(event) => onPointerDown(event, item)}
              onPointerUp={onPointerUp}
              onKeyDown={(event) => onKey(event, item)}
            >
              <TileCanvas tile={tile} />
              <span className="puzzle-badge">P.{tile.page} <em>{item.w}×{item.h}</em></span>
            </div>
          );
        })}
      </div>

      <div className="puzzle-cote">
        <p className="puzzle-titre">Table de montage</p>
        <p className={`puzzle-etat${exact ? " est-juste" : ""}`} role="status" aria-live="polite">
          {exact && <Check size={15} strokeWidth={2.4} aria-hidden="true" />}
          {status}
        </p>
        <dl className="puzzle-compte">
          <div><dt>Cartes</dt><dd>{assembly.tiles}</dd></div>
          <div><dt>Recouvertes</dt><dd className={assembly.overlaps ? "est-attention" : ""}>{nombre(assembly.overlaps)}</dd></div>
          <div><dt>Conflits</dt><dd className={assembly.conflicts ? "est-attention" : ""}>{nombre(assembly.conflicts)}</dd></div>
          <div><dt>Vides</dt><dd className={assembly.holes ? "est-attention" : ""}>{nombre(assembly.holes)}</dd></div>
        </dl>
        <p className="puzzle-aide">
          Glissez les quatre pages jusqu'à ce qu'elles se touchent : elles s'aimantent à la case près. Au clavier, les flèches déplacent la carte qui a le focus.
        </p>
        <div className="puzzle-actions">
          <button type="button" className="bouton bouton-noir" onClick={() => { setLayout(HOME); setGuides({}); }}>
            <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
            Recomposer d'un geste
          </button>
          <button type="button" className="bouton bouton-contour" onClick={() => { setLayout(SCATTERED); setGuides({}); }}>
            <Shuffle size={16} strokeWidth={2} aria-hidden="true" />
            Mélanger
          </button>
        </div>
        <p className="puzzle-note">
          Ce sont les vraies cases de la rosace du haut, imprimées comme un patron du commerce — un symbole par fil — et découpées en quatre pages ; l'aimantation, le comptage et la vérification par empreinte sont ceux de l'atelier d'import.
        </p>
      </div>
    </div>
  );
}
