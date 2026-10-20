import type { ModelToken } from "@maskit/ner/align";

/** Popup <-> content script messages. The mapping never leaves the content script. */
export type Request =
  | { type: "maskit:restore"; text: string }
  | { type: "maskit:status" }
  | { type: "maskit:names-status" };

export type RestoreResponse = { ok: true; text: string; known: number };
export type StatusResponse = { ok: true; site: string; attached: boolean; mappings: number };
export type NamesStatusResponse = { ok: true; names: "off" | "ready" | "unavailable" };
export type Response = RestoreResponse | StatusResponse | NamesStatusResponse;

/**
 * Content script -> service worker -> offscreen page. The offscreen page hosts the name model,
 * because it is the extension page that may run WebAssembly and keep a large model in memory.
 */
export type NerRequest = { type: "ner:init" } | { type: "ner:classify"; text: string };
export type NerResponse = { ok: true; tokens?: ModelToken[] } | { ok: false; error: string };
