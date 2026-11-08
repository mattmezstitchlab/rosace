import { RosaceContent } from "./RosaceModule";
import { TopBar } from "./components/TopBar";
import { RosaceProvider } from "./state/rosace-store";

export default function Studio() {
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
