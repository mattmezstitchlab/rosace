import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build par défaut : plusieurs fichiers dans `dist/` (index.html + assets/). Le moteur d'import PDF
 * (pdf.js et son worker, ~1,3 Mo) n'est chargé qu'à l'ouverture de l'import, et le worker reste un
 * vrai fichier. C'est ce que servent Cloudflare Workers (assets statiques), Vercel ou tout serveur.
 *
 * Retour arrière : `ROSACE_SINGLEFILE=1 npm run build` produit l'ancien `dist/index.html` unique.
 * Dans ce mode le worker pdf.js est inliné en data: URL, plus lourd et moins sûr : à réserver aux cas
 * où un seul fichier est indispensable.
 */
const singleFile = process.env.ROSACE_SINGLEFILE === "1";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(singleFile ? [viteSingleFile()] : [])],
  build: singleFile
    ? {}
    : {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes("pdfjs-dist")) return "pdfjs";
            },
          },
        },
      },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
