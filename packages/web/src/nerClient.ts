import type { Detector, Finding } from "@maskit/core";
import { chunkText, NER_ID, tokensToFindings, type ModelToken } from "@maskit/ner/align";

type Reply = { id: number; ok: boolean; tokens?: ModelToken[]; error?: string };

/**
 * Runs the name model in a Web Worker so typing never freezes the page. The worker loads the
 * model from this site's own files; nothing is fetched from anywhere else.
 */
export class WebNer implements Detector {
  readonly id = NER_ID;
  readonly entityTypes = ["PERSON", "ORGANIZATION", "LOCATION"] as Detector["entityTypes"];

  private worker: Worker | undefined;
  private next = 1;
  private readonly pending = new Map<number, (r: Reply) => void>();

  private call(message: { type: "init" | "classify"; text?: string }): Promise<Reply> {
    if (!this.worker) {
      this.worker = new Worker(new URL("./ner.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<Reply>) => {
        this.pending.get(e.data.id)?.(e.data);
        this.pending.delete(e.data.id);
      };
    }
    const id = this.next++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker?.postMessage({ id, ...message });
    });
  }

  /** Loads the model; rejects with a readable message if the files are not installed. */
  async load(): Promise<void> {
    const reply = await this.call({ type: "init" });
    if (!reply.ok) throw new Error(reply.error ?? "The name model could not be loaded.");
  }

  async detect(text: string): Promise<Finding[]> {
    const out: Finding[] = [];
    for (const chunk of chunkText(text)) {
      if (chunk.text.trim() === "") continue;
      const reply = await this.call({ type: "classify", text: chunk.text });
      if (!reply.ok) throw new Error(reply.error);
      out.push(...tokensToFindings(chunk.text, reply.tokens ?? [], chunk.offset));
    }
    return out;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.pending.clear();
  }
}
