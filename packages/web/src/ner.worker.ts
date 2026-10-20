/// <reference lib="webworker" />
import { env, pipeline } from "@huggingface/transformers";

// Everything is served from this page's own origin; remote loading is switched off.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";
env.backends.onnx.wasm!.wasmPaths = {
  mjs: "/ort/ort-wasm-simd-threaded.jsep.mjs",
  wasm: "/ort/ort-wasm-simd-threaded.jsep.wasm",
};
env.backends.onnx.wasm!.numThreads = 1; // multi-threading needs cross-origin isolation headers

const MODEL_ID = "onnx-community/distilbert-NER-ONNX";

type Classifier = (text: string) => Promise<unknown[]>;
let classifier: Promise<Classifier> | undefined;

function load(): Promise<Classifier> {
  classifier ??= pipeline("token-classification", MODEL_ID, {
    dtype: "q8",
    device: "wasm",
  }) as unknown as Promise<Classifier>;
  return classifier;
}

self.onmessage = async (
  e: MessageEvent<{ id: number; type: "init" | "classify"; text?: string }>,
) => {
  const { id, type, text } = e.data;
  try {
    const run = await load();
    if (type === "init") self.postMessage({ id, ok: true });
    else self.postMessage({ id, ok: true, tokens: await run(text ?? "") });
  } catch (error) {
    classifier = undefined; // allow a retry
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
