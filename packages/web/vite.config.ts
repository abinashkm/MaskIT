import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// Production builds are locked down: no third-party requests and no remote scripts. The page
// may read its own files (the optional name model and its runtime are served from here), and
// WebAssembly is allowed because the model runs on it. Dev keeps Vite's inline helpers working,
// so the policy is only injected at build time.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "worker-src 'self'",
  "img-src 'self' data:",
].join("; ");

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
  worker: { format: "es" },
  build: { target: "es2022" },
  // Packages are consumed from source so `pnpm dev` needs no prior build.
  resolve: {
    alias: {
      "@maskit/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@maskit/files": fileURLToPath(new URL("../files/src/index.ts", import.meta.url)),
      "@maskit/ner/align": fileURLToPath(new URL("../ner/src/align.ts", import.meta.url)),
    },
  },
});
