import type { NerRequest, NerResponse } from "./messages";

/**
 * Service worker. Its only job is to start the offscreen page that hosts the name model and
 * pass messages to it; it never sees prompt text it does not forward, and it makes no requests.
 */

let creating: Promise<void> | undefined;

/**
 * Makes sure the offscreen page exists. Many tabs can ask at the same moment (for example when
 * the user turns the option on with several AI tabs open) and only one such page is allowed,
 * so everyone shares a single creation attempt.
 */
function ensureOffscreen(): Promise<void> {
  creating ??= (async () => {
    const open = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    });
    if (open.length > 0) return;
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["WORKERS" as chrome.offscreen.Reason],
      justification: "Run the on-device name detection model.",
    });
  })().finally(() => {
    creating = undefined;
  });
  return creating;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function forward(message: NerRequest): Promise<NerResponse> {
  try {
    await ensureOffscreen();
    // A freshly created offscreen page needs a moment before it listens; retry until it does.
    let lastError = "no reply";
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const reply = (await chrome.runtime.sendMessage({
          ...message,
          target: "offscreen",
        })) as NerResponse | undefined;
        if (reply) return reply;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await wait(250);
    }
    return { ok: false, error: lastError };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Only this extension's own scripts may use the model, and messages meant for the offscreen
  // page are not ours to answer.
  if (sender.id !== chrome.runtime.id || message?.target === "offscreen") return false;
  if (message?.type === "ner:init" || message?.type === "ner:classify") {
    void forward(message as NerRequest).then(respond);
    return true; // answer asynchronously
  }
  return false;
});
