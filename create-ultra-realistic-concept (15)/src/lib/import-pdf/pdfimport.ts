/**
 * Import de patrons PDF (Etsy et autres) : chaque page est rendue en haute résolution
 * par pdf.js, puis convertie en grille DMC par le même pipeline que les images.
 * Conseil affiché dans l'interface : choisir la page de l'aperçu en couleurs du patron.
 */

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  size: number;
}

export interface RawItem {
  str: string;
  x: number;
  y: number;
  size: number;
  font: string;
  w: number;
}

export interface PdfHandle {
  /** Pages lues : au plus `MAX_PDF_PAGES`, même si le fichier en compte davantage. */
  pages: number;
  /** Nombre réel de pages du fichier, renseigné seulement quand il dépasse la limite lue. */
  pagesInFile?: number;
  /** Dimensions de la page n (unités PDF, échelle 1), pour convertir les % en pixels. */
  dims: (n: number) => Promise<{ w: number; h: number }>;
  /** Éléments de texte bruts (police, largeur) pour la lecture vectorielle des grilles. */
  rawText: (n: number, targetW: number) => Promise<RawItem[]>;
  /** Rend la page n (1-indexée) sur un canevas, largeur cible en pixels. */
  render: (n: number, targetW: number) => Promise<HTMLCanvasElement>;
  /** Texte de la page n, positions en pixels pour une largeur cible donnée. */
  text: (n: number, targetW: number) => Promise<PdfTextItem[]>;
  destroy: () => void;
}

/** Erreur dont le message est déjà écrit pour l'utilisateur : l'interface l'affiche telle quelle. */
export class PdfImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfImportError";
  }
}

/** Pages lues au plus : une grille de patron tient en quelques pages, et chaque page coûte un rendu à 1400 px. */
export const MAX_PDF_PAGES = 100;
/** Quand son worker se tait, pdf.js laisse la promesse d'ouverture en suspens : passé ce délai, l'ouverture échoue. */
export const OPEN_TIMEOUT_MS = 30_000;
/** iOS Safari plafonne un canevas à 16 777 216 pixels (getContext rend null au-delà) ; marge pour l'arrondi par excès. */
export const MAX_CANVAS_PIXELS = 16_000_000;
/** Côté maximal d'un canevas : Chrome et Firefox plafonnent à 32 767 px, on garde de la marge. */
const MAX_CANVAS_SIDE = 16_384;

/** Échelle de rendu d'une page de `width` × `height` points visant `targetW` pixels, bornée par ×6 et par les limites de canevas. */
export function renderScale(width: number, height: number, targetW: number): number {
  return Math.min(6, targetW / width, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)), MAX_CANVAS_SIDE / Math.max(width, height));
}

/** Avertissement quand le fichier compte plus de pages que la limite lue (chaîne vide sinon). */
export function pageLimitNotice(handle: Pick<PdfHandle, "pages" | "pagesInFile">): string {
  return handle.pagesInFile ? `Ce PDF compte ${handle.pagesInFile} pages : seules les ${handle.pages} premières sont lues.` : "";
}

export function abortError(): Error {
  return new DOMException("Import annulé.", "AbortError");
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** Rejette au bout de `ms` (avec l'erreur de `onTimeout`) ou dès que `signal` est interrompu, si `promise` ne s'est pas réglée avant. */
export function withDeadline<T>(promise: Promise<T>, ms: number, onTimeout: () => Error, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      settle();
    };
    const onAbort = () => finish(() => reject(abortError()));
    const timer = setTimeout(() => finish(() => reject(onTimeout())), ms);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    promise.then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
  });
}

/** Message français pour une erreur d'ouverture ou de lecture (pdf.js ne parle qu'anglais) ; le nom de l'erreur fait foi, pas son texte. */
export function friendlyPdfError(error: unknown): string {
  if (error instanceof PdfImportError) return error.message;
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  switch (name) {
    case "PasswordException":
      return "Ce PDF est protégé par un mot de passe : ROSACE ne peut pas l'ouvrir. Retirez la protection, puis réessayez.";
    case "InvalidPDFException":
      return "Ce fichier n'est pas un PDF valide, ou il est abîmé. Exportez-le de nouveau depuis son logiciel d'origine, puis réessayez.";
    case "MissingPDFException":
      return "Ce PDF est introuvable.";
    case "AbortException":
    case "AbortError":
      return "Import annulé.";
    default:
      return "Ce PDF n'a pas pu être lu. Essayez un autre fichier, ou « Photo » pour partir d'une image.";
  }
}

async function loadPdfjs() {
  // Build « legacy » : il embarque les polyfills de Promise.try, Map.getOrInsertComputed, URL.parse… que le build moderne appelle sans les fournir.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  }
  return pdfjs;
}

/**
 * Ouvre le PDF. `signal` interrompt l'ouverture comme les lectures qui suivent : le worker est alors détruit.
 * Toute sortie en erreur libère le worker et le document.
 */
export async function openPdf(file: File, signal?: AbortSignal): Promise<PdfHandle> {
  // Même le build legacy appelle Promise.withResolvers sans le fournir : sans lui le worker se tait et l'attente ne finirait jamais.
  if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== "function") {
    throw new PdfImportError("Votre navigateur est trop ancien pour lire un PDF. Essayez « Photo » ou mettez-le à jour.");
  }
  const pdfjs = await loadPdfjs().catch((cause) => {
    console.warn("[ROSACE] Chargement de pdf.js impossible", cause);
    throw new PdfImportError("Le lecteur de PDF n'a pas pu être chargé (connexion coupée ou navigateur trop ancien). Rechargez la page, ou essayez « Photo ».");
  });
  const data = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(signal);
  // Le worker est créé ici pour pouvoir le détruire soi-même : task.destroy() ne s'en charge que pour un worker qu'il a créé.
  const worker = new pdfjs.PDFWorker();
  const task = pdfjs.getDocument({ data, worker });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", dispose);
    const kill = () => {
      clearTimeout(timer);
      worker.destroy();
    };
    // task.destroy() attend le worker : s'il est muet il ne rend jamais la main, d'où ce second délai qui le détruit d'office.
    const timer = setTimeout(kill, 2000);
    task.destroy().then(kill, kill);
  };
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await withDeadline(task.promise, OPEN_TIMEOUT_MS, () => new PdfImportError(`Le PDF met trop de temps à s'ouvrir (${OPEN_TIMEOUT_MS / 1000} s sans réponse). Réessayez, ou essayez « Photo ».`), signal);
    throwIfAborted(signal);
  } catch (error) {
    dispose();
    throw error;
  }
  signal?.addEventListener("abort", dispose, { once: true });
  return {
    pages: Math.min(doc.numPages, MAX_PDF_PAGES),
    pagesInFile: doc.numPages > MAX_PDF_PAGES ? doc.numPages : undefined,
    async dims(n) {
      const page = await doc.getPage(Math.min(Math.max(1, n), doc.numPages));
      const vp = page.getViewport({ scale: 1 });
      return { w: vp.width, h: vp.height };
    },
    async render(n, targetW) {
      const page = await doc.getPage(Math.min(Math.max(1, n), doc.numPages));
      const base = page.getViewport({ scale: 1 });
      const scale = renderScale(base.width, base.height, targetW);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new PdfImportError("Mémoire insuffisante pour afficher une page de ce PDF. Essayez « Photo » ou un autre appareil.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
      return canvas;
    },
    async text(n, targetW) {
      const page = await doc.getPage(Math.min(Math.max(1, n), doc.numPages));
      const content = await page.getTextContent();
      const vp1 = page.getViewport({ scale: 1 });
      const s = targetW / vp1.width;
      const out: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const t = item.transform as number[];
        out.push({ str: item.str, x: t[4] * s, y: (vp1.height - t[5]) * s, size: Math.max(Math.hypot(t[2], t[3]), Math.abs(t[0])) * s });
      }
      return out;
    },
    async rawText(n, targetW) {
      const page = await doc.getPage(Math.min(Math.max(1, n), doc.numPages));
      const content = await page.getTextContent();
      const vp1 = page.getViewport({ scale: 1 });
      const s = targetW / vp1.width;
      const out: RawItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.length) continue;
        const t = item.transform as number[];
        out.push({
          str: item.str,
          x: t[4] * s,
          y: (vp1.height - t[5]) * s,
          size: Math.max(Math.hypot(t[2], t[3]), Math.abs(t[0])) * s,
          font: String(item.fontName ?? ""),
          w: (item.width || 0) * s,
        });
      }
      return out;
    },
    destroy: dispose,
  };
}
