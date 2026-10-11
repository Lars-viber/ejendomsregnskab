import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Bygger del.ts til ét JavaScript-modul, som Node kan køre direkte (lokalt/gennemloeb/del.mjs).
// Bruges kun til det lokale gennemløb af alle variantnumre – ikke en del af applikationen.
export default defineConfig({
  logLevel: "warn",
  build: {
    outDir: fileURLToPath(new URL("../../lokalt/gennemloeb/program", import.meta.url)),
    emptyOutDir: true,
    target: "node24",
    minify: false,
    ssr: fileURLToPath(new URL("./del.ts", import.meta.url)),
    rollupOptions: { output: { entryFileNames: "del.mjs" } },
  },
});
