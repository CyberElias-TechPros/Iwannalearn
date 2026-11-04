import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each suite that touches SQLite gets its own database file (see tests/env.ts).
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { "@": path.resolve(fileURLToPath(new URL(".", import.meta.url))) },
  },
});
