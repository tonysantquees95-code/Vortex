import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // duas páginas: o Vortex (index.html) e o Voxix (voxix.html), que abre numa janela/tarefa à parte
  build: { outDir: "dist", target: "es2020", chunkSizeWarningLimit: 700, rollupOptions: { input: { main: resolve(__dirname, "index.html"), voxix: resolve(__dirname, "voxix.html") } } },
  server: { port: 5178, strictPort: true, host: true }
});
