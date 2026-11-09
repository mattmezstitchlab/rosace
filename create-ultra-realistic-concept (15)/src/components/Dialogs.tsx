import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bookmark, Check, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DMC_ALL_THREADS, FAMILY_LABELS, type ThreadFamily } from "../data/dmc";
import { workTitle } from "../lib/exporters";
import { SYMBOLS, generateRosace, getPatternName, type SavedRosace } from "../lib/rosace";
import { useRosaceApi, type FamilyFilter } from "../state/rosace-store";
import { Modal } from "./Overlays";
import { RosaceCanvas } from "./RosaceCanvas";

/** Nuancier complet : recherche par référence ou par nom, familles, et remplacement du fil actif ou ajout. */
export function CatalogDialog() {
  const api = useRosaceApi();
  const { catalog, config, activeIndex } = api;
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<FamilyFilter>("toutes");

  useEffect(() => {
    if (catalog.open) {
      setSearch("");
      setFamily(catalog.family);
    }
  }, [catalog.open, catalog.family]);

  const threads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return DMC_ALL_THREADS.filter((thread) => {
      const familyMatches = family === "toutes" || thread.family === family;
      const searchMatches = !query || thread.code.toLocaleLowerCase("fr").includes(query) || thread.name.toLocaleLowerCase("fr").includes(query);
      return familyMatches && searchMatches;
    });
  }, [family, search]);

  return (
    <Modal
      open={catalog.open}
      onClose={api.closeCatalog}
      title="Nuancier DMC"
      eyebrow={catalog.intent === "add" ? "Ajouter un fil · 6 maximum" : `Remplacer le fil ${activeIndex + 1} · DMC ${config.palette[activeIndex]}`}
      wide
    >
      <div className="catalogue-barre">
        <label className="champ-recherche">
          <Search size={17} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher 3607, prune, avocat…" aria-label="Rechercher une référence ou un nom" />
          {search && <button onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={14} /></button>}
        </label>
        <span>{threads.length} teintes</span>
      </div>
      <div className="familles-filtres" role="group" aria-label="Filtrer par famille">
        <button className={family === "toutes" ? "is-active" : ""} aria-pressed={family === "toutes"} onClick={() => setFamily("toutes")}>Toutes</button>
        {(Object.keys(FAMILY_LABELS) as ThreadFamily[]).map((key) => (
          <button key={key} className={family === key ? "is-active" : ""} aria-pressed={family === key} onClick={() => setFamily(key)}>{FAMILY_LABELS[key]}</button>
        ))}
      </div>
      {threads.length > 0 ? (
        <div className="catalogue-liste">
          {threads.map((thread) => {
            const slot = config.palette.indexOf(thread.code);
            return (
              <button key={thread.code} className={`catalogue-fil ${slot >= 0 ? "is-used" : ""}`} onClick={() => api.applyThread(thread.code, catalog.intent)}>
                <span className="catalogue-couleur" style={{ backgroundColor: thread.hex }} aria-hidden="true">{slot >= 0 && <Check size={15} />}</span>
                <span className="catalogue-texte">
                  <strong>DMC {thread.code}</strong>
                  <small>{thread.name}{slot >= 0 ? ` · fil ${slot + 1} ${SYMBOLS[slot]}` : ""}</small>
                </span>
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="vide">
          <Search size={28} aria-hidden="true" />
          <h3>Aucune teinte trouvée</h3>
          <p>Essayez un numéro de référence ou une autre famille.</p>
          <button className="lien-souligne" onClick={() => { setSearch(""); setFamily("toutes"); }}>Réinitialiser la recherche</button>
        </div>
      )}
      <p className="modal-note">Les valeurs sont des approximations pour écran. Chaque fil est identifié par sa référence et son nom : vérifiez toujours les échevettes à la lumière naturelle.</p>
    </Modal>
  );
}

/** Date d'enregistrement lisible ; une date abîmée dans le stockage s'efface au lieu de faire échouer toute la collection. */
function savedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date);
  } catch { return ""; }
}

function SavedCard({ entry, onLoad, onDelete }: { entry: SavedRosace; onLoad: () => void; onDelete: () => void }) {
  const pattern = useMemo(() => generateRosace(entry.config), [entry.config]);
  const date = savedDate(entry.createdAt);
  return (
    <motion.article className="collection-carte" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }}>
      <button className="collection-vignette" onClick={onLoad} aria-label={`Ouvrir ${entry.name} dans l'instrument`}>
        <RosaceCanvas pattern={pattern} resolution={320} className="vignette-canvas" />
      </button>
      <div className="collection-corps">
        <p className="surtitre">{getPatternName(entry.config)}</p>
        <h3>{entry.name}</h3>
        <p>{pattern.stitches.length.toLocaleString("fr-FR")} croix · {entry.config.palette.length} fils · aïda {entry.config.aida}</p>
        {date && <small>{date}</small>}
        <button className="lien-souligne" onClick={onLoad}>Reprendre dans l'instrument <ArrowRight size={13} aria-hidden="true" /></button>
      </div>
      <button className="collection-supprimer" onClick={onDelete} aria-label={`Supprimer ${entry.name}`}><Trash2 size={15} /></button>
    </motion.article>
  );
}

/**
 * Confirmation avant de retirer le patron importé de l'appareil : on y arrive par la couronne, « Revenir à ma rosace »
 * ou l'ouverture d'une autre recette. Échap, le fond et « Garder » le conservent ; sa grille n'existe que dans ce
 * navigateur, d'où l'export du projet proposé d'abord.
 */
export function DiscardImportDialog() {
  const api = useRosaceApi();
  // Le titre est figé pendant l'ouverture : l'ouvrage actif change dès la confirmation, avant la fin du fondu.
  const label = useRef("");
  if (api.discardPromptOpen) {
    const title = workTitle(api.work);
    label.current = title.length > 80 ? `${title.slice(0, 79)}…` : title;
  }
  // Le Modal ne rend le focus qu'aux éléments HTML : une case de la couronne (SVG) le perdrait à la fermeture.
  useEffect(() => {
    if (!api.discardPromptOpen) return;
    const trigger = document.activeElement;
    return () => { if (trigger instanceof SVGElement && trigger.isConnected) trigger.focus(); };
  }, [api.discardPromptOpen]);
  return (
    <Modal open={api.discardPromptOpen} onClose={api.cancelDiscardImport} title="Retirer le patron importé ?" eyebrow="Patron importé">
      <div className="vide">
        <h3>Ce patron sera retiré de cet appareil</h3>
        <p>« {label.current} » ne sera plus enregistré dans ce navigateur. Pour pouvoir le rouvrir, exportez d'abord le projet (.rosace.json) : il garde la grille, la palette et votre progression.</p>
        <div className="erreur-actions">
          <button type="button" className="bouton bouton-petit" onClick={() => api.exportActions.project()}>Exporter le projet d'abord</button>
          <button type="button" className="bouton bouton-petit" onClick={api.cancelDiscardImport}>Garder le patron</button>
          <button type="button" className="bouton bouton-petit erreur-danger" onClick={api.confirmDiscardImport}>Retirer le patron</button>
        </div>
      </div>
    </Modal>
  );
}

/** Collection personnelle : chaque recette rouvre l'instrument avec ses propres réglages et sa signature. */
export function CollectionDialog() {
  const api = useRosaceApi();
  return (
    <>
      <Modal
        open={api.collectionOpen}
        onClose={() => api.setCollectionOpen(false)}
        title="Votre collection"
        eyebrow={`${api.favorites.length} recette${api.favorites.length > 1 ? "s" : ""} sur cet appareil`}
        drawer
      >
        {api.favorites.length ? (
          <div className="collection-liste">
            <AnimatePresence initial={false}>
              {api.favorites.map((entry) => (
                <SavedCard key={entry.id} entry={entry} onLoad={() => api.loadRecipe(entry.config, entry.name, "Recette identique à l'enregistrement")} onDelete={() => api.deleteFavorite(entry.id)} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="vide">
            <Bookmark size={30} strokeWidth={1.3} aria-hidden="true" />
            <h3>Votre collection est vide</h3>
            <p>Utilisez le cœur sous le tambour : la géométrie, la toile et les fils seront conservés, puis rouverts à l'identique.</p>
            <button className="bouton noir" onClick={() => api.setCollectionOpen(false)}>Retourner à l'instrument</button>
          </div>
        )}
      </Modal>
      <DiscardImportDialog />
    </>
  );
}

