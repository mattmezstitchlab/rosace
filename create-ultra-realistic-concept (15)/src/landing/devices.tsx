import type { ReactNode } from "react";
import {
  Check,
  Download,
  Flower2,
  Grid3x3,
  Heart,
  Palette,
  Redo2,
  Share2,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import { RosaceLogo } from "../components/RosaceLogo";
import type { RosacePattern } from "../lib/rosace";
import { HERO_STATS, PALETTE, USED_THREADS, decimal, nombre } from "./data";
import { RosaceRender } from "./media";

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

function Curseur({ label, valeur, part }: { label: string; valeur: string; part: number }) {
  return (
    <div className="ecran-champ">
      <span>
        {label}
        <strong>{valeur}</strong>
      </span>
      <i>
        <b style={{ width: `${part}%` }} />
      </i>
    </div>
  );
}

/* ------------------------------------------------------ Ordinateur : atelier */
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
          <Heart size={11} strokeWidth={1.9} />
          <Share2 size={11} strokeWidth={1.9} />
        </span>
      </div>

      <div className="ecran-corps">
        <div className="ecran-scene">
          <span className="ecran-pastille">La rosace 007 · {nombre(HERO_STATS.stitches)} croix</span>
          <div className="ecran-tambour">
            <RosaceRender pattern={pattern} resolution={720} label="La rosace en cours de composition" />
          </div>
          <span className="ecran-echelle">17,2 cm</span>
        </div>

        <aside className="ecran-panneau">
          <p className="ecran-panneau-titre">Composer la forme</p>
          <Curseur label="Pétales" valeur="8" part={62} />
          <Curseur label="Densité" valeur="0,74" part={74} />
          <Curseur label="Symétrie" valeur="6" part={46} />
          <div className="ecran-fils">
            <span className="ecran-panneau-titre">Fils retenus</span>
            <div>
              {PALETTE.map((thread) => (
                <span key={thread.code} style={{ background: thread.hex }} />
              ))}
            </div>
          </div>
          <div className="ecran-mesures">
            <span>
              <strong>{decimal(HERO_STATS.widthCm)} cm</strong>
              aïda {HERO_STATS.aida}
            </span>
            <span>
              <strong>{HERO_STATS.duration}</strong>
              temps estimé
            </span>
          </div>
        </aside>
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
export function EcranBroderie({ pattern, compact = false }: { pattern: RosacePattern; compact?: boolean }) {
  return (
    <div className={`ecran ecran-broderie${compact ? " ecran-broderie--compact" : ""}`}>
      <div className="ecran-barre ecran-barre--tel">
        <span className="ecran-marque">Broder</span>
        <span className="ecran-barre-actions">
          <Check size={10} strokeWidth={2.2} />
        </span>
      </div>

      <div className="ecran-broderie-scene">
        <RosaceRender pattern={pattern} resolution={520} label="La rosace à broder, croix par croix" />
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
