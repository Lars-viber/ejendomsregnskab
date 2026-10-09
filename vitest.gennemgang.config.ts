import { defineConfig } from "vitest/config";

// Danner lokale arbejdsfiler i lokalt/ (gennemgang.html og klassifikation.html).
// Ikke en del af de almindelige tests.
export default defineConfig({
  test: { globals: true, environment: "node", include: ["scripts/*.run.ts"] },
});
