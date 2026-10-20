import type { Detector, Finding } from "@maskit/core";
import { chunkText, NER_ID, tokensToFindings, type ModelToken } from "./align.js";

export const DEFAULT_MODEL_ID = "onnx-community/distilbert-NER-ONNX";

export interface NerOptions {
  /** Folder that contains `<modelId>/` (config.json, tokenizer.json, onnx/model_quantized.onnx). */
  modelRoot: string;
  modelId?: string;
  /** Drop entities the model is less sure about than this (0..1). */
  minScore?: number;
  /** "node" uses onnxruntime-node (tests, CLI); "web" uses the WebAssembly runtime in a browser. */
  runtime?: "node" | "web";
}

type Classifier = (text: string) => Promise<ModelToken[]>;

/**
 * On-device name/organization/location detector. The model is a local file; with remote
 * loading switched off, this code cannot reach the network.
 */
export async function createNerDetector(options: NerOptions): Promise<Detector> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = options.modelRoot;

  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  const classify = (await pipeline("token-classification", modelId, {
    dtype: "q8",
    ...(options.runtime === "web" ? { device: "wasm" as const } : {}),
  })) as unknown as Classifier;

  const minScore = options.minScore ?? 0.5;
  return {
    id: NER_ID,
    entityTypes: ["PERSON", "ORGANIZATION", "LOCATION"],
    async detect(text: string): Promise<Finding[]> {
      const out: Finding[] = [];
      for (const chunk of chunkText(text)) {
        if (chunk.text.trim() === "") continue;
        const tokens = await classify(chunk.text);
        out.push(...tokensToFindings(chunk.text, tokens, chunk.offset, minScore));
      }
      return out;
    },
  };
}
