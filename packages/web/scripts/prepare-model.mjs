// Copies the on-device name model and the WebAssembly runtime into public/ so the page can
// serve them from its own origin (the page is not allowed to fetch from anywhere else).
// The model is optional: if it was not downloaded, the app simply offers rules-only masking.
import { cp, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MODEL = "onnx-community/distilbert-NER-ONNX";
const web = fileURLToPath(new URL("..", import.meta.url));
const modelSrc = join(web, "../ner/models", MODEL);
const modelDest = join(web, "public/models", MODEL);

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

if (!(await exists(join(modelSrc, "onnx/model_quantized.onnx")))) {
  console.log(
    "[prepare-model] Name model not found; building without it. To include it run: pnpm --filter @maskit/ner fetch-model",
  );
  process.exit(0);
}

await mkdir(dirname(modelDest), { recursive: true });
await cp(modelSrc, modelDest, { recursive: true });

// Locate the onnxruntime-web files that ship with @huggingface/transformers.
const require = createRequire(join(web, "../ner/package.json"));
const transformersEntry = require.resolve("@huggingface/transformers");
const ortRequire = createRequire(transformersEntry);
// The package does not export package.json, so find its dist folder from the main entry.
const ortDist = dirname(ortRequire.resolve("onnxruntime-web"));
const ortDest = join(web, "public/ort");
await mkdir(ortDest, { recursive: true });
for (const f of [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
]) {
  await cp(join(ortDist, f), join(ortDest, f));
}
console.log("[prepare-model] Model and runtime copied to public/.");
