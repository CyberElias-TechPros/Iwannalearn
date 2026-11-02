import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each suite that touches SQLite gets its own database file (see tests/env.ts).
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
