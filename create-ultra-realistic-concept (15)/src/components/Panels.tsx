import { Check, Copy, Dices, Download, FileCode2, FileImage, FileText, Plus, RotateCcw, Search, Table2, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { DMC_ALL_THREADS, getThread } from "../data/dmc";
import { patternFingerprint, shortFingerprint } from "../lib/pattern-id";
import { HARMONY_HINT, HARMONY_LABELS, ROLE_LABELS, type Harmony } from "../lib/harmony";
import { DIMENSION_NAMES, FABRIC_COLORS, SYMBOLS, type AidaCount, type FabricTone } from "../lib/rosace";
import { THEME_LABELS, THEME_ORDER, readThemeChoice, saveThemeChoice, type ThemeChoice } from "../lib/theme";
import { formatSeed, useRosaceApi, type PanelId } from "../state/rosace-store";

/**
 * Les panneaux des catégories. Ils ne recalculent rien :
 * chaque commande appelle une fonction existante du store (commit, applyColor, exportActions…).
 */

const FORM_SLIDERS = [
  { key: "structure", label: "Pétales" },
  { key: "trace", label: "Tracé" },
  { key: "density", label: "Densité" },
  { key: "scale", label: "Échelle" },
  { key: "geometry", label: "Géométrie" },
  { key: "twist", label: "Tourbillon" },
  { key: "wave", label: "Ondulation" },
] as const;

const FORM_NAMES: Record<string, string[]> = {
  ...DIMENSION_NAMES,
  twist: ["Immobile", "Léger", "Tournant", "Spiralé", "Vertigineux"],
  wave: ["Stricte", "Douce", "Souple", "Ondoyante", "Éventail"],
};

export function FormPanel() {
  const api = useRosaceApi();
  const { config } = api;
  return (
    <div className="panneau-forme">
      {FORM_SLIDERS.map((item) => {
        const value = config[item.key];
        const names = FORM_NAMES[item.key];
        const max = names.length;
        return (
          <label className="curseur" key={item.key}>
            <span className="curseur-tete">
              <span className="curseur-nom">{item.label}</span>
              <span className="curseur-valeur">{names[value - 1]} · {value}/{max}</span>
            </span>
            <input
              type="range"
              min="1"
              max={max}
              step="1"
              value={value}
              onChange={(event) => api.commit({ ...config, [item.key]: Number(event.target.value) })}
              style={{ "--curseur": `${((value - 1) / (max - 1)) * 100}%` } as CSSProperties}
              aria-label={item.label}
              aria-valuetext={`${names[value - 1]}, ${value} sur ${max}`}
            />
          </label>
        );
      })}
    </div>
  );
}

const HARMONIES: Harmony[] = ["complementaire", "analogue", "triade", "split", "monochrome"];

export function ColorsPanel() {
  const api = useRosaceApi();
  const { config, pattern, harmony, baseCode, warnings } = api;
  const activeRole = config.palette.indexOf(baseCode);
  return (
    <div className="panneau-couleurs">
      <div className="panneau-groupe">
        <p className="panneau-label">Harmonie autour de DMC {baseCode} · catalogue {DMC_ALL_THREADS.length} fils</p>
        <div className="harmonie-choix" role="group" aria-label="Type d'harmonie colorée">
          {HARMONIES.map((scheme) => (
            <button key={scheme} className={scheme === harmony ? "is-active" : ""} aria-pressed={scheme === harmony} onClick={() => api.changeHarmony(scheme)}>
              {HARMONY_LABELS[scheme]}
            </button>
          ))}
        </div>
        <p className="panneau-aide">{HARMONY_HINT[harmony]} Cliquez une couleur de la couronne pour repartir d'un autre fil.</p>
      </div>

      <div className="panneau-groupe">
        <p className="panneau-label">Les fils de l'ouvrage</p>
        <ul className="panneau-fils">
          {config.palette.map((code, index) => {
            const thread = getThread(code);
            const usage = pattern.usage[index];
            const isBase = code === baseCode;
            return (
              <li key={`${code}-${index}`} className={isBase ? "is-base" : ""}>
                <button
                  className="panneau-fil-choix"
                  style={{ background: thread.hex }}
                  onClick={() => api.applyColor(code)}
                  aria-label={`Partir de DMC ${code}, ${thread.name} (${ROLE_LABELS[index] ?? `fil ${index + 1}`})`}
                  title={`DMC ${code} · ${thread.name}`}
                />
                <span className="panneau-fil-texte">
                  <strong>DMC {code}</strong>
                  <small>{thread.name} · {ROLE_LABELS[index] ?? `Fil ${index + 1}`} {SYMBOLS[index]}</small>
                </span>
                <span className="panneau-fil-nb">{usage ? usage.count.toLocaleString("fr-FR") : "0"}</span>
                <button className="panneau-fil-action" onClick={() => { api.selectSlot(index); api.openCatalog("replace"); }} aria-label={`Remplacer DMC ${code} par un autre fil`}>
                  <Search size={15} aria-hidden="true" />
                </button>
                {config.palette.length > 3 && (
                  <button className="panneau-fil-action" onClick={() => api.removeThread(index)} aria-label={`Retirer DMC ${code} de l'ouvrage`}>
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
                {isBase && <span className="panneau-fil-base">départ</span>}
              </li>
            );
          })}
        </ul>
        <div className="panneau-rangee">
          {config.palette.length < 6 && (
            <button className="bouton bouton-petit" onClick={() => api.openCatalog("add")}><Plus size={15} aria-hidden="true" /> Ajouter un fil</button>
          )}
          <button className="bouton bouton-petit" onClick={() => api.openCatalog("replace")}><Search size={15} aria-hidden="true" /> Nuancier complet</button>
        </div>
        {activeRole > 0 && <p className="sr-only">Fil de départ : emplacement {activeRole + 1}</p>}
      </div>

      {warnings.length > 0 && (
        <ul className="panneau-alertes" aria-label="Contrôle des contrastes">
          {warnings.map((warning) => (
            <li key={`${warning.kind}-${warning.codes.join("-")}`}>
              <TriangleAlert size={14} aria-hidden="true" />
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const api = useRosaceApi();
  const { config, pattern } = api;
  const [theme, setTheme] = useState<ThemeChoice>(readThemeChoice);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(readThemeChoice());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const pickTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    saveThemeChoice(choice);
  };

  return (
    <div className="panneau-reglages">
      <div className="panneau-groupe">
        <p className="panneau-label">Signature de la rosace</p>
        <div className="panneau-rangee">
          <label className="champ-graine">
            <span className="sr-only">Signature, de 1 à 9999</span>
            <input type="number" min="1" max="9999" inputMode="numeric" value={config.seed} onChange={(event) => api.setSeed(Number(event.target.value))} />
          </label>
          <button className="bouton bouton-petit" onClick={api.generateVariation}><Dices size={15} aria-hidden="true" /> Tirer une signature</button>
        </div>
        <p className="panneau-aide">La même signature, avec les mêmes réglages, redonne exactement la même rosace.</p>
      </div>

      <div className="panneau-groupe">
        <p className="panneau-label">Toile · {FABRIC_COLORS[config.fabric].name}, aïda {config.aida}</p>
        <div className="options" role="group" aria-label="Couleur de la toile">
          {(Object.keys(FABRIC_COLORS) as FabricTone[]).map((fabric) => (
            <button key={fabric} className={`option ${config.fabric === fabric ? "is-active" : ""}`} aria-pressed={config.fabric === fabric} onClick={() => api.setFabric(fabric)}>
              <i style={{ background: FABRIC_COLORS[fabric].base }} aria-hidden="true" />{FABRIC_COLORS[fabric].name.replace("Lin ", "")}
            </button>
          ))}
        </div>
        <div className="options" role="group" aria-label="Comptage de l'aïda">
          {([14, 16, 18] as AidaCount[]).map((aida) => (
            <button key={aida} className={`option ${config.aida === aida ? "is-active" : ""}`} aria-pressed={config.aida === aida} onClick={() => api.setAida(aida)}>Aïda {aida}</button>
          ))}
        </div>
        <p className="panneau-aide">Motif fini {String(pattern.motifCm).replace(".", ",")} cm · toile à couper {pattern.cutCm} × {pattern.cutCm} cm.</p>
      </div>

      <div className="panneau-groupe">
        <p className="panneau-label">Fils et métrage · {pattern.config.strands} brins, marge {config.wastePercent} %</p>
        <div className="options" role="group" aria-label="Nombre de brins">
          {[1, 2, 3, 4, 5, 6].map((value) => (
            <button key={value} className={`option ${config.strands === value ? "is-active" : ""}`} aria-pressed={config.strands === value} onClick={() => api.commit({ ...config, strands: value })}>
              {value} brin{value > 1 ? "s" : ""}
            </button>
          ))}
        </div>
        <label className="curseur" style={{ marginTop: 10 }}>
          <span className="curseur-tete">
            <span className="curseur-nom">Marge de sécurité textile</span>
            <span className="curseur-valeur">{config.wastePercent === 0 ? "Sans marge" : `+ ${config.wastePercent} %`}</span>
          </span>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={config.wastePercent}
            style={{ "--curseur": `${(config.wastePercent / 50) * 100}%` } as CSSProperties}
            onChange={(event) => api.commit({ ...config, wastePercent: Number(event.target.value) })}
            onPointerDown={api.beginGesture}
            onPointerUp={api.endGesture}
            onPointerCancel={api.endGesture}
            aria-label="Marge de sécurité textile, de 0 à 50 %"
            aria-valuetext={config.wastePercent === 0 ? "Sans marge" : `+ ${config.wastePercent} %`}
          />
        </label>
        <p className="panneau-aide">
          Motif {String(pattern.motifWidthCm).replace(".", ",")} × {String(pattern.motifHeightCm).replace(".", ",")} cm ·
          {" "}{pattern.totalNeedleMeters.toFixed(1).replace(".", ",")} m de faisceau ({pattern.totalStrandMeters.toFixed(1).replace(".", ",")} m de brins) ·
          {" "}{pattern.totalSkeins} échevettes de 8 m.
        </p>
        <p className="panneau-aide">
          Temps estimé {Math.round(pattern.timeEstimate.low / 60)}–{Math.round(pattern.timeEstimate.high / 60)} h
          ({pattern.timeEstimate.assumedRate}). Le métrage est une estimation : tension, arrêts et cheminement au dos varient.
        </p>
      </div>

      <div className="panneau-groupe">
        <p className="panneau-label">Apparence</p>
        <div className="options" role="group" aria-label="Apparence">
          {THEME_ORDER.map((key) => (
            <button key={key} className={`option ${theme === key ? "is-active" : ""}`} aria-pressed={theme === key} onClick={() => pickTheme(key)}>
              {theme === key && <Check size={13} aria-hidden="true" />}{THEME_LABELS[key]}
            </button>
          ))}
        </div>
        <p className="panneau-aide">Auto suit le réglage de votre appareil.</p>
      </div>

      <div className="panneau-groupe">
        <div className="panneau-rangee">
          <button className="bouton bouton-petit" onClick={api.reset} disabled={api.isDefault}><RotateCcw size={15} aria-hidden="true" /> Réinitialiser la rosace</button>
        </div>
        <p className="panneau-aide panneau-raccourcis">
          Raccourcis : Ctrl Z annuler · Ctrl Maj Z rétablir · 1 à 6 catégories · Échap fermer. En mode Broder : Ctrl Z / Ctrl Y pour les croix, flèches, Espace, + / −, 0.
          Vos recettes restent sur cet appareil ; les couleurs écran sont indicatives.
        </p>
      </div>
    </div>
  );
}

export function ExportPanel() {
  const api = useRosaceApi();
  const actions = api.exportActions;
  const fileRef = useRef<HTMLInputElement>(null);
  const fingerprint = patternFingerprint(api.pattern);
  return (
    <div className="panneau-export">
      <div className="panneau-groupe">
        <p className="panneau-label">Projet ROSACE · empreinte {shortFingerprint(fingerprint)}</p>
        <div className="panneau-rangee">
          <button className="bouton bouton-petit" onClick={() => actions.project()}><FileCode2 size={15} aria-hidden="true" /> Exporter le projet</button>
          <button className="bouton bouton-petit" onClick={() => fileRef.current?.click()}><FileText size={15} aria-hidden="true" /> Importer un projet</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Importer un projet ROSACE" onChange={(event) => { const file = event.target.files?.[0]; if (file) void actions.projectImport(file); event.target.value = ""; }} />
        </div>
        <p className="panneau-aide">Le projet contient la recette exacte, la progression et son journal d'annulation. L'import est refusé si l'empreinte du patron ne correspond pas.</p>
      </div>
      <div className="export-liste">
        <button onClick={() => actions.png(false)}><FileImage size={20} aria-hidden="true" /><span><strong>PNG · toile</strong><small>1600 × 1600 px</small></span><Download size={14} aria-hidden="true" /></button>
        <button onClick={() => actions.png(true)}><FileImage size={20} aria-hidden="true" /><span><strong>PNG · grille</strong><small>Symboles et coordonnées</small></span><Download size={14} aria-hidden="true" /></button>
        <button onClick={() => actions.svg(false)}><FileCode2 size={20} aria-hidden="true" /><span><strong>SVG · motif</strong><small>Croix vectorielles</small></span><Download size={14} aria-hidden="true" /></button>
        <button onClick={() => actions.svg(true)}><FileCode2 size={20} aria-hidden="true" /><span><strong>SVG · grille</strong><small>Patron symbolique</small></span><Download size={14} aria-hidden="true" /></button>
        <button onClick={actions.csv}><Table2 size={20} aria-hidden="true" /><span><strong>CSV · fournitures</strong><small>Croix, métrages, échevettes</small></span><Download size={14} aria-hidden="true" /></button>
        <button onClick={actions.print}><FileText size={20} aria-hidden="true" /><span><strong>PDF · fiche technique</strong><small>Fournitures + 4 planches A4</small></span><Download size={14} aria-hidden="true" /></button>
      </div>
      <div className="panneau-groupe">
        <p className="panneau-label">Partager cette rosace</p>
        <div className="panneau-rangee">
          <button className="bouton noir bouton-petit" onClick={actions.share}><Copy size={15} aria-hidden="true" /> Copier le lien</button>
        </div>
        <input className="champ-lien" readOnly value={api.shareUrl} onFocus={(event) => event.target.select()} aria-label="Lien de partage de cette rosace" />
        <p className="panneau-aide">Le lien contient la signature {formatSeed(api.config.seed)}, les fils et tous les réglages.</p>
      </div>
    </div>
  );
}

export const PANEL_COMPONENTS: Record<PanelId, ComponentType> = {
  forme: FormPanel,
  couleurs: ColorsPanel,
  reglages: SettingsPanel,
  export: ExportPanel,
};
