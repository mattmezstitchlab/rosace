import { Check, Copy, Dices, Download, FileCode2, FileImage, FileText, Package, Plus, RotateCcw, Search, ShoppingBag, Table2, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { DMC_ALL_THREADS, getThread } from "../data/dmc";
import { downloadBlob, safeName } from "../lib/exporters";
import { HOOP_DIAMETERS_CM, HOOP_MARGIN_CM, suggestScale } from "../lib/hoop";
import { patternFingerprint, shortFingerprint } from "../lib/pattern-id";
import { parseThreadCodes, readThreadBox, shoppingCsv, shoppingList, writeThreadBox } from "../lib/threadbox";
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

      <ThreadBoxPanel />
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
  const [seedDraft, setSeedDraft] = useState<string | null>(null);

  // La signature se tape librement (on peut vider le champ) ; elle n'est bornée à 1–9999 et appliquée qu'en quittant le champ ou à Entrée.
  const commitSeed = () => {
    if (seedDraft === null) return;
    setSeedDraft(null);
    const seed = Math.round(Number(seedDraft));
    if (seedDraft.trim() && Number.isFinite(seed)) api.setSeed(Math.min(9999, Math.max(1, seed)));
  };
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
            <input type="number" min="1" max="9999" inputMode="numeric" value={seedDraft ?? config.seed} onChange={(event) => setSeedDraft(event.target.value)} onBlur={commitSeed} onKeyDown={(event) => { if (event.key === "Enter") commitSeed(); }} />
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

      <HoopPanel />

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
          Raccourcis : Ctrl Z annuler · Ctrl Maj Z rétablir · 1 à 7 catégories · Échap fermer. En mode Broder : Ctrl Z / Ctrl Y pour les croix, flèches, Espace, + / −, 0.
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
        <ShoppingExport />
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


/* ---------- Ma boîte à fils ---------- */
export function ThreadBoxPanel() {
  const { work, notify } = useRosaceApi();
  const [box, setBox] = useState<Set<string>>(() => readThreadBox());
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const list = useMemo(() => shoppingList(work, box), [work, box]);
  const save = (next: Set<string>) => {
    try { setBox(writeThreadBox(next)); } catch { notify("Boîte à fils non enregistrée", "Le stockage du navigateur est plein ou indisponible."); }
  };
  const add = () => {
    const parsed = parseThreadCodes(draft);
    if (!parsed.codes.length) { notify("Aucune référence reconnue", "Écrivez des codes DMC : 310, 321, blanc…"); return; }
    save(new Set([...box, ...parsed.codes]));
    setDraft("");
    notify(`${parsed.codes.length} fil${parsed.codes.length > 1 ? "s" : ""} ajouté${parsed.codes.length > 1 ? "s" : ""} à votre boîte`, parsed.unknown.length ? `Non reconnus : ${parsed.unknown.join(", ")}` : undefined);
  };
  const addAll = () => save(new Set([...box, ...list.lines.map((line) => line.code)]));
  return (
    <div className="panneau-groupe boite-fils">
      <p className="panneau-label"><Package size={13} aria-hidden="true" /> Ma boîte à fils · {box.size} référence{box.size > 1 ? "s" : ""}</p>
      {box.size > 0 ? (
        <p className="panneau-aide">
          Pour cet ouvrage : <strong>{list.owned}</strong> fil{list.owned > 1 ? "s" : ""} dans votre boîte, <strong>{list.missing}</strong> manquant{list.missing > 1 ? "s" : ""}
          {list.missing > 0 && ` (${list.skeinsToBuy} échevette${list.skeinsToBuy > 1 ? "s" : ""} à acheter : ${list.lines.filter((line) => !line.owned).map((line) => line.code).join(", ")})`}.
        </p>
      ) : (
        <p className="panneau-aide">Dites à ROSACE quels fils DMC vous possédez : chaque ouvrage vous dira ce qui manque et combien d'échevettes acheter.</p>
      )}
      <div className="panneau-rangee">
        <label className="champ-fils">
          <span className="sr-only">Codes DMC à ajouter à votre boîte</span>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="310, 321, blanc…" inputMode="text" />
        </label>
        <button className="bouton bouton-petit" onClick={add}><Plus size={15} aria-hidden="true" /> Ajouter</button>
        <button className="bouton bouton-petit" onClick={addAll} title="Je possède tous les fils de cet ouvrage">J'ai tout</button>
        <button className="bouton bouton-petit" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "Masquer" : "Voir ma boîte"}</button>
      </div>
      {open && (
        <ul className="boite-liste" aria-label="Fils de votre boîte">
          {[...box].sort().map((code) => (
            <li key={code}>
              <i style={{ background: getThread(code).hex }} aria-hidden="true" />
              <span>DMC {code}</span>
              <button type="button" className="icone" aria-label={`Retirer DMC ${code} de ma boîte`} onClick={() => { const next = new Set(box); next.delete(code); save(next); }}><X size={13} aria-hidden="true" /></button>
            </li>
          ))}
          {!box.size && <li className="boite-vide">Votre boîte est vide.</li>}
        </ul>
      )}
    </div>
  );
}

function ShoppingExport() {
  const { work, notify } = useRosaceApi();
  const box = readThreadBox();
  const list = shoppingList(work, box);
  return (
    <button onClick={() => {
      if (!box.size) { notify("Boîte à fils vide", "Renseignez d'abord vos fils dans Colorer · Ma boîte à fils ; sinon le CSV fournitures liste tout."); return; }
      downloadBlob(new Blob([shoppingCsv(work, box)], { type: "text/csv;charset=utf-8" }), `${safeName(work)}-courses.csv`);
      notify("Liste de courses exportée", `${list.missing} fil${list.missing > 1 ? "s" : ""} manquant${list.missing > 1 ? "s" : ""}, ${list.skeinsToBuy} échevette${list.skeinsToBuy > 1 ? "s" : ""}`);
    }}><ShoppingBag size={20} aria-hidden="true" /><span><strong>CSV · liste de courses</strong><small>{box.size ? `${list.missing} fil${list.missing > 1 ? "s" : ""} manquant${list.missing > 1 ? "s" : ""} · ${list.skeinsToBuy} échevette${list.skeinsToBuy > 1 ? "s" : ""}` : "D'après votre boîte à fils"}</small></span><Download size={14} aria-hidden="true" /></button>
  );
}

/* ---------- Sur mesure du tambour ---------- */
function HoopPanel() {
  const api = useRosaceApi();
  const { config } = api;
  const [diameter, setDiameter] = useState<number>(() => { try { return Number(localStorage.getItem("aime-rosace-tambour-cm")) || 15; } catch { return 15; } });
  const fit = useMemo(() => suggestScale(config, diameter), [config, diameter]);
  const names = ["Miniature", "Fin", "Moyen", "Ample", "Monumental"];
  const pick = (value: number) => { setDiameter(value); try { localStorage.setItem("aime-rosace-tambour-cm", String(value)); } catch { /* préférence seulement */ } };
  return (
    <div className="panneau-groupe">
      <p className="panneau-label">Sur mesure du tambour · {String(diameter).replace(".", ",")} cm</p>
      <div className="options" role="group" aria-label="Diamètre du tambour en centimètres">
        {HOOP_DIAMETERS_CM.map((value) => (
          <button key={value} className={`option ${diameter === value ? "is-active" : ""}`} aria-pressed={diameter === value} onClick={() => pick(value)}>{String(value).replace(".", ",")} cm</button>
        ))}
      </div>
      <p className="panneau-aide">
        {fit.fits
          ? <>Échelle conseillée : <strong>{names[fit.scale - 1]}</strong> ({String(fit.motifCm).replace(".", ",")} cm de motif, {Math.round(fit.fill * 100)} % du cercle utile, marge {String(HOOP_MARGIN_CM).replace(".", ",")} cm).{config.scale !== fit.scale && <> <button type="button" className="lien-souligne" onClick={() => api.commit({ ...config, scale: fit.scale })}>Appliquer</button></>}</>
          : <>Même en Miniature ({String(fit.motifCm).replace(".", ",")} cm), la rosace déborde d'un tambour de {diameter} cm.{fit.aidaHint ? <> Sur aïda {fit.aidaHint}, elle tient. <button type="button" className="lien-souligne" onClick={() => api.commit({ ...config, scale: 1, aida: fit.aidaHint! })}>Passer en aïda {fit.aidaHint}, Miniature</button></> : " Choisissez un tambour plus grand."}</>}
      </p>
    </div>
  );
}
