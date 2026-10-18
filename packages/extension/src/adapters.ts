/**
 * One adapter per AI site. Selectors live here and nowhere else so a site redesign breaks
 * one entry, not the product. Selectors are best-effort and must be re-verified on the real
 * sites (see docs/MAINTENANCE.md, "Fixing a broken AI-site adapter").
 */
export interface Adapter {
  id: string;
  label: string;
  hosts: string[];
  inputSelectors: string[];
  sendSelectors: string[];
}

export const ADAPTERS: Adapter[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    hosts: ["chatgpt.com", "chat.openai.com"],
    inputSelectors: [
      "#prompt-textarea",
      'div.ProseMirror[contenteditable="true"]',
      'textarea[data-id="root"]',
    ],
    sendSelectors: ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]'],
  },
  {
    id: "claude",
    label: "Claude",
    hosts: ["claude.ai"],
    inputSelectors: [
      'div[contenteditable="true"].ProseMirror',
      '[data-testid="chat-input"]',
      'fieldset div[contenteditable="true"]',
    ],
    sendSelectors: ['button[aria-label="Send message"]', 'button[aria-label="Send Message"]'],
  },
  {
    id: "gemini",
    label: "Gemini",
    hosts: ["gemini.google.com"],
    inputSelectors: [
      'rich-textarea div.ql-editor[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
    ],
    sendSelectors: ['button[aria-label="Send message"]', "button.send-button"],
  },
];

/** Exact host or a real subdomain only, so "evilclaude.ai" never matches "claude.ai". */
export function adapterFor(hostname: string): Adapter | undefined {
  const host = hostname.toLowerCase();
  return ADAPTERS.find((a) => a.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
}

function asElement(target: EventTarget | null | undefined): Element | null {
  return target instanceof Element ? target : null;
}

/** The prompt box: the one containing the event target, else the first match on the page. */
export function findInput(adapter: Adapter, from?: EventTarget | null): HTMLElement | null {
  const start = asElement(from);
  for (const selector of adapter.inputSelectors) {
    const hit = start?.closest(selector);
    if (hit instanceof HTMLElement) return hit;
  }
  for (const selector of adapter.inputSelectors) {
    const hit = document.querySelector(selector);
    if (hit instanceof HTMLElement) return hit;
  }
  return null;
}

/** True when the target is inside the prompt box (used for Enter-key interception). */
export function isInInput(adapter: Adapter, target: EventTarget | null): boolean {
  const el = asElement(target);
  return !!el && adapter.inputSelectors.some((s) => el.closest(s));
}

export function isSendControl(adapter: Adapter, target: EventTarget | null): boolean {
  const el = asElement(target);
  return !!el && adapter.sendSelectors.some((s) => el.closest(s));
}
