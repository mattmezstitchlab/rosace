import { Composer } from "./components/Composer";
import { EmbroideryView } from "./components/EmbroideryView";
import { CatalogDialog, CollectionDialog } from "./components/Dialogs";
import { Loupe } from "./components/Loupe";
import { ToastStack } from "./components/Overlays";
import { RosaceProvider, useRosaceApi } from "./state/rosace-store";

function Toasts() {
  return <ToastStack messages={useRosaceApi().toasts} />;
}

/**
 * Module ROSACE : l'atelier plein écran, ses fenêtres et ses notifications.
 * Aucune page à parcourir : on manipule la rosace, on ne scrolle pas.
 */
export function RosaceContent() {
  return (
    <>
      <main id="rosace" className="rosace">
        <Composer />
      </main>
      <CatalogDialog />
      <CollectionDialog />
      <EmbroideryView />
      <Loupe />
      <Toasts />
    </>
  );
}

/** Version autonome (fournit elle-même l'état). */
export default function RosaceModule() {
  return (
    <RosaceProvider>
      <RosaceContent />
    </RosaceProvider>
  );
}
