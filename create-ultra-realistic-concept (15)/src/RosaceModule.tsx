import { Suspense, lazy } from "react";
import { Composer } from "./components/Composer";
import { EmbroideryView } from "./components/EmbroideryView";
import { CatalogDialog, CollectionDialog } from "./components/Dialogs";
import { Loupe } from "./components/Loupe";
import { ToastStack } from "./components/Overlays";
import { RosaceProvider, useRosaceApi } from "./state/rosace-store";

function Toasts() {
  return <ToastStack messages={useRosaceApi().toasts} />;
}

/** L'import PDF et son moteur (pdf.js) ne sont chargés qu'à l'ouverture de l'import. */
const ImportPdf = lazy(() => import("./components/ImportPdf").then((module) => ({ default: module.ImportPdf })));

function ImportGate() {
  const { importOpen } = useRosaceApi();
  if (!importOpen) return null;
  return (
    <Suspense fallback={<div className="importer" role="status" aria-live="polite"><p className="importer-busy"><span className="importer-spinner" aria-hidden="true" />Chargement de l'import PDF…</p></div>}>
      <ImportPdf />
    </Suspense>
  );
}

/**
 * Module ROSACE : l'atelier plein écran, ses fenêtres et ses notifications.
 * Aucune page à parcourir : on manipule la rosace, on ne scrolle pas.
 */
export function RosaceContent() {
  return (
    <>
      <main id="rosace" className="rosace">
        <h1 className="sr-only">ROSACE — atelier de point de croix</h1>
        <Composer />
      </main>
      <CatalogDialog />
      <CollectionDialog />
      <ImportGate />
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
