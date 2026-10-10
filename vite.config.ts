import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Arkivet på GitHub hedder "ejendomsregnskab" (Reference.docx afsnit 4).
  base: "/ejendomsregnskab/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/tmp/**", "node_modules/**"],
    // Mange tests danner opgaver; ved samtidig kørsel kan enkelte tage mere end standardgrænsen på 5 sekunder.
    testTimeout: 30_000,
  },
});
