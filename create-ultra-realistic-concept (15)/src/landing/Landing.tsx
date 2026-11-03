import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { RosaceLogo } from "../components/RosaceLogo";
import { LandingSections } from "./Sections";
import { HERO_PATTERN, HERO_STATS, decimal, nombre } from "./data";
import { EcranAtelier, EcranBroderie, EcranGrille, Ordinateur, Tablette, Telephone } from "./devices";

const LIENS = [
  { href: "#formes", label: "Formes" },
  { href: "#couleurs", label: "Couleurs" },
  { href: "#realisation", label: "Réalisation" },
  { href: "#vues", label: "Deux vues" },
  { href: "#progression", label: "Progression" },
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
      <a className="lien-evitement" href="#formes">Aller au contenu</a>

      <header className="entete">
        <div className="entete-haut">
          <a className="entete-marque" href="#haut" aria-label="ROSACE, retour en haut de la présentation">
            <span className="entete-nom">
              ROSACE<sup>®</sup>
            </span>
          </a>
          <div className="entete-droite">
            <RosaceLogo size={78} variant="nu" />
            <p className="entete-baseline">La géométrie devient broderie.</p>
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
              <span className="heros-titre-serif"> devient broderie.</span>
            </h1>
            <p className="heros-chapeau">
              Composez un motif circulaire, explorez les couleurs, puis donnez-lui une forme réelle sur toile.
              Chaque rosace devient un patron avec ses croix, ses fils DMC et ses dimensions.
            </p>
            <div className="heros-actions">
              <a className="bouton bouton-noir" href="#atelier">
                Composer une rosace
                <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
              </a>
              <a className="bouton bouton-contour" href="#realisation">
                Voir comment ça marche
              </a>
            </div>
            <p className="heros-mention">
              Gratuit à essayer <span aria-hidden="true">·</span> Aucun compte nécessaire pour commencer
            </p>
          </div>

          <div className="heros-appareils">
            <div className="heros-decor" aria-hidden="true" />
            <div
              className="heros-ecrans"
              role="img"
              aria-label="ROSACE sur ordinateur, tablette et téléphone : l'atelier de composition, la grille technique et le suivi de la broderie."
            >
              <Ordinateur className="heros-ordi">
                <EcranAtelier pattern={HERO_PATTERN} />
              </Ordinateur>
              <div className="heros-mobiles">
                <Tablette className="heros-tablette">
                  <EcranGrille pattern={HERO_PATTERN} />
                </Tablette>
                <Telephone className="heros-tel">
                  <EcranBroderie pattern={HERO_PATTERN} compact />
                </Telephone>
              </div>
            </div>
          </div>
          <ul className="heros-infos" aria-label="Le patron en chiffres">
            {INFOS.map((info) => (
              <li key={info.note}>
                <strong>{info.valeur}</strong>
                <span>{info.note}</span>
              </li>
            ))}
          </ul>
          <p className="heros-legende">
            Le même patron, de l'atelier à la broderie <span aria-hidden="true">·</span> ordinateur, tablette et téléphone.
          </p>
        </section>

        <LandingSections />

        {/* ------------------------------------------------------------- Appel final */}
        <section className="final" aria-labelledby="titre-final">
          <div className="final-appareil" aria-hidden="true">
            <span className="final-halo" />
            <Telephone className="final-tel">
              <EcranBroderie pattern={HERO_PATTERN} />
            </Telephone>
          </div>
          <div className="final-texte" data-reveal>
            <p className="surtitre surtitre-clair">Ouvrir l'atelier</p>
            <h2 id="titre-final">Votre prochaine rosace commence ici.</h2>
            <p>Composez une forme. Choisissez une palette. Brodez quelque chose qui vous ressemble.</p>
            <a className="bouton bouton-clair" href="#atelier">
              Ouvrir l'atelier
              <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
            </a>
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
          <a href="#formes">Formes</a>
          <a href="#couleurs">Couleurs</a>
          <a href="#realisation">Réalisation</a>
          <a href="#progression">Progression</a>
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
