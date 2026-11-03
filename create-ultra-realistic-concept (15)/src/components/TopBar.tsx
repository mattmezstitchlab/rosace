import { Heart, Redo2, Share2, Undo2 } from "lucide-react";
import { useRosaceApi } from "../state/rosace-store";
import { RosaceLogo } from "./RosaceLogo";

/** Barre supérieure compacte : la marque (qui ramène à la présentation), annuler, rétablir, enregistrer, partager. */
export function TopBar() {
  const api = useRosaceApi();
  const { history, future, savedCurrent, favorites, exportActions } = api;

  return (
    <header className="topbar">
      <a className="topbar-marque" href="#presentation" aria-label="ROSACE — revenir à la présentation" title="Présentation">
        <RosaceLogo />
        <span className="topbar-nom">ROSACE<sup>®</sup></span>
      </a>
      <div className="topbar-actions" role="group" aria-label="Actions">
        <button
          type="button"
          className="outil outil-icone"
          onClick={api.undo}
          disabled={!history.length}
          aria-label="Annuler le dernier réglage"
          title="Annuler · Ctrl Z"
        >
          <Undo2 size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="outil outil-icone"
          onClick={api.redo}
          disabled={!future.length}
          aria-label="Rétablir le réglage annulé"
          title="Rétablir · Ctrl Maj Z"
        >
          <Redo2 size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <span className="separateur" aria-hidden="true" />
        <button
          type="button"
          className={`outil outil-icone ${savedCurrent ? "is-saved" : ""}`}
          onClick={api.toggleFavorite}
          aria-pressed={Boolean(savedCurrent)}
          aria-label={savedCurrent ? "Retirer cette rosace de votre collection" : "Enregistrer cette rosace dans votre collection"}
          title="Enregistrer dans votre collection"
        >
          <Heart size={19} strokeWidth={1.8} fill={savedCurrent ? "currentColor" : "none"} aria-hidden="true" />
          {favorites.length > 0 && <span className="outil-compte">{favorites.length}</span>}
        </button>
        <button
          type="button"
          className="outil outil-icone"
          onClick={exportActions.share}
          aria-label="Partager cette configuration"
          title="Partager · copier le lien"
        >
          <Share2 size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
