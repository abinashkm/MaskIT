import { build } from "esbuild";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = `${root}dist`;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// Packages are used from source so no separate build step is needed for them.
const alias = {
  "@maskit/core": `${root}../core/src/index.ts`,
  "@maskit/ner/align": `${root}../ner/src/align.ts`,
};
const shared = {
  bundle: true,
  target: "chrome110",
  minify: false, // readable output makes the "no network" claim easy to audit
  sourcemap: false,
  alias,
  logLevel: "info",
};

// Content scripts and the service worker cannot be ES modules.
await build({
  ...shared,
  entryPoints: {
    content: `${root}src/content.ts`,
    popup: `${root}src/popup.ts`,
    background: `${root}src/background.ts`,
  },
  outdir: dist,
  format: "iife",
});

// The offscreen page hosts the name model (transformers.js is an ES module).
await build({
  ...shared,
  entryPoints: { offscreen: `${root}src/offscreen.ts` },
  outdir: dist,
  format: "esm",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
});

for (const file of ["manifest.json", "popup.html", "popup.css", "offscreen.html"]) {
  await cp(`${root}${file}`, `${dist}/${file}`);
}
await cp(`${root}icons`, `${dist}/icons`, { recursive: true });

// The name model is optional. If it was not downloaded, the extension still works with
// the pattern rules and says so when the user turns the option on.
const MODEL = "onnx-community/distilbert-NER-ONNX";
const modelDir = `${root}../ner/models/${MODEL}`;
const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};
if (await exists(`${modelDir}/onnx/model_quantized.onnx`)) {
  await mkdir(`${dist}/models/${dirname(MODEL)}`, { recursive: true });
  await cp(modelDir, `${dist}/models/${MODEL}`, { recursive: true });
  const require = createRequire(`${root}../ner/package.json`);
  const ortRequire = createRequire(require.resolve("@huggingface/transformers"));
  const ortDist = dirname(ortRequire.resolve("onnxruntime-web"));
  await mkdir(`${dist}/ort`, { recursive: true });
  for (const f of ["ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.jsep.mjs"]) {
    await cp(`${ortDist}/${f}`, `${dist}/ort/${f}`);
  }
  console.log("Name model included.");
} else {
  console.log(
    "Name model not found; building without it. To include it: pnpm --filter @maskit/ner fetch-model",
  );
}
console.log("Extension built in packages/extension/dist");
