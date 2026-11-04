import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  Flower2,
  Grid3x3,
  Heart,
  Palette,
  Redo2,
  Share2,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import { EmbroideryHoop } from "../components/RosaceCanvas";
import { RosaceLogo } from "../components/RosaceLogo";
import type { RosacePattern } from "../lib/rosace";
import type { CanvasMode } from "../lib/paint";
import { HERO_STATS, PALETTE, USED_THREADS, decimal, nombre } from "./data";
import { DmcCrown, RosaceRender } from "./media";

/**
 * Les appareils de la présentation.
 * Ce ne sont pas des captures : chaque écran est composé avec le moteur du
 * produit (les mêmes rendus, la même palette, le même dock). L'atelier est
 * montré en situation, jamais en maquette creuse.
 */

/* ------------------------------------------------------------------ Châssis */
function Appareil({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`appareil ${className ?? ""}`} aria-hidden="true">
      {children}
    </div>
  );
}

export function Ordinateur({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Appareil className={`ordinateur ${className ?? ""}`}>
      <div className="ordinateur-ecran">{children}</div>
      <div className="ordinateur-socle" />
    </Appareil>
  );
}

export function Tablette({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Appareil className={`tablette ${className ?? ""}`}>
      <div className="tablette-ecran">{children}</div>
    </Appareil>
  );
}

export function Telephone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Appareil className={`telephone ${className ?? ""}`}>
      <div className="telephone-ecran">{children}</div>
      <span className="telephone-ilot" />
    </Appareil>
  );
}

/* --------------------------------------------------------------- Le dock */
const DOCK = [
  { label: "Composer", icone: Flower2 },
  { label: "Colorer", icone: Palette },
  { label: "Ajuster", icone: SlidersHorizontal },
  { label: "Broder", icone: Grid3x3 },
  { label: "Sauvegarder", icone: Heart },
  { label: "Exporter", icone: Download },
];

function Dock({ actif = "Broder" }: { actif?: string }) {
  return (
    <div className="ecran-dock">
      {DOCK.map(({ label, icone: Icone }) => (
        <span key={label} className={label === actif ? "est-actif" : undefined}>
          <Icone size={15} strokeWidth={1.7} />
          {label}
        </span>
      ))}
    </div>
  );
}

function Barre({ titre, icone: Icone, note }: { titre: string; icone: typeof Flower2; note?: string }) {
  return (
    <div className="ecran-barre">
      <span className="ecran-marque">
        <Icone size={12} strokeWidth={1.9} />
        {titre}
      </span>
      <span className="ecran-barre-actions">
        <Undo2 size={11} strokeWidth={1.9} />
        <Redo2 size={11} strokeWidth={1.9} />
        <Share2 size={11} strokeWidth={1.9} />
      </span>
      {note ? <span className="ecran-barre-note">{note}</span> : null}
    </div>
  );
}

/* ---------------------------------------------- Ordinateur : l'atelier réel
   Même composition que l'application : barre de marque, tambour dans sa
   couronne DMC, bande de mesures, dock. Rien d'inventé. */
export function EcranAtelier({ pattern }: { pattern: RosacePattern }) {
  return (
    <div className="ecran ecran-atelier">
      <div className="ecran-barre">
        <span className="ecran-marque">
          <RosaceLogo size={13} />
          ROSACE<sup>®</sup>
        </span>
        <span className="ecran-barre-actions">
          <Undo2 size={11} strokeWidth={1.9} />
          <Redo2 size={11} strokeWidth={1.9} />
          <span className="ecran-barre-sep" aria-hidden="true" />
          <Heart size={11} strokeWidth={1.9} />
          <Share2 size={11} strokeWidth={1.9} />
        </span>
      </div>

      <div className="ecran-scene">
        <div className="ecran-couronne">
          <DmcCrown palette={pattern.config.palette} />
        </div>
        <div className="ecran-tambour">
          <EmbroideryHoop pattern={pattern} />
        </div>
      </div>

      <div className="ecran-mesures-bande">
        <p>
          <span>{nombre(HERO_STATS.stitches)} croix</span>
          <i aria-hidden="true">·</i>
          <span>{HERO_STATS.threads} fils</span>
          <i aria-hidden="true">·</i>
          <span>
            {HERO_STATS.grid} × {HERO_STATS.grid}
          </span>
          <i aria-hidden="true">·</i>
          <span>{decimal(HERO_STATS.widthCm)} cm</span>
          <i aria-hidden="true">·</i>
          <span>{HERO_STATS.duration}</span>
        </p>
        <span className="ecran-zoom">
          <b>−</b>
          <em>⤢ 100 %</em>
          <b>+</b>
        </span>
      </div>

      <Dock actif="Composer" />
    </div>
  );
}

/* ---------------------------------------------------------- Tablette : grille */
export function EcranGrille({ pattern }: { pattern: RosacePattern }) {
  return (
    <div className="ecran ecran-grille">
      <Barre titre="Grille technique" icone={Grid3x3} note={`${HERO_STATS.grid} × ${HERO_STATS.grid}`} />
      <div className="ecran-grille-scene">
        <RosaceRender pattern={pattern} mode="chart" resolution={760} label="La grille technique du patron" />
      </div>
      <div className="ecran-grille-pied">
        {PALETTE.slice(0, 3).map((thread) => (
          <span key={thread.code}>
            <i style={{ background: thread.hex }} />
            DMC {thread.code}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ Téléphone : broderie */
export function EcranBroderie({ pattern, compact = false, mode = "fabric" }: { pattern: RosacePattern; compact?: boolean; mode?: CanvasMode }) {
  return (
    <div className={`ecran ecran-broderie${compact ? " ecran-broderie--compact" : ""}`}>
      <div className="ecran-barre ecran-barre--tel">
        <span className="ecran-marque">Broder</span>
        <span className="ecran-barre-actions">
          <Check size={10} strokeWidth={2.2} />
        </span>
      </div>

      <div className="ecran-broderie-scene">
        <RosaceRender key={mode} pattern={pattern} mode={mode} resolution={mode === "fabric" ? 520 : 900} label="La rosace à broder, croix par croix" />
        {compact ? (
          <div className="ecran-broderie-carte">
            <span>
              <strong>1 205</strong> / {nombre(HERO_STATS.stitches)} croix
            </span>
            <i>
              <b style={{ width: "36%" }} />
            </i>
            <small>36 % · DMC 902</small>
          </div>
        ) : null}
      </div>

      {compact ? null : (
        <div className="ecran-broderie-panneau">
          <div className="ecran-broderie-compteur">
            <strong>36 %</strong>
            <span>1 205 / {nombre(HERO_STATS.stitches)} croix</span>
          </div>
          <i className="ecran-jauge">
            <b style={{ width: "36%" }} />
          </i>
          <ul className="ecran-fils-brodes">
            {PALETTE.map((thread) => {
              const usage = USED_THREADS.find((entry) => entry.code === thread.code);
              return (
                <li key={thread.code}>
                  <span style={{ background: thread.hex }} />
                  <b>DMC {thread.code}</b>
                  <small>{usage ? `${nombre(usage.count)} croix` : "—"}</small>
                </li>
              );
            })}
          </ul>
          <p className="ecran-broderie-note">Dernière croix cochée : ligne 42, colonne 58.</p>
          <span className="ecran-bouton">Cocher la croix suivante</span>
        </div>
      )}
    </div>
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
