import type { ReactNode } from "react";
import { ArrowRight, Check, FileText } from "lucide-react";
import type { RosacePattern } from "../lib/rosace";
import { HERO_STATS } from "./data";
import { RosaceRender } from "./media";

/**
 * L'appareil de la présentation : la tablette de l'entrée « Importer ».
 * Ce n'est pas une capture : l'écran est composé avec le moteur du produit
 * (les mêmes rendus de grille). Il est purement illustratif (aria-hidden).
 */

/* ------------------------------------------------------------------ Châssis */
function Appareil({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`appareil ${className ?? ""}`} aria-hidden="true">
      {children}
    </div>
  );
}

export function Tablette({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Appareil className={`tablette ${className ?? ""}`}>
      <div className="tablette-ecran">{children}</div>
    </Appareil>
  );
}

/* ------------------------------------------- Tablette : l'import d'un patron PDF
   L'atelier d'import tel qu'il est : quatre étapes, la table de montage où les
   pages du PDF se calent comme un puzzle, le résumé honnête du montage.
   Les cartes sont les quatre quarts de la grille réelle du patron. */
const IMPORT_STAGES = ["Analyser", "Caler", "Assembler", "Vérifier"];
const IMPORT_TILES = [
  { page: 1, x: 0, y: 0 },
  { page: 2, x: 1, y: 0 },
  { page: 3, x: 0, y: 1 },
  { page: 4, x: 1, y: 1 },
];

export function EcranImport({ pattern }: { pattern: RosacePattern }) {
  const half = Math.ceil(HERO_STATS.grid / 2);
  return (
    <div className="ecran ecran-import">
      <div className="ecran-barre">
        <span className="ecran-marque">
          <FileText size={12} strokeWidth={1.9} />
          Importer un patron PDF
        </span>
        <span className="ecran-barre-note">4 pages · {HERO_STATS.grid} × {HERO_STATS.grid}</span>
      </div>
      <ol className="ecran-import-etapes">
        {IMPORT_STAGES.map((label, index) => (
          <li key={label} className={index < 2 ? "est-faite" : index === 2 ? "est-active" : undefined}>
            <b>{index < 2 ? <Check size={9} strokeWidth={3} /> : index + 1}</b>
            {label}
          </li>
        ))}
      </ol>
      <div className="ecran-import-corps">
        <div className="ecran-import-table">
          {IMPORT_TILES.map((tile) => (
            <span key={tile.page} className={`ecran-carte${tile.page === 4 ? " est-prise" : ""}`} style={{ left: `${tile.x * 50}%`, top: `${tile.y * 50}%` }}>
              <RosaceRender
                pattern={pattern}
                mode="chart"
                resolution={1100}
                decorative
                style={{ transform: `translate(${-tile.x * 50}%, ${-tile.y * 50}%)` }}
              />
              <em>
                P.{tile.page}
                <i>{half}×{half}</i>
              </em>
            </span>
          ))}
        </div>
        <div className="ecran-import-cote">
          <p className="ecran-import-titre">Table de montage</p>
          <ul>
            <li><b>Grille</b><span>{HERO_STATS.grid} × {HERO_STATS.grid}</span></li>
            <li><b>Fils DMC</b><span>{HERO_STATS.threads}</span></li>
            <li><b>Cartes</b><span>4</span></li>
            <li><b>Recouvrements</b><span>2 vérifiés</span></li>
            <li><b>Cases vides</b><span>0</span></li>
          </ul>
          <p className="ecran-import-note">Les cartes se calent sur la case la plus proche ; un conflit entre deux pages est signalé, jamais tranché en silence.</p>
          <span className="ecran-bouton">Vérifier <ArrowRight size={10} strokeWidth={2.2} /></span>
        </div>
      </div>
    </div>
  );
}
