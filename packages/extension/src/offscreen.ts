import { env, pipeline } from "@huggingface/transformers";
import type { NerRequest, NerResponse } from "./messages";

// The model and the WebAssembly runtime are files inside this extension; remote loading is off.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";
env.useBrowserCache = false;
env.backends.onnx.wasm!.wasmPaths = {
  mjs: "/ort/ort-wasm-simd-threaded.jsep.mjs",
  wasm: "/ort/ort-wasm-simd-threaded.jsep.wasm",
};
env.backends.onnx.wasm!.numThreads = 1;

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

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.target !== "offscreen") return false;
  const request = message as NerRequest;
  void (async (): Promise<NerResponse> => {
    try {
      const run = await load();
      if (request.type === "ner:init") return { ok: true };
      return { ok: true, tokens: (await run(request.text)) as never };
    } catch (error) {
      classifier = undefined; // allow a retry
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  })().then(respond);
  return true;
});
