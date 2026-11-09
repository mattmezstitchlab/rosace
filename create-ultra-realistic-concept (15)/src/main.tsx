import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initTheme } from "./lib/theme";

initTheme();

/*
  Après un déploiement, une page restée ouverte réclame des fichiers dont le nom a changé : Vite signale l'échec
  par `vite:preloadError`. Un seul rechargement récupère la nouvelle version ; l'horodatage en sessionStorage
  interdit toute boucle (au second échec, l'erreur remonte à l'ErrorBoundary, qui propose le rechargement).
*/
const PRELOAD_RELOAD_KEY = "aime-rosace-preload-reload";
const PRELOAD_RELOAD_COOLDOWN_MS = 30_000;
window.addEventListener("vite:preloadError", () => {
  try {
    const last = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY));
    if (Number.isFinite(last) && Date.now() - last < PRELOAD_RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
  } catch {
    return; // Sans sessionStorage, impossible de garantir l'absence de boucle : on laisse l'ErrorBoundary parler.
  }
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
