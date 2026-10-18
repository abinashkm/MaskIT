import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// Production builds are locked down: no network, no remote scripts. Dev keeps Vite's inline
// helpers working, so the policy is only injected at build time.
const CSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:";
const cspPlugin = (): Plugin => ({
  name: "maskit-csp",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
      injectTo: "head-prepend",
    },
  ],
});

export default defineConfig({
  plugins: [react(), cspPlugin()],
  // Core is consumed from source so `pnpm dev` needs no prior build.
  resolve: {
    alias: { "@maskit/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) },
  },
});
