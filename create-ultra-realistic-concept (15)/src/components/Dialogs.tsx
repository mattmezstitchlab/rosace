import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bookmark, Check, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DMC_ALL_THREADS, FAMILY_LABELS, type ThreadFamily } from "../data/dmc";
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

function SavedCard({ entry, onLoad, onDelete }: { entry: SavedRosace; onLoad: () => void; onDelete: () => void }) {
  const pattern = useMemo(() => generateRosace(entry.config), [entry.config]);
  return (
    <motion.article className="collection-carte" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }}>
      <button className="collection-vignette" onClick={onLoad} aria-label={`Ouvrir ${entry.name} dans l'instrument`}>
        <RosaceCanvas pattern={pattern} resolution={320} className="vignette-canvas" />
      </button>
      <div className="collection-corps">
        <p className="surtitre">{getPatternName(entry.config)}</p>
        <h3>{entry.name}</h3>
        <p>{pattern.stitches.length.toLocaleString("fr-FR")} croix · {entry.config.palette.length} fils · aïda {entry.config.aida}</p>
        <small>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.createdAt))}</small>
        <button className="lien-souligne" onClick={onLoad}>Reprendre dans l'instrument <ArrowRight size={13} aria-hidden="true" /></button>
      </div>
      <button className="collection-supprimer" onClick={onDelete} aria-label={`Supprimer ${entry.name}`}><Trash2 size={15} /></button>
    </motion.article>
  );
}

/** Collection personnelle : chaque recette rouvre l'instrument avec ses propres réglages et sa signature. */
export function CollectionDialog() {
  const api = useRosaceApi();
  return (
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
  );
}

