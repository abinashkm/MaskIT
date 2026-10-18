import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = `${root}dist`;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: { content: `${root}src/content.ts`, popup: `${root}src/popup.ts` },
  outdir: dist,
  bundle: true,
  format: "iife", // content scripts cannot be ES modules
  target: "chrome110",
  minify: false, // readable output makes the "no network" claim easy to audit
  sourcemap: false,
  // Use the engine's TypeScript source so no separate core build step is needed.
  alias: { "@maskit/core": `${root}../core/src/index.ts` },
  logLevel: "info",
});

for (const file of ["manifest.json", "popup.html", "popup.css"]) {
  await cp(`${root}${file}`, `${dist}/${file}`);
}
console.log("Extension built in packages/extension/dist");
