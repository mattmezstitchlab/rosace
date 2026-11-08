import { Suspense, lazy, useEffect, useState } from "react";

type Route = "presentation" | "atelier";

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

  return (
    <Suspense fallback={<div role="status" aria-live="polite">Chargement de ROSACE…</div>}>
      {route === "presentation" ? <Landing /> : <Studio />}
    </Suspense>
  );
}
