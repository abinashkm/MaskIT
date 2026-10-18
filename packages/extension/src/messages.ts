/** Popup <-> content script messages. The mapping never leaves the content script. */
export type Request = { type: "maskit:restore"; text: string } | { type: "maskit:status" };

export type RestoreResponse = { ok: true; text: string; known: number };
export type StatusResponse = { ok: true; site: string; attached: boolean; mappings: number };
export type Response = RestoreResponse | StatusResponse;
