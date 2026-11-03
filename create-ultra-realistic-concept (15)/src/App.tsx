import { useEffect, useState } from "react";
import { Landing } from "./landing/Landing";
import { RosaceContent } from "./RosaceModule";
import { TopBar } from "./components/TopBar";
import { RosaceProvider } from "./state/rosace-store";

type Route = "presentation" | "atelier";

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

  if (route === "presentation") return <Landing />;

  return (
    <RosaceProvider>
      <a className="lien-evitement" href="#composer">Aller à l'atelier</a>
      <div className="app">
        <TopBar />
        <RosaceContent />
      </div>
    </RosaceProvider>
  );
}
