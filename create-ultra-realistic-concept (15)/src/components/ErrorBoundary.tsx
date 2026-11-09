import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";

/*
  Dernier filet de l'application. Sans lui, une exception de rendu ou un chunk introuvable (hors ligne, page
  restée ouverte après un déploiement) démonte toute l'interface et laisse une page blanche.
  Ce fichier reste volontairement sans dépendance : il vit dans le chunk principal.
*/

/** Clé de l'ouvrage importé (rosace-store.tsx, non exportée : l'importer embarquerait tout l'atelier ici). */
const IMPORTED_KEY = "aime-rosace-imported-v1";
/** Préfixe commun à toutes les données de l'application dans le stockage du navigateur. */
const DATA_PREFIX = "aime-rosace-";

/** Messages de Chrome, Safari, Firefox et de Vite quand un import dynamique ou une feuille de style échoue. */
const LOAD_FAILURE = /dynamically imported module|importing a module script failed|loading (css )?chunk|chunkloaderror|unable to preload/i;

function reload() {
  window.location.reload();
}

function clearImportedWork() {
  try { localStorage.removeItem(IMPORTED_KEY); } catch { /* stockage inaccessible : le rechargement seul est tenté */ }
  reload();
}

function clearAllData() {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(DATA_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch { /* stockage inaccessible */ }
  try {
    const keys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key && key.startsWith(DATA_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch { /* stockage inaccessible */ }
  // L'adresse peut porter la recette (#r=…) ou l'écran qui a provoqué l'erreur : on repart de l'accueil.
  window.location.replace(`${window.location.pathname}${window.location.search}`);
}

function ErrorScreen({ error }: { error: Error }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const reset = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const previous = useRef(confirming);
  const loadFailure = LOAD_FAILURE.test(`${error.name} ${error.message}`);

  useEffect(() => {
    document.title = "Erreur · ROSACE";
    heading.current?.focus();
  }, []);

  // Le bouton cliqué disparaît avec son remplacement : le focus passe au bouton qui prend sa place (Annuler, jamais le geste destructeur).
  useEffect(() => {
    if (previous.current === confirming) return;
    previous.current = confirming;
    (confirming ? cancel : reset).current?.focus();
  }, [confirming]);

  return (
    <main className="erreur-app">
      <div className="erreur-carte">
        <div role="alert">
          <p className="surtitre">ROSACE</p>
          <h1 ref={heading} tabIndex={-1}>{loadFailure ? "Cet écran n'a pas pu se charger" : "Un problème est survenu"}</h1>
          <p>
            {loadFailure
              ? "Un fichier de l'application n'a pas pu être chargé : vous êtes peut-être hors ligne, ou une nouvelle version vient d'être mise en ligne. Rechargez la page pour continuer."
              : "ROSACE n'a pas pu afficher cet écran. Rien n'est envoyé ailleurs : vos favoris, votre patron et votre progression restent sur cet appareil. Rechargez la page pour reprendre."}
          </p>
        </div>
        <div className="erreur-actions">
          <button type="button" className="bouton bouton-petit noir" onClick={reload}>Recharger la page</button>
        </div>
        <p className="erreur-aide">Si l'erreur revient à chaque ouverture : le premier geste ne supprime que le patron importé, le second tout ce que ROSACE a enregistré sur cet appareil.</p>
        <div className="erreur-actions">
          <button type="button" className="bouton bouton-petit" onClick={clearImportedWork}>Effacer l'ouvrage importé puis recharger</button>
          {confirming ? (
            <div className="erreur-confirmation" role="group" aria-labelledby="erreur-confirmation-titre">
              <p>
                <strong id="erreur-confirmation-titre">Tout effacer sur cet appareil ?</strong> Favoris, patron importé, progression de broderie et réglages de ROSACE seront supprimés définitivement.
              </p>
              <div className="erreur-actions">
                <button type="button" className="bouton bouton-petit erreur-danger" onClick={clearAllData}>Oui, tout effacer</button>
                <button ref={cancel} type="button" className="bouton bouton-petit" onClick={() => setConfirming(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <button ref={reset} type="button" className="bouton bouton-petit" onClick={() => setConfirming(true)}>Tout réinitialiser (efface les données de cet appareil)</button>
          )}
        </div>
        <details className="erreur-details">
          <summary>Détails techniques</summary>
          <p>{error.name}: {error.message}</p>
        </details>
      </div>
    </main>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ROSACE] Erreur d'affichage", error, info.componentStack);
  }

  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children;
  }
}
