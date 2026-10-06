import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    // RLS-Tests teilen sich eine Datenbank; sequentiell ausführen
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
