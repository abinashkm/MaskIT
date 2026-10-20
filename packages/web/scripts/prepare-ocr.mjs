// Makes the text-recognition (OCR) engine available from this site's own origin: the worker
// and WebAssembly core come from node_modules, the English language data is downloaded once.
// OCR is optional; if anything is missing the app says so and everything else still works.
import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("..", import.meta.url));
const dest = join(web, "public/ocr");
const require = createRequire(join(web, "package.json"));

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

try {
  const tessDist = dirname(require.resolve("tesseract.js/package.json")) + "/dist";
  // The core is a dependency of tesseract.js, so resolve it from there.
  const tessRequire = createRequire(require.resolve("tesseract.js"));
  const coreDir = dirname(tessRequire.resolve("tesseract.js-core/package.json"));
  await mkdir(dest, { recursive: true });
  await cp(join(tessDist, "worker.min.js"), join(dest, "worker.min.js"));
  for (const f of ["tesseract-core-simd-lstm.wasm.js", "tesseract-core-lstm.wasm.js"]) {
    await cp(join(coreDir, f), join(dest, f));
  }
} catch (error) {
  console.log(`[prepare-ocr] OCR engine not found, skipping (${error.message}).`);
  process.exit(0);
}

const data = join(dest, "eng.traineddata");
if (!(await exists(data))) {
  try {
    const url = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(data, Buffer.from(await res.arrayBuffer()));
    console.log("[prepare-ocr] Downloaded English language data.");
  } catch (error) {
    console.log(
      `[prepare-ocr] Could not download language data (${error.message}); OCR will be unavailable.`,
    );
    process.exit(0);
  }
}
console.log("[prepare-ocr] OCR files ready in public/ocr.");
