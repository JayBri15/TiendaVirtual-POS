import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Resuelve rutas desde el proyecto para que el build funcione desde cualquier cwd.
const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // El código fuente vive en src; docs solo recibe artefactos listos para publicar.
  root: resolve(projectRoot, "src"),
  base: "./",
  // React transforma JSX y Tailwind genera las utilidades usadas por las vistas.
  plugins: [react(), tailwindcss()],
  // Reenvía las peticiones de la web al backend durante el desarrollo local.
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    // Elimina y regenera la salida para evitar bundles obsoletos o páginas duplicadas.
    outDir: resolve(projectRoot, "docs"),
    emptyOutDir: true,
  },
});
