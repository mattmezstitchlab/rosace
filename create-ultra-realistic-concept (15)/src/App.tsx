import { RosaceContent } from "./RosaceModule";
import { TopBar } from "./components/TopBar";
import { RosaceProvider } from "./state/rosace-store";

/** L'application ROSACE : une barre compacte, un atelier fixe, rien à faire défiler. */
export default function App() {
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
