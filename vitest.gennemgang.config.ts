import { defineConfig } from "vitest/config";

// Danner lokalt/gennemgang.html (faglig gennemgang). Ikke en del af de almindelige tests.
export default defineConfig({
  test: { globals: true, environment: "node", include: ["scripts/danGennemgang.run.ts"] },
});
