import type { MouseEvent } from "react";
import { RosaceContent } from "./RosaceModule";
import { TopBar } from "./components/TopBar";
import { RosaceProvider } from "./state/rosace-store";

/**
 * Le lien d'évitement ne touche pas à l'adresse : `#composer` serait lu par le routeur comme la présentation,
 * ce qui ferait quitter l'atelier (et perdre l'historique d'annulation). On déplace seulement le focus.
 */
function allerALAtelier(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const cible = document.getElementById("composer");
  if (!cible) return;
  cible.tabIndex = -1;
  cible.focus();
}

export default function Studio() {
  return (
    <RosaceProvider>
      <a className="lien-evitement" href="#composer" onClick={allerALAtelier}>Aller à l'atelier</a>
      <div className="app">
        <TopBar />
        <RosaceContent />
      </div>
    </RosaceProvider>
  );
}
