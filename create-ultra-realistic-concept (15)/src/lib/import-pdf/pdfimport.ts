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
  pages: number;
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

export async function openPdf(file: File): Promise<PdfHandle> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  return {
    pages: doc.numPages,
    async dims(n) {
      const page = await doc.getPage(Math.min(Math.max(1, n), doc.numPages));
      const vp = page.getViewport({ scale: 1 });
      return { w: vp.width, h: vp.height };
    },
    async render(n, targetW) {
      const page = await doc.getPage(Math.min(Math.max(1, n), doc.numPages));
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(6, targetW / base.width);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible");
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
    destroy: () => {
      void task.destroy();
    },
  };
}
