// One-time developer/build step: downloads the NER model into packages/ner/models.
// MaskIT itself never downloads anything at run time; the model is shipped as a static file.
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = process.argv[2] ?? "onnx-community/distilbert-NER-ONNX";
const FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx",
];
const outRoot = fileURLToPath(new URL(`../models/${MODEL}/`, import.meta.url));

for (const file of FILES) {
  const dest = `${outRoot}${file}`;
  try {
    await stat(dest);
    console.log(`have  ${file}`);
    continue;
  } catch {
    // not downloaded yet
  }
  const url = `https://huggingface.co/${MODEL}/resolve/main/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (file === "special_tokens_map.json") continue; // optional
    throw new Error(`${url}: HTTP ${res.status}`);
  }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`fetched ${file}`);
}
console.log(`Model ready in packages/ner/models/${MODEL}`);
