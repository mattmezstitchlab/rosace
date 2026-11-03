import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Check, Download, FileText, Grid3x3, Heart, Layers, MousePointer2, Redo2, Share2, Undo2 } from "lucide-react";
import { EmbroideryHoop } from "../components/RosaceCanvas";
import { SYMBOLS, formatDuration } from "../lib/rosace";
import aida from "../assets/aida-macro.jpg";
import { HERO_PATTERN, HERO_STATS, PALETTE, SHAPE_VARIANTS, USED_THREADS, decimal, nombre } from "./data";
import { DmcCrown, RosaceRender } from "./media";

/* ------------------------------------------------------------------ Formes */
function Formes() {
  return (
    <section id="formes" className="section" aria-labelledby="titre-formes">
      <div className="section-tete" data-reveal>
        <p className="surtitre">01 — La promesse</p>
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
              <RosaceRender pattern={variant.pattern} resolution={560} label={`Rosace ${variant.label}, ${variant.pattern.stitches.length.toLocaleString("fr-FR")} croix`} />
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
        <p className="surtitre">02 — La couleur devient matière</p>
        <h2 id="titre-couleurs">
          Choisissez avec vos yeux.
          <br />
          Brodez avec les bonnes références.
        </h2>
        <p className="section-chapeau">
          La couronne ROSACE permet d'explorer les couleurs DMC, de construire une palette et de vérifier son
          contraste avant de commencer.
        </p>
      </div>

      <div className="couleurs" data-reveal>
        <div className="couleurs-mosaique">
          <div className="couleurs-couronne">
            <div className="couronne-cadre">
              <DmcCrown palette={HERO_PATTERN.config.palette} />
              <div className="couronne-coeur">
                <RosaceRender pattern={HERO_PATTERN} resolution={420} label="La rosace entourée de la couronne DMC" />
              </div>
            </div>
            <p className="couleurs-legende">
              <strong>{nombre(489)}</strong> références DMC Mouliné, une couronne continue.
            </p>
          </div>

          <div className="couleurs-duo">
            <div className="couleurs-apercu">
              <RosaceRender pattern={HERO_PATTERN} resolution={560} label="La rosace brodée avec la palette DMC retenue" />
              <p className="couleurs-apercu-legende">La même rosace, une fois les fils choisis.</p>
            </div>

            <figure className="couleurs-matiere">
              <img src={aida} alt="Aïda naturelle, fil de coton et aiguille posés sur la toile" loading="lazy" />
              <figcaption>La matière : aïda 14, deux brins, un tambour de 20 cm.</figcaption>
            </figure>
          </div>
        </div>

        <div className="couleurs-palette">
          <p className="couleurs-titre">La palette de la rosace</p>
          <ul className="fils">
            {PALETTE.map((thread) => {
              const usage = USED_THREADS.find((entry) => entry.code === thread.code);
              return (
                <li key={thread.code}>
                  <span className="fil-pastille" style={{ background: thread.hex }} aria-hidden="true" />
                  <span className="fil-nom">
                    <strong>DMC {thread.code}</strong>
                    <small>{thread.name}</small>
                  </span>
                  <span className="fil-metres">
                    {usage ? `${nombre(usage.count)} croix` : "—"}
                    <small>{usage ? `${decimal(usage.meters)} m` : "non employé"}</small>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="couleurs-note">
            Les couleurs affichées sont liées à une palette de fils identifiable, pas à des couleurs arbitraires
            d'écran.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Réalisation */
function Realisation() {
  const [split, setSplit] = useState(50);
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
    <section id="realisation" className="section" aria-labelledby="titre-realisation">
      <div className="section-tete" data-reveal>
        <p className="surtitre">03 — Du motif au patron</p>
        <h2 id="titre-realisation">
          Ce que vous créez à l'écran
          <br />
          prend vie sur toile.
        </h2>
        <p className="section-chapeau">
          ROSACE calcule les croix, les couleurs, les dimensions, les métrages et le temps estimé. Vous pouvez
          ensuite consulter la grille et préparer votre ouvrage.
        </p>
      </div>

      <ol className="etapes" data-reveal>
        <li>
          <span className="etape-num">1</span>
          <div className="etape-image">
            <RosaceRender pattern={HERO_PATTERN} resolution={480} label="Le motif brodé" />
          </div>
          <h3>Motif</h3>
          <p>L'aperçu textile de votre rosace.</p>
        </li>
        <li>
          <span className="etape-num">2</span>
          <div className="etape-image etape-image--grille">
            <RosaceRender pattern={HERO_PATTERN} mode="chart" resolution={480} label="La grille technique, symbole par fil" />
          </div>
          <h3>Grille</h3>
          <p>Chaque croix, son symbole et son fil.</p>
        </li>
        <li>
          <span className="etape-num">3</span>
          <div className="etape-image etape-image--detail">
            <div className="etape-zoom">
              <RosaceRender pattern={HERO_PATTERN} resolution={480} label="Détail des croix brodées, vu de près" />
            </div>
          </div>
          <h3>Broderie</h3>
          <p>Le détail des points, prêt à être suivi.</p>
        </li>
      </ol>

      <div className="comparateur" data-reveal>
        <div className="comparateur-tete">
          <h3>Un seul patron, deux lectures.</h3>
          <p>Attrapez le trait et faites-le glisser : la forme ne change pas, seule la lecture change.</p>
        </div>

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
          <RosaceRender pattern={HERO_PATTERN} resolution={900} label="La rosace brodée" />
          <div className="comparateur-grille" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
            {/* La grille a sa propre marge technique : on la recale sur le rendu textile
                pour que les deux moitiés se répondent exactement au trait de comparaison. */}
            <div className="comparateur-aligne">
              <RosaceRender pattern={HERO_PATTERN} mode="chart" resolution={900} label="La grille technique du même patron" />
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

        <p className="comparateur-aide">
          <MousePointer2 size={14} strokeWidth={1.9} aria-hidden="true" />
          Glissez le trait — ou les flèches du clavier — pour passer du motif à la grille.
        </p>
      </div>

      <ul className="chiffres" data-reveal aria-label="Le patron calculé">
        <li>
          <strong>{nombre(HERO_STATS.stitches)}</strong>
          <span>croix calculées</span>
        </li>
        <li>
          <strong>{HERO_STATS.threads}</strong>
          <span>fils DMC</span>
        </li>
        <li>
          <strong>{decimal(HERO_STATS.widthCm)} cm</strong>
          <span>sur aïda {HERO_STATS.aida}</span>
        </li>
        <li>
          <strong>{HERO_STATS.duration}</strong>
          <span>estimées</span>
        </li>
        <li>
          <strong>{nombre(HERO_STATS.skeins)}</strong>
          <span>échevettes</span>
        </li>
      </ul>

      <p className="section-manifeste" data-reveal>
        Ce n'est pas seulement une image générée.
        <span> C'est un patron exploitable.</span>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------- Vues */
const VUES = [
  { id: "textile", label: "Textile", legende: "Le rendu brodé, fil par fil, sur l'aïda." },
  { id: "tambour", label: "Tambour", legende: "L'ouvrage dans son cadre, tel qu'il sera tenu." },
  { id: "grille", label: "Grille", legende: "La lecture technique : symboles, repères et coordonnées." },
  { id: "zoom", label: "Zoom", legende: "Le détail d'une zone, croix par croix." },
] as const;

type VueId = (typeof VUES)[number]["id"];

function Vues() {
  const [vue, setVue] = useState<VueId>("textile");
  const base = useId();
  const active = VUES.find((entry) => entry.id === vue)!;

  return (
    <section id="vues" className="section section--papier" aria-labelledby="titre-vues">
      <div className="section-tete" data-reveal>
        <p className="surtitre">04 — Une interface pour créer, une grille pour broder</p>
        <h2 id="titre-vues">
          Deux vues,
          <br />
          un même motif.
        </h2>
        <p className="section-chapeau">
          Travaillez dans une vue expressive, puis passez à la grille technique lorsque vous commencez à broder.
          La forme reste la même. Seule la lecture change.
        </p>
      </div>

      <div className="vues" data-reveal>
        <div className="vues-onglets" role="tablist" aria-label="Vues du patron">
          {VUES.map((entree) => (
            <button
              key={entree.id}
              id={`${base}-onglet-${entree.id}`}
              type="button"
              role="tab"
              aria-selected={vue === entree.id}
              aria-controls={`${base}-panneau`}
              tabIndex={vue === entree.id ? 0 : -1}
              className={vue === entree.id ? "est-active" : ""}
              onClick={() => setVue(entree.id)}
            >
              {entree.label}
            </button>
          ))}
        </div>

        <div
          className="vues-scene"
          id={`${base}-panneau`}
          role="tabpanel"
          aria-labelledby={`${base}-onglet-${vue}`}
        >
          {vue === "tambour" ? (
            <div className="vues-tambour">
              <EmbroideryHoop pattern={HERO_PATTERN} />
            </div>
          ) : (
            <div className={`vues-cadre vues-cadre--${vue}`}>
              {vue === "zoom" ? (
                <div className="vues-zoom">
                  <RosaceRender pattern={HERO_PATTERN} resolution={1500} label="Détail brodé, grossi" />
                </div>
              ) : (
                <RosaceRender
                  pattern={HERO_PATTERN}
                  mode={vue === "grille" ? "chart" : "fabric"}
                  resolution={900}
                  label={vue === "grille" ? "Grille technique du patron" : "Rendu textile du patron"}
                />
              )}
            </div>
          )}

          <div className="vues-lecture">
            <p className="vues-surtitre">Lecture du patron</p>
            <p>{active.legende}</p>
            <dl>
              <div>
                <dt>Grille</dt>
                <dd>
                  {HERO_STATS.grid} × {HERO_STATS.grid}
                </dd>
              </div>
              <div>
                <dt>Croix</dt>
                <dd>{nombre(HERO_STATS.stitches)}</dd>
              </div>
              <div>
                <dt>Fils DMC</dt>
                <dd>{HERO_STATS.threads}</dd>
              </div>
            </dl>
            <ul className="vues-legende" aria-label="Fils et symboles du patron">
              {PALETTE.map((thread, index) => (
                <li key={thread.code}>
                  <b aria-hidden="true">{SYMBOLS[index]}</b>
                  <i style={{ background: thread.hex }} aria-hidden="true" />
                  <span>
                    DMC {thread.code}
                    <small>{thread.name}</small>
                  </span>
                </li>
              ))}
            </ul>
            <p className="vues-note">
              La grille et le rendu sortent du même patron : ce ne sont pas deux motifs différents.
            </p>
          </div>
        </div>
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
  { id: "projet", titre: "Projet ROSACE", usage: "Reprendre plus tard", icone: Heart },
];

const GARDE = [
  { icone: Heart, titre: "Collection", texte: "Vos rosaces enregistrées, prêtes à être rouvertes." },
  { icone: Check, titre: "Progression", texte: "Les croix déjà brodées, conservées séparément du motif." },
  { icone: Undo2, titre: "Annuler / rétablir", texte: "Essayez une forme, revenez en arrière, comparez." },
  { icone: Share2, titre: "Lien de partage", texte: "La signature et la palette voyagent avec le lien." },
];

function Progression() {
  return (
    <section id="progression" className="section" aria-labelledby="titre-progression">
      <div className="section-tete" data-reveal>
        <p className="surtitre">05 — Gardez votre progression</p>
        <h2 id="titre-progression">Votre rosace vous appartient.</h2>
        <p className="section-chapeau">
          Sauvegardez une création, reprenez votre progression, comparez plusieurs palettes et exportez votre
          projet quand vous êtes prêt.
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
];

function Public() {
  return (
    <section id="public" className="section section--papier" aria-labelledby="titre-public">
      <div className="section-tete" data-reveal>
        <p className="surtitre">06 — Pour qui</p>
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
      <Formes />
      <Couleurs />
      <Realisation />
      <Vues />
      <Progression />
      <Public />
    </>
  );
}
