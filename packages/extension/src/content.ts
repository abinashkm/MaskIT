import { applyMask, MaskSession, restoreText } from "@maskit/core";
import { adapterFor, findInput, isInInput, isSendControl, type Adapter } from "./adapters";
import { readText, writeText } from "./editor";
import { evaluate, SendBypass } from "./guard";
import type { Request, Response } from "./messages";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChange, type Settings } from "./settings";
import { setBadge, showReview, toast } from "./ui";

const adapter: Adapter | undefined = adapterFor(location.hostname);

// The token -> value mapping lives only in this isolated content-script world: the page's own
// scripts cannot read it, and it disappears when the tab is closed or reloaded.
const session = new MaskSession();
const bypass = new SendBypass();
let settings: Settings = DEFAULT_SETTINGS;
let reviewOpen = false;

function stop(e: Event): void {
  e.preventDefault();
  e.stopImmediatePropagation();
}

function guardSend(e: Event, input: HTMLElement): void {
  if (!settings.enabled || reviewOpen) return;
  if (bypass.consume()) return;
  const text = readText(input);
  const findings = evaluate(text, settings);
  if (findings.length === 0) return;

  stop(e);
  reviewOpen = true;
  showReview({
    text,
    findings,
    onMask(approved) {
      reviewOpen = false;
      const masked = applyMask(text, approved, session);
      if (writeText(input, masked)) {
        toast("Masked. Check the text, then send.");
      } else {
        // The editor refused our edit: never leave the user with an unmasked prompt unnoticed.
        void navigator.clipboard.writeText(masked).catch(() => undefined);
        toast("Could not edit the box. Masked text copied; select all and paste it.", 8000);
      }
    },
    onSendAnyway() {
      reviewOpen = false;
      bypass.allowNext();
      toast("Unmasked send allowed once. Press send again.");
    },
    onCancel() {
      reviewOpen = false;
    },
  });
}

function onKeyDown(e: KeyboardEvent): void {
  if (!adapter || e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  if (!isInInput(adapter, e.target)) return;
  const input = findInput(adapter, e.target);
  if (input) guardSend(e, input);
}

function onClick(e: MouseEvent): void {
  if (!adapter || !isSendControl(adapter, e.target)) return;
  const input = findInput(adapter);
  if (input) guardSend(e, input);
}

function refreshBadge(): void {
  if (!adapter) return;
  if (!settings.enabled) setBadge("off", "MaskIT off");
  else if (findInput(adapter)) setBadge("on", "MaskIT on");
  else setBadge("warn", "MaskIT: prompt box not found");
}

function handleMessage(
  msg: Request,
  _sender: chrome.runtime.MessageSender,
  respond: (r: Response) => void,
): void {
  if (msg.type === "maskit:restore") {
    respond({ ok: true, text: restoreText(msg.text, session), known: session.size });
  } else if (msg.type === "maskit:status") {
    respond({
      ok: true,
      site: adapter?.label ?? "",
      attached: !!adapter && !!findInput(adapter),
      mappings: session.size,
    });
  }
}

async function init(): Promise<void> {
  if (!adapter) return;
  settings = await loadSettings();
  onSettingsChange((s) => {
    settings = s;
    refreshBadge();
  });
  // Capture phase on `document` runs before the site's own handlers.
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("click", onClick, true);
  chrome.runtime.onMessage.addListener(handleMessage);
  refreshBadge();
  setInterval(refreshBadge, 2000); // single-page apps re-render the prompt box
}

void init();
