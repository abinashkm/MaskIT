import type { Request, Response } from "./messages";
import { loadSettings, saveSettings, type ExtensionLevel } from "./settings";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/** Talks to the content script; resolves undefined when the tab is not a supported site. */
async function ask(msg: Request): Promise<Response | undefined> {
  const id = await activeTabId();
  if (id === undefined) return undefined;
  try {
    return (await chrome.tabs.sendMessage(id, msg)) as Response | undefined;
  } catch {
    return undefined;
  }
}

async function init(): Promise<void> {
  const settings = await loadSettings();
  const enabled = $<HTMLInputElement>("enabled");
  const level = $<HTMLSelectElement>("level");
  const terms = $<HTMLInputElement>("terms");
  enabled.checked = settings.enabled;
  level.value = settings.level;
  terms.value = settings.customTerms.join(", ");

  enabled.onchange = () => void saveSettings({ enabled: enabled.checked });
  level.onchange = () => void saveSettings({ level: level.value as ExtensionLevel });
  terms.onchange = () =>
    void saveSettings({
      customTerms: terms.value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });

  const status = $("status");
  const info = await ask({ type: "maskit:status" });
  if (info && info.ok && "attached" in info) {
    status.textContent = info.attached
      ? `Active on ${info.site}. ${info.mappings} value(s) masked this tab.`
      : `On ${info.site}, but the prompt box was not found (the site may have changed).`;
  } else {
    status.textContent = "Open ChatGPT, Claude or Gemini to use MaskIT on that page.";
  }

  const reply = $<HTMLTextAreaElement>("reply");
  const out = $("restored");
  $("restore").onclick = async () => {
    const res = await ask({ type: "maskit:restore", text: reply.value });
    out.textContent =
      res && res.ok && "known" in res ? res.text : "Open a supported AI tab first, then try again.";
  };
}

void init();
