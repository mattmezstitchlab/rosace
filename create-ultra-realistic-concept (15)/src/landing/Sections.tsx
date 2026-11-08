import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Check, Circle, Download, FileText, Grid3x3, Heart, Image as ImageIcon, Layers, MousePointer2, Printer, Redo2, Share2, Type, Undo2 } from "lucide-react";
import { formatDuration } from "../lib/rosace";
import type { CanvasMode } from "../lib/paint";
import { HERO_PATTERN, HERO_STATS, SHAPE_VARIANTS, TEXT_WORK, decimal, nombre } from "./data";
import { EcranImport, Tablette } from "./devices";
import { DemoPuzzle } from "./DemoPuzzle";
import { DemoPhoto } from "./DemoPhoto";
import { Nuancier } from "./Nuancier";
import { RosaceRender } from "./media";

/* ------------------------------------------------------------------ Entrées */
/**
 * Les quatre portes de l'atelier. Chaque image sort du moteur : la rosace du hero,
 * sa grille découpée en pages comme l'import la recompose, un texte dans la police brodée.
 */

function Entrees() {
  // L'entrée photo montre une autre grille du moteur que la rosace du hero : pas de doublon visuel.
  const motifConversion = SHAPE_VARIANTS.find((variant) => variant.id === "geometrique")?.pattern ?? HERO_PATTERN;
  return (
    <section id="entrees" className="section" aria-labelledby="titre-entrees">
      <div className="section-tete" data-reveal>
        <p className="surtitre">Choisir mon départ</p>
        <h2 id="titre-entrees">Qu’aimeriez-vous créer aujourd’hui ?</h2>
        <p className="section-chapeau">
          Choisissez votre point de départ. Chaque création devient un patron que vous pouvez personnaliser, imprimer et suivre croix par croix.
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
            <p>Une composition unique à faire évoluer avec vos formes et vos couleurs.</p>
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
            <p>Importez un patron. Les données non reconnues sont signalées avant utilisation.</p>
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
            <p>Quelques lettres deviennent des croix, dans la police brodée et les fils de votre choix.</p>
            <a className="lien-souligne" href="#atelier-importer-texte">Écrire un texte brodé</a>
          </div>
        </li>
        <li className="entree">
          <div className="entree-image entree-image--photo">
            <RosaceRender pattern={motifConversion} mode="color" resolution={640} label="Un exemple de grille colorée produite dans l’atelier" />
          </div>
          <div className="entree-texte">
            <p className="entree-sur"><ImageIcon size={13} strokeWidth={2} aria-hidden="true" /> Convertir</p>
            <h3>Une photo, triée en fils</h3>
            <p>À partir de votre image, obtenez une grille et une palette de fils DMC approchante.</p>
            <a className="lien-souligne" href="#atelier-importer-photo">Convertir une photo</a>
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
        <p className="surtitre">La promesse</p>
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
        <p className="surtitre">La couleur devient matière</p>
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
        <p className="surtitre">Découvrir l’import PDF</p>
        <h2 id="titre-realisation">
          Quatre pages, un puzzle,<br /> une grille vérifiée.
        </h2>
        <p className="section-chapeau">
          Cette démonstration recompose quatre pages du même patron et vérifie leur empreinte. Avec un PDF externe, certaines informations peuvent manquer : elles seront signalées.
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
  { id: "fabric", label: "Toile", note: "Vision proche du rendu final sur aïda" },
  { id: "chart", label: "Symboles", note: "Lecture maximale, idéale pour suivre ligne par ligne" },
  { id: "color", label: "Couleurs", note: "Repérage rapide des zones par fil DMC" },
  { id: "color-chart", label: "Les deux", note: "Couleurs + symboles : compromis de production" },
] as const;

type AffichageId = (typeof AFFICHAGES)[number]["id"];

function Broder() {
  const [affichage, setAffichage] = useState<AffichageId>("fabric");
  const actif = AFFICHAGES.find((entry) => entry.id === affichage) ?? AFFICHAGES[0];

  return (
    <section id="broder" className="section" aria-labelledby="titre-broder">
      <div className="section-tete" data-reveal>
        <p className="surtitre">Broder, en vrai</p>
        <h2 id="titre-broder">Une vraie grille de production, pas une maquette.</h2>
        <p className="section-chapeau">
          Le même motif passe de la toile à la grille technique sans changer d'empreinte. Vous choisissez la lecture,
          puis l'atelier calcule le reste : progression, restants, séances, export.
        </p>
      </div>

      <div className="broder-vitrine" data-reveal>
        <div className="broder-vitrine-main">
          <div className="vivant-onglets" aria-label="Affichages du mode Broder">
            {AFFICHAGES.map((entree) => (
              <button
                key={entree.id}
                type="button"
                aria-pressed={affichage === entree.id}
                className={affichage === entree.id ? "est-active" : ""}
                onClick={() => setAffichage(entree.id)}
              >
                {entree.label}
              </button>
            ))}
          </div>

          <figure className="broder-vitrine-cadre">
            <RosaceRender
              pattern={HERO_PATTERN}
              mode={affichage}
              resolution={affichage === "fabric" ? 760 : 980}
              label={`Mode ${actif.label.toLowerCase()} du même patron, ${nombre(HERO_STATS.stitches)} croix`}
            />
            <figcaption>{actif.note}</figcaption>
          </figure>
        </div>

        <aside className="broder-vitrine-aside" aria-label="Ce que la vue Broder calcule automatiquement">
          <p className="broder-vitrine-titre">Ce que l'atelier calcule pendant que vous brodez</p>
          <dl>
            <div><dt>Croix</dt><dd>{nombre(HERO_STATS.stitches)}</dd></div>
            <div><dt>Fils actifs</dt><dd>{HERO_STATS.threads} DMC</dd></div>
            <div><dt>Format</dt><dd>{HERO_STATS.grid} × {HERO_STATS.grid}</dd></div>
            <div><dt>Temps estimé</dt><dd>{HERO_STATS.duration}</dd></div>
          </dl>
          <ul>
            <li>Annuler / rétablir sans casser la progression</li>
            <li>Fil conducteur vers la prochaine zone compacte</li>
            <li>Projet exportable pour reprendre ailleurs</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Photo */
function Photo() {
  return (
    <section id="photo" className="section section--papier" aria-labelledby="titre-photo">
      <div className="section-tete" data-reveal>
        <p className="surtitre">De la photo au fil</p>
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
  { id: "projet", titre: "Projet ROSACE", usage: "Reprendre et partager une progression", icone: Heart },
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
        <p className="surtitre">Gardez votre progression</p>
        <h2 id="titre-progression">Votre rosace vous appartient.</h2>
        <p className="section-chapeau">
          Votre progression est gardée sur cet appareil. Pour reprendre sur un autre, exportez votre fichier projet puis importez-le sur le nouvel appareil : il n’y a pas de synchronisation automatique.
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

export function LandingSections() {
  return (
    <>
      <Entrees />
      <Formes />
      <Couleurs />
      <Broder />
      <Progression />
      <details className="landing-plus" id="plus">
        <summary>Explorer les démonstrations avancées : PDF et photo</summary>
        <Patron />
        <Photo />
      </details>
    </>
  );
}
