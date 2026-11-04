import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PHOTO_LIMITS, photoGrid, type PhotoResult } from "../lib/import-photo";
import { paintPattern } from "../lib/paint";
import { fromImport, type StitchWork } from "../lib/work";
import aida from "../assets/aida-macro.jpg";
import { nombre } from "./data";

/**
 * L'import photo, en démonstration directe : la photo d'aïda de la présentation passe par le
 * vrai moteur (`photoGrid`) dans le navigateur, et le rapport de couleurs est celui de l'atelier —
 * chaque pastille est une couleur d'écran, dite sRGB, jamais présentée comme le fil.
 */
const WIDTH = 72;
const MAX_COLORS = 10;

export function DemoPhoto() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState<{ data: Uint8ClampedArray; w: number; h: number } | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(aida);
        const bitmap = await createImageBitmap(await response.blob());
        const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("canvas");
        context.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        if (!cancelled) setPixels({ data: context.getImageData(0, 0, w, h).data, w, h });
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* La conversion tourne à chaque cran du curseur : c'est le vrai moteur, en direct. */
  const computed = useMemo<{ result: PhotoResult; work: StitchWork } | { error: string } | null>(() => {
    if (!pixels) return null;
    const outcome = photoGrid(pixels.data, pixels.w, pixels.h, { width: WIDTH, maxColors: MAX_COLORS, dropWhite: false, confetti, file: "aida-macro.jpg" });
    if ("error" in outcome) return outcome;
    const built = fromImport(outcome.grid);
    return built.ok ? { result: outcome, work: built.work } : { error: built.error };
  }, [pixels, confetti]);
  const result = computed && !("error" in computed) ? computed.result : null;
  const work = computed && !("error" in computed) ? computed.work : null;
  const failure = error || (computed && "error" in computed ? computed.error : "");

  useEffect(() => {
    if (canvasRef.current && work) paintPattern(canvasRef.current, work, "color", 900);
  }, [work]);

  return (
    <div className="photo-demo">
      <div className="photo-demo-duo">
        <figure className="photo-demo-source">
          <img src={aida} alt="La photo de départ : aïda, fil de coton et aiguille" loading="lazy" />
          <figcaption>La photo</figcaption>
        </figure>
        <figure className="photo-demo-grille">
          {work ? (
            <canvas ref={canvasRef} role="img" style={{ "--ratio": `${work.width} / ${work.height}` } as CSSProperties} aria-label={`La grille obtenue : ${work.width} par ${work.height} points, ${work.palette.length} fils DMC`} />
          ) : (
            <div className="photo-demo-attente" role="status">{failure ? `Démonstration indisponible : ${failure}` : "Conversion de la photo…"}</div>
          )}
          <figcaption>
            {work ? `La grille · ${work.width} × ${work.height} points · ${nombre(work.stitches.length)} croix · ${work.palette.length} fils DMC` : "La grille"}
          </figcaption>
        </figure>
      </div>

      <div className="photo-demo-curseur">
        <label>
          <span>
            <strong>Nettoyage des confettis</strong>
            <em aria-live="polite">{confetti === 0 ? "aucun — chaque pixel isolé reste une croix" : `${confetti} passe${confetti > 1 ? "s" : ""} · ${result ? nombre(result.confettiRemoved) : "…"} croix isolées rendues à leurs voisines`}</em>
          </span>
          <input type="range" min={PHOTO_LIMITS.confetti.min} max={PHOTO_LIMITS.confetti.max} value={confetti} onChange={(event) => setConfetti(Number(event.target.value))} aria-valuetext={confetti === 0 ? "aucun nettoyage" : `${confetti} passes`} />
        </label>
        <p>Un confetti, c'est une croix d'un fil seule au milieu d'autres : jolie à l'écran, pénible à broder. Le curseur les rend au fil voisin majoritaire ; la grille et les comptes se recalculent à chaque cran.</p>
      </div>

      {result && (
        <div className="photo-demo-fils">
          <div className="photo-demo-tete">
            <p className="photo-demo-titre">Fils DMC et couleurs d'écran</p>
            <p className="photo-demo-legende"><i style={{ background: "#c85a96" }} aria-hidden="true" /> photo (écran, sRGB) <i style={{ background: "#c54989" }} aria-hidden="true" /> fil (écran, sRGB)</p>
          </div>
          <ul>
            {result.colors.slice(0, 5).map((line) => (
              <li key={line.code}>
                <span className="photo-demo-fil"><strong>DMC {line.code}</strong><small>{line.name}</small></span>
                <span className="photo-demo-pastilles">
                  <i style={{ background: line.photoHex }} aria-hidden="true" /><code>{line.photoHex.toUpperCase()}</code>
                  <i style={{ background: line.threadHex }} aria-hidden="true" /><code>{line.threadHex.toUpperCase()}</code>
                </span>
                <span className="photo-demo-ecart">ΔE {String(line.deltaE).replace(".", ",")}</span>
                <span className="photo-demo-croix">{nombre(line.count)} croix</span>
              </li>
            ))}
          </ul>
          <p className="photo-demo-note">
            Les deux pastilles sont des couleurs d'écran, en sRGB (RVB) : la moyenne des pixels de la photo, et la teinte du nuancier DMC telle qu'un écran la montre. Peu de nuanciers le précisent ; ROSACE le dit, parce que le fil réel, en coton, sous votre lumière, reste la seule référence. L'écart ΔE2000 mesure la distance entre les deux.
          </p>
        </div>
      )}
    </div>
  );
}
