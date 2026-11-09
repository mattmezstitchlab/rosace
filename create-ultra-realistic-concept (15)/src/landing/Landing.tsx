import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { RosaceLogo } from "../components/RosaceLogo";
import { Comparateur, LandingSections } from "./Sections";

const LIENS = [
  { href: "#entrees", label: "Créer" },
  { href: "#formes", label: "Découvrir" },
  { href: "#broder", label: "Broder" },
];

/**
 * La présentation de ROSACE : une page de vente composée avec le moteur du produit
 * (mêmes rendus, mêmes fils DMC). L'atelier s'ouvre par un bouton, jamais par défaut.
 */
export function Landing() {
  const [barre, setBarre] = useState(false);
  /* Le trait du comparateur est aussi celui du mot-symbole : entre le S et le A, d'entrée de jeu. */
  const [split, setSplit] = useState(50);
  const [largeur, setLargeur] = useState<number | null>(null);
  const nomRef = useRef<HTMLSpanElement>(null);

  /* Le comparateur prend exactement la largeur du mot ROSACE : le trait traverse les deux. */
  useEffect(() => {
    const target = nomRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setLargeur(Math.round(entry.contentRect.width)));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setBarre(window.scrollY > 180);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.add("est-presentation");
    return () => document.body.classList.remove("est-presentation");
  }, []);

  /* Apparition douce des blocs, sans mouvement pour qui le refuse. */
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!targets.length || typeof IntersectionObserver === "undefined") {
      targets.forEach((target) => target.classList.add("est-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("est-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="presentation" id="haut">
      <a className="lien-evitement" href="#entrees">Aller au contenu</a>

      <header className="entete">
        <div className="entete-haut">
          <span className="entete-nom" ref={nomRef}>
            <a className="entete-marque" href="#haut" aria-label="ROSACE® — retour en haut de la présentation">
              <span className="entete-nom-plein">ROSACE<sup>®</sup></span>
            </a>
            <span className="entete-nom-grille" aria-hidden="true" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>ROSACE<sup>®</sup></span>
          </span>
          <div className="heros-comparateur" style={largeur ? { width: `${largeur}px` } : undefined}>
            <Comparateur split={split} onSplit={setSplit} resolution={1400} leftMode="stitches" aide={false} />
          </div>
        </div>
        <div className="entete-bas">
          <nav className="entete-liens" aria-label="Sections de la présentation">
            {LIENS.map((lien) => (
              <a key={lien.href} href={lien.href}>
                {lien.label}
              </a>
            ))}
          </nav>
          <a className="bouton bouton-noir entete-cta" href="#atelier">
            Ouvrir l'atelier
            <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </header>

      {/* La barre fine n'apparaît qu'une fois le masthead passé. */}
      <div className={`barre${barre ? " est-visible" : ""}`}>
        <a className="barre-marque" href="#haut" aria-label="ROSACE, retour en haut de la présentation">
          ROSACE<sup>®</sup>
        </a>
        <nav className="barre-liens" aria-label="Sections de la présentation (raccourci)">
          {LIENS.map((lien) => (
            <a key={lien.href} href={lien.href}>
              {lien.label}
            </a>
          ))}
        </nav>
        <a className="bouton bouton-noir barre-cta" href="#atelier">
          Ouvrir l'atelier
        </a>
      </div>

      <main>
        {/* ---------------------------------------------------------------- Hero */}
        <section className="heros" aria-labelledby="titre-heros">
          <div className="heros-texte">
            <p className="surtitre">Atelier de point de croix</p>
            <h1 id="titre-heros" className="heros-titre">
              Imaginez le motif.
              <span className="heros-titre-suite"> Brodez-le.</span>
            </h1>
            <p className="heros-chapeau">
              Créez un patron de point de croix unique, choisissez vos fils DMC, puis suivez chaque croix jusqu’à la dernière. La géométrie devient broderie.
            </p>
            <div className="heros-actions">
              <a className="bouton bouton-noir" href="#atelier">
                Créer mon premier motif
                <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
              </a>
              <a className="bouton bouton-contour" href="#entrees">
                Choisir comment commencer
              </a>
            </div>
            <p className="heros-mention">
              Essai gratuit <span aria-hidden="true">·</span> Sans compte pour commencer <span aria-hidden="true">·</span> Quatre façons de créer
            </p>
            <p className="heros-mention heros-mention--indice">Au-dessus, glissez le trait pour révéler le motif et sa grille technique.</p>
          </div>
        </section>

        <LandingSections />

        {/* ------------------------------------------------------------- Appel final */}
        <section className="final" aria-labelledby="titre-final">
          <div className="final-texte" data-reveal>
            <p className="surtitre surtitre-clair">À vous de jouer</p>
            <h2 id="titre-final">Votre prochain ouvrage commence ici.</h2>
            <p>Composez une forme, importez un patron ou écrivez un prénom. Puis brodez quelque chose qui vous ressemble.</p>
            <div className="final-actions">
              <a className="bouton bouton-clair" href="#atelier">
                Ouvrir l'atelier
                <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
              </a>
              <a className="bouton bouton-clair bouton-clair--discret" href="#atelier-importer">
                Importer un PDF
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="pied">
        <div className="pied-marque">
          <RosaceLogo size={38} />
          <div>
            <p className="pied-nom">ROSACE<sup>®</sup></p>
            <p className="pied-sous">La géométrie devient broderie.</p>
          </div>
        </div>
        <nav className="pied-liens" aria-label="Liens de la présentation">
          <a href="#entrees">Créer</a>
          <a href="#formes">Découvrir</a>
          <a href="#broder">Broder</a>
          <a href="#atelier">Atelier</a>
        </nav>
        <p className="pied-legal">
          Un atelier par LE MONDE AIME®.<br />
          Les teintes DMC affichées sont des approximations d'écran ; le fil réel reste la référence.
        </p>
      </footer>
    </div>
  );
}
