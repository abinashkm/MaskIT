import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@maskit/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) },
  },
  test: { testTimeout: 120_000 },
});
