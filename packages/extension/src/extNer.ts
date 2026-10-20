import type { Detector, Finding } from "@maskit/core";
import { chunkText, NER_ID, tokensToFindings } from "@maskit/ner/align";
import type { NerRequest, NerResponse } from "./messages";

const send = (message: NerRequest): Promise<NerResponse> =>
  chrome.runtime.sendMessage(message) as Promise<NerResponse>;

/** The name model as seen from a page: every call goes to the extension's offscreen page. */
export class ExtNer implements Detector {
  readonly id = NER_ID;
  readonly entityTypes = ["PERSON", "ORGANIZATION", "LOCATION"] as Detector["entityTypes"];

  /** True when the model could be loaded (false if it was left out of this build). */
  async init(): Promise<boolean> {
    try {
      return !!(await send({ type: "ner:init" }))?.ok;
    } catch {
      return false;
    }
  }

  async detect(text: string): Promise<Finding[]> {
    const out: Finding[] = [];
    for (const chunk of chunkText(text)) {
      if (chunk.text.trim() === "") continue;
      const reply = await send({ type: "ner:classify", text: chunk.text });
      if (!reply?.ok) throw new Error(reply && "error" in reply ? reply.error : "no reply");
      out.push(...tokensToFindings(chunk.text, reply.tokens ?? [], chunk.offset));
    }
    return out;
  }
}
