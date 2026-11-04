import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Check, Circle, Download, FileText, Grid3x3, Heart, Image as ImageIcon, Layers, MousePointer2, Printer, Redo2, Share2, Type, Undo2 } from "lucide-react";
import { formatDuration } from "../lib/rosace";
import type { CanvasMode } from "../lib/paint";
import { HERO_PATTERN, HERO_STATS, SHAPE_VARIANTS, TEXT_WORK, decimal, nombre } from "./data";
import { EcranBroderie, EcranImport, Tablette, Telephone } from "./devices";
import { DemoPuzzle } from "./DemoPuzzle";
import { DemoPhoto } from "./DemoPhoto";
import { Nuancier } from "./Nuancier";
import { RosaceRender } from "./media";

/* ------------------------------------------------------------------ Entrées */
/**
 * Les trois portes de l'atelier. Chaque image sort du moteur : la rosace du hero,
 * sa grille découpée en pages comme l'import la recompose, un texte dans la police brodée.
 */

function Entrees() {
  return (
    <section id="entrees" className="section" aria-labelledby="titre-entrees">
      <div className="section-tete" data-reveal>
        <p className="surtitre">02 — Un atelier, quatre portes</p>
        <h2 id="titre-entrees">Composez, importez, écrivez ou convertissez : la suite est la même.</h2>
        <p className="section-chapeau">
          Une rosace calculée, un patron PDF acheté ailleurs, un prénom en lettres brodées ou une photo entrent par des
          portes différentes et arrivent au même endroit : <strong>une grille, une palette DMC, une progression suivie croix par croix.</strong>
        </p>
      </div>

      <ul className="entrees" data-reveal>
        <li className="entree">
          <div className="entree-image">
            <RosaceRender pattern={HERO_PATTERN} mode="stitches" resolution={640} label="Une rosace composée dans l'atelier" />
          </div>
          <div className="entree-texte">
            <p className="entree-sur"><Circle size={13} strokeWidth={2} aria-hidden="true" /> Créer</p>
            <h3>Une rosace à vous</h3>
            <p>Six géométries, une couronne de {nombre(489)} fils DMC, le patron calculé en direct : croix, métrages, dimensions, temps.</p>
            <a className="lien-souligne" href="#atelier">Créer ma rosace</a>
          </div>
        </li>
        <li className="entree">
          <div className="entree-image entree-image--pages">
            <div className="entree-tablette" role="img" aria-label="L'atelier d'import : les quatre pages d'un patron PDF calées sur la table de montage, grille et fils vérifiés">
              <Tablette>
                <EcranImport pattern={HERO_PATTERN} />
              </Tablette>
            </div>
          </div>
          <div className="entree-texte">
            <p className="entree-sur"><FileText size={13} strokeWidth={2} aria-hidden="true" /> Importer</p>
            <h3>Un patron PDF, page par page</h3>
            <p>Les pages sont lues, assemblées comme un puzzle, les recouvrements vérifiés. Ce qui n'a pas pu être relu est compté et annoncé — jamais inventé.</p>
            <a className="lien-souligne" href="#atelier-importer">Importer un patron PDF</a>
          </div>
        </li>
        <li className="entree">
          <div className="entree-image entree-image--texte">
            <RosaceRender pattern={TEXT_WORK} mode="color-chart" resolution={640} label={`Le mot ROSACE en lettres brodées, ${nombre(TEXT_WORK.stitches.length)} croix sur deux fils`} />
          </div>
          <div className="entree-texte">
            <p className="entree-sur"><Type size={13} strokeWidth={2} aria-hidden="true" /> Écrire</p>
            <h3>Un prénom, une date, un mot doux</h3>
            <p>Une police de croix dessinée pour l'aïda, un fil pour le texte et un pour l'ombre : {nombre(TEXT_WORK.stitches.length)} croix ici, prêtes à broder.</p>
            <a className="lien-souligne" href="#atelier-importer">Écrire un texte brodé</a>
          </div>
        </li>
        <li className="entree">
          <div className="entree-image entree-image--photo">
            <RosaceRender pattern={HERO_PATTERN} mode="color" resolution={640} label="Une grille en couleurs pleines, telle qu'une photo convertie" />
          </div>
          <div className="entree-texte">
            <p className="entree-sur"><ImageIcon size={13} strokeWidth={2} aria-hidden="true" /> Convertir</p>
            <h3>Une photo, triée en fils</h3>
            <p>Les fils DMC les plus proches, les confettis nettoyés, et chaque couleur d'écran annoncée en sRGB face au fil. <a href="#photo">Voir la démonstration</a>.</p>
            <a className="lien-souligne" href="#atelier-importer">Convertir une photo</a>
          </div>
        </li>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ Formes */
function Formes() {
  return (
    <section id="formes" className="section" aria-labelledby="titre-formes">
      <div className="section-tete" data-reveal>
        <p className="surtitre">03 — La promesse</p>
        <h2 id="titre-formes">
          Une création, pas un modèle prédéfini.
        </h2>
        <p className="section-chapeau">
          Chaque rosace commence par une forme. Choisissez une structure, ajustez la densité, modifiez la symétrie
          et observez le motif évoluer en temps réel. Vous ne sélectionnez pas simplement un modèle.
          <strong> Vous composez le vôtre.</strong>
        </p>
      </div>

      <ul className="formes" data-reveal>
        {SHAPE_VARIANTS.map((variant) => (
          <li key={variant.id} className="forme">
            <div className="forme-image">
              <RosaceRender pattern={variant.pattern} mode="stitches" resolution={640} label={`Rosace ${variant.label}, ${variant.pattern.stitches.length.toLocaleString("fr-FR")} croix`} />
            </div>
            <div className="forme-texte">
              <h3>{variant.label}</h3>
              <p>{variant.note}</p>
              <p className="forme-meta">
                {nombre(variant.pattern.stitches.length)} croix
                <span aria-hidden="true">·</span>
                {decimal(variant.pattern.motifCm)} cm
                <span aria-hidden="true">·</span>
                {formatDuration(variant.pattern.minutes)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="section-pied" data-reveal>
        <a className="bouton bouton-noir" href="#atelier-forme">
          Explorer les formes
          <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
        </a>
        <p className="section-note">
          Six familles géométriques, cinq structures de pétales, cinq tracés : le même moteur, vos réglages.
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Couleurs */
function Couleurs() {
  return (
    <section id="couleurs" className="section section--papier" aria-labelledby="titre-couleurs">
      <div className="section-tete" data-reveal>
        <p className="surtitre">04 — La couleur devient matière</p>
        <h2 id="titre-couleurs">
          Choisissez avec vos yeux.
          <br />
          Brodez avec les bonnes références.
        </h2>
        <p className="section-chapeau">
          La couronne ROSACE, c'est le nuancier complet : {nombre(489)} références DMC Mouliné à survoler. Chaque fil
          affiche son code, son nom et sa couleur d'écran — dite sRGB, parce que l'écran n'est pas le fil.
        </p>
      </div>

      <div className="nuancier-bloc" data-reveal>
        <Nuancier />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Réalisation */
/** Le comparateur motif / grille : un trait à prendre à la main, au clavier comme au doigt. */
export function Comparateur({
  initial = 50,
  resolution = 900,
  split: controlled,
  onSplit,
  leftMode = "fabric",
  aide = true,
}: {
  initial?: number;
  resolution?: number;
  /** Position contrôlée (0–100), pour lier le trait à autre chose — le mot-symbole du hero. */
  split?: number;
  onSplit?: (value: number) => void;
  leftMode?: CanvasMode;
  aide?: boolean;
}) {
  const [interne, setInterne] = useState(initial);
  const split = controlled ?? interne;
  const setSplit = useCallback((next: number | ((value: number) => number)) => {
    const value = typeof next === "function" ? next(controlled ?? interne) : next;
    setInterne(value);
    onSplit?.(value);
  }, [controlled, interne, onSplit]);
  const [glisse, setGlisse] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);

  /* Le balayage se fait sur le cadre lui-même : on attrape le trait, pas un curseur à distance. */
  const viser = useCallback((clientX: number) => {
    const rect = cadre.current?.getBoundingClientRect();
    if (!rect) return;
    const part = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, part)));
  }, []);

  const auClavier = (event: KeyboardEvent<HTMLDivElement>) => {
    const pas = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") setSplit((valeur) => Math.max(0, valeur - pas));
    else if (event.key === "ArrowRight") setSplit((valeur) => Math.min(100, valeur + pas));
    else if (event.key === "Home") setSplit(0);
    else if (event.key === "End") setSplit(100);
    else return;
    event.preventDefault();
  };

  return (
    <>
      <div
        className={`comparateur-cadre${glisse ? " est-glisse" : ""}`}
        ref={cadre}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setGlisse(true);
          viser(event.clientX);
        }}
        onPointerMove={(event) => {
          if (glisse) viser(event.clientX);
        }}
        onPointerUp={(event) => {
          setGlisse(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => setGlisse(false)}
      >
        <RosaceRender pattern={HERO_PATTERN} mode={leftMode} resolution={resolution} label="La rosace brodée" />
        <div className="comparateur-grille" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
          {/* La grille a sa propre marge technique : on la recale sur le rendu textile
              pour que les deux moitiés se répondent exactement au trait de comparaison. */}
          <div className="comparateur-aligne">
            <RosaceRender pattern={HERO_PATTERN} mode="chart" resolution={resolution} label="La grille technique du même patron" />
          </div>
        </div>
        <span className="comparateur-etiquette comparateur-etiquette--gauche" aria-hidden="true">Motif</span>
        <span className="comparateur-etiquette comparateur-etiquette--droite" aria-hidden="true">Grille</span>
        <div
          className="comparateur-poignee"
          style={{ left: `${split}%` }}
          role="slider"
          tabIndex={0}
          aria-label="Balayer entre le motif brodé et la grille technique"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(split)}
          aria-valuetext={`${Math.round(split)} % de grille`}
          aria-orientation="horizontal"
          onKeyDown={auClavier}
        >
          <span aria-hidden="true" />
        </div>
      </div>

      {aide && (
        <p className="comparateur-aide">
          <MousePointer2 size={14} strokeWidth={1.9} aria-hidden="true" />
          Glissez le trait — ou les flèches du clavier — pour passer du motif à la grille.
        </p>
      )}
    </>
  );
}

function Patron() {
  return (
    <section id="realisation" className="section" aria-labelledby="titre-realisation">
      <div className="section-tete" data-reveal>
        <p className="surtitre">05 — Le patron PDF, recomposé sous vos yeux</p>
        <h2 id="titre-realisation">
          Quatre pages, un puzzle,
          <br />
          une grille exacte.
        </h2>
        <p className="section-chapeau">
          Un patron acheté en PDF arrive en pages. ROSACE les lit, vous les calez sur la table de montage, et chaque
          case recouverte, chaque conflit, chaque trou est compté. <strong>Essayez, c'est le vrai moteur.</strong>
        </p>
      </div>

      <div className="puzzle-bloc" data-reveal>
        <DemoPuzzle />
      </div>

      <p className="section-manifeste" data-reveal>
        Ce n'est pas seulement une image générée.
        <span> C'est un patron exploitable.</span>
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------- Broder */
const AFFICHAGES = [
  { id: "fabric", label: "Toile" },
  { id: "chart", label: "Symboles" },
  { id: "color", label: "Couleurs" },
  { id: "color-chart", label: "Les deux" },
] as const;

type AffichageId = (typeof AFFICHAGES)[number]["id"];

function Broder() {
  const [affichage, setAffichage] = useState<AffichageId>("fabric");
  const base = useId();

  return (
    <section id="broder" className="section" aria-labelledby="titre-broder">
      <div className="section-tete section-tete--centre" data-reveal>
        <p className="surtitre">01 — Broder, en vrai</p>
        <h2 id="titre-broder">Cochez une croix. Le reste se calcule.</h2>
        <p className="section-chapeau">
          La grille vous suit croix par croix, dans l'affichage que vous préférez.
        </p>
      </div>

      <div className="telephone-scene" data-reveal>
        <div className="telephone-centre">
          <div className="vivant-onglets" role="tablist" aria-label="Affichages du mode Broder">
            {AFFICHAGES.map((entree) => (
              <button
                key={entree.id}
                id={`${base}-onglet-${entree.id}`}
                type="button"
                role="tab"
                aria-selected={affichage === entree.id}
                aria-controls={`${base}-panneau`}
                tabIndex={affichage === entree.id ? 0 : -1}
                className={affichage === entree.id ? "est-active" : ""}
                onClick={() => setAffichage(entree.id)}
              >
                {entree.label}
              </button>
            ))}
          </div>
          <div className="telephone-grand" id={`${base}-panneau`} role="tabpanel" aria-labelledby={`${base}-onglet-${affichage}`}>
            <Telephone className="telephone-heros">
              <EcranBroderie pattern={HERO_PATTERN} mode={affichage} />
            </Telephone>
          </div>
        </div>

      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Photo */
function Photo() {
  return (
    <section id="photo" className="section section--papier" aria-labelledby="titre-photo">
      <div className="section-tete" data-reveal>
        <p className="surtitre">06 — De la photo au fil</p>
        <h2 id="titre-photo">
          Les fils triés, les confettis nettoyés,
          <br />
          et l'écran qui dit ce qu'il est.
        </h2>
        <p className="section-chapeau">
          Une photo devient une grille : chaque case prend le fil DMC le plus proche, les croix isolées sont rendues à
          leurs voisines, et le rapport de couleurs distingue ce que l'écran montre de ce que le fil est.
          <strong> Ci-dessous, la conversion se fait en direct, dans votre navigateur.</strong>
        </p>
      </div>
      <div className="photo-demo-bloc" data-reveal>
        <DemoPhoto />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Progression */
const EXPORTS = [
  { id: "png", titre: "PNG", usage: "Montrer le rendu", icone: Layers },
  { id: "pdf", titre: "PDF", usage: "Imprimer le patron", icone: FileText },
  { id: "csv", titre: "CSV", usage: "Retrouver les fils et les métrages", icone: Grid3x3 },
  { id: "svg", titre: "SVG", usage: "Conserver le motif vectoriel", icone: Download },
  { id: "fiche", titre: "Fiche réimportable", usage: "Imprimer, et retrouver la rosace exacte", icone: Printer },
  { id: "projet", titre: "Projet ROSACE", usage: "Reprendre, ou broder ensemble", icone: Heart },
];

const GARDE = [
  { icone: Heart, titre: "Collection", texte: "Vos rosaces enregistrées, prêtes à être rouvertes." },
  { icone: Check, titre: "Progression", texte: "Les croix déjà brodées et vos séances, conservées séparément du motif — rosace ou patron importé." },
  { icone: Undo2, titre: "Annuler / rétablir", texte: "Essayez une forme, revenez en arrière, comparez." },
  { icone: Share2, titre: "Lien de partage", texte: "La signature et la palette voyagent avec le lien." },
];

function Progression() {
  return (
    <section id="progression" className="section" aria-labelledby="titre-progression">
      <div className="section-tete" data-reveal>
        <p className="surtitre">07 — Gardez votre progression</p>
        <h2 id="titre-progression">Votre rosace vous appartient.</h2>
        <p className="section-chapeau">
          Sauvegardez une création, reprenez votre progression d'un appareil à l'autre, comparez plusieurs palettes et
          exportez votre projet quand vous êtes prêt. Un patron importé se garde de la même façon.
        </p>
      </div>

      <div className="garde">
        <ul className="garde-liste" data-reveal>
          {GARDE.map(({ icone: Icone, titre, texte }) => (
            <li key={titre}>
              <Icone size={22} strokeWidth={1.6} aria-hidden="true" />
              <div>
                <h3>{titre}</h3>
                <p>{texte}</p>
              </div>
            </li>
          ))}
          <li>
            <Redo2 size={22} strokeWidth={1.6} aria-hidden="true" />
            <div>
              <h3>Palettes comparées</h3>
              <p>
                {HERO_STATS.threads} fils suffisent ici : {HERO_STATS.skeins} échevettes,{" "}
                {decimal(HERO_STATS.meters)} m de fil, {HERO_STATS.duration}.
              </p>
            </div>
          </li>
        </ul>

        <div className="exports" data-reveal>
          <p className="exports-titre">Emporter l'ouvrage</p>
          <ul>
            {EXPORTS.map(({ id, titre, usage, icone: Icone }) => (
              <li key={id}>
                <span className="export-icone">
                  <Icone size={18} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <strong>{titre}</strong>
                <span className="export-usage">{usage}</span>
              </li>
            ))}
          </ul>
          <a className="bouton bouton-noir bouton-large" href="#atelier-export">
            Exporter un projet
            <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- Public */
const PUBLICS = [
  {
    titre: "Je découvre la broderie",
    texte: "Commencer avec une composition simple, sans compte et sans matériel compliqué.",
  },
  {
    titre: "Je cherche un motif personnel",
    texte: "Créer une rosace qui n'existe nulle part ailleurs, avec vos couleurs.",
  },
  {
    titre: "Je veux préparer un ouvrage",
    texte: "Obtenir une grille, des couleurs et des dimensions précises avant de piquer l'aiguille.",
  },
  {
    titre: "J'ai déjà un patron PDF",
    texte: "Importer ses pages, recomposer la grille dans l'atelier et suivre chaque croix jusqu'à la dernière — ou broder un prénom en quelques lettres.",
    href: "#atelier-importer",
  },
];

function Public() {
  return (
    <section id="public" className="section section--papier" aria-labelledby="titre-public">
      <div className="section-tete" data-reveal>
        <p className="surtitre">08 — Pour qui</p>
        <h2 id="titre-public">
          Pour celles et ceux qui aiment créer avec leurs mains.
        </h2>
        <p className="section-chapeau">
          Brodeurs débutants, passionnés de point de croix, amateurs de motifs géométriques et créateurs
          textiles : ROSACE vous aide à passer de l'idée à l'ouvrage.
        </p>
      </div>

      <ul className="publics" data-reveal>
        {PUBLICS.map((entree, index) => (
          <li key={entree.titre}>
            <span className="public-num">0{index + 1}</span>
            <h3>{entree.titre}</h3>
            <p>{entree.texte}</p>
            {"href" in entree && entree.href && <a className="lien-souligne" href={entree.href}>Importer un patron</a>}
          </li>
        ))}
      </ul>

      <p className="public-fils" data-reveal>
        Point de croix compté <span aria-hidden="true">·</span> coton DMC Mouliné{" "}
        <span aria-hidden="true">·</span> aïda 14, 16 ou 18.
      </p>
    </section>
  );
}

export function LandingSections() {
  return (
    <>
      <Broder />
      <Entrees />
      <Formes />
      <Couleurs />
      <Patron />
      <Photo />
      <Progression />
      <Public />
    </>
  );
}
