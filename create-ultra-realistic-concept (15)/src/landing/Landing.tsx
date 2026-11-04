import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { RosaceLogo } from "../components/RosaceLogo";
import { Comparateur, LandingSections } from "./Sections";
import { HERO_STATS, decimal, nombre } from "./data";

const LIENS = [
  { href: "#entrees", label: "Trois portes" },
  { href: "#formes", label: "Formes" },
  { href: "#couleurs", label: "Couleurs" },
  { href: "#realisation", label: "Patron" },
  { href: "#broder", label: "Broder" },
  { href: "#progression", label: "Garder" },
  { href: "#atelier-importer", label: "Importer" },
];


const INFOS = [
  { valeur: `${nombre(HERO_STATS.stitches)} croix`, note: "patron calculé" },
  { valeur: `${HERO_STATS.threads} fils DMC`, note: "références identifiables" },
  { valeur: `${decimal(HERO_STATS.widthCm)} cm`, note: `aïda ${HERO_STATS.aida}` },
  { valeur: `${HERO_STATS.duration}`, note: "temps estimé" },
];

/**
 * La présentation de ROSACE : elle vend le résultat (une rosace devenue patron),
 * pas l'interface. L'atelier s'ouvre par le bouton, jamais par défaut.
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
              La géométrie
              <span className="heros-titre-suite"> devient broderie.</span>
            </h1>
            <p className="heros-chapeau">
              Composez une rosace, importez un patron PDF ou écrivez un mot en croix : un seul atelier, une grille vivante,
              chaque croix suivie jusqu'à la dernière — avec ses fils DMC, ses dimensions et son temps.
            </p>
            <div className="heros-actions">
              <a className="bouton bouton-noir" href="#atelier">
                Composer une rosace
                <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
              </a>
              <a className="bouton bouton-contour" href="#atelier-importer">
                Importer un patron PDF
              </a>
            </div>
            <p className="heros-mention">
              Gratuit à essayer <span aria-hidden="true">·</span> Aucun compte nécessaire pour commencer <span aria-hidden="true">·</span> <a href="#entrees">Voir comment ça marche</a>
            </p>
            <p className="heros-mention">Au-dessus, attrapez le trait : d'un côté les croix, de l'autre la grille — le même patron.</p>
          </div>

          <ul className="heros-infos" aria-label="Le patron en chiffres">
            {INFOS.map((info) => (
              <li key={info.note}>
                <strong>{info.valeur}</strong>
                <span>{info.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <LandingSections />

        {/* ------------------------------------------------------------- Appel final */}
        <section className="final" aria-labelledby="titre-final">
          <div className="final-texte" data-reveal>
            <p className="surtitre surtitre-clair">Ouvrir l'atelier</p>
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
          <a href="#entrees">Trois portes</a>
          <a href="#formes">Formes</a>
          <a href="#couleurs">Couleurs</a>
          <a href="#broder">Broder</a>
          <a href="#progression">Garder</a>
          <a href="#atelier">Atelier</a>
          <a href="#atelier-importer">Importer</a>
        </nav>
        <p className="pied-legal">
          Un atelier par LE MONDE AIME®.<br />
          Les teintes DMC affichées sont des approximations d'écran ; le fil réel reste la référence.
        </p>
      </footer>
    </div>
  );
}
