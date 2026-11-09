import { Suspense, lazy, useEffect, useState } from "react";

type Route = "presentation" | "atelier";

/** Un titre par route (WCAG 2.4.2) : la page reste un seul document, c'est donc à nous de le tenir à jour. */
const TITLES: Record<Route, string> = {
  presentation: "ROSACE — La géométrie devient broderie",
  atelier: "Atelier — ROSACE",
};

const Landing = lazy(() => import("./landing/Landing").then((module) => ({ default: module.Landing })));
const Studio = lazy(() => import("./Studio"));

/**
 * Deux entrées, une seule application.
 * - `#atelier` (et toutes ses variantes) ouvre l'atelier ;
 * - un lien de recette `#r=…` ouvre directement l'atelier sur cette rosace ;
 * - tout le reste affiche la présentation.
 */
function readRoute(): Route {
  const hash = window.location.hash;
  return hash.startsWith("#atelier") || hash.startsWith("#r=") ? "atelier" : "presentation";
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    document.title = TITLES[route];
  }, [route]);

  return (
    <Suspense fallback={<div className="chargement" role="status" aria-live="polite">Chargement de ROSACE…</div>}>
      {route === "presentation" ? <Landing /> : <Studio />}
    </Suspense>
  );
}
