import { analyzeAsync, applyMask, MaskSession, restoreText, type Finding } from "@maskit/core";
import { adapterFor, findInput, isInInput, isSendControl, type Adapter } from "./adapters";
import { readText, writeText } from "./editor";
import { ExtNer } from "./extNer";
import { evaluate, SendBypass } from "./guard";
import type { Request, Response } from "./messages";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChange, type Settings } from "./settings";
import { setBadge, showReview, toast } from "./ui";

const adapter: Adapter | undefined = adapterFor(location.hostname);

// The token -> value mapping lives only in this isolated content-script world: the page's own
// scripts cannot read it, and it disappears when the tab is closed or reloaded.
const session = new MaskSession();
const bypass = new SendBypass();
const ner = new ExtNer();
let settings: Settings = DEFAULT_SETTINGS;
let reviewOpen = false;
let checking = false; // a send is being held while the name model looks at the text
let nerState: "off" | "ready" | "unavailable" = "off";
/** Result of checking the prompt while the user paused typing, keyed by the exact text. */
let precheck: { text: string; findings: Finding[] } | undefined;
let precheckTimer: ReturnType<typeof setTimeout> | undefined;

const CHECK_TIMEOUT_MS = 8000;

function stop(e: Event): void {
  e.preventDefault();
  e.stopImmediatePropagation();
}

const useNames = () => settings.enabled && settings.names && nerState === "ready";

/** Rules always run; the name model joins them when it is on. A slow model never blocks forever. */
async function analyzeText(text: string): Promise<Finding[]> {
  const options = { level: settings.level, customTerms: settings.customTerms };
  if (!useNames()) return evaluate(text, settings);
  const rulesOnly = evaluate(text, settings);
  const timeout = new Promise<Finding[]>((resolve) =>
    setTimeout(() => resolve(rulesOnly), CHECK_TIMEOUT_MS),
  );
  return Promise.race([analyzeAsync(text, options, [ner]), timeout]);
}

async function refreshNames(): Promise<void> {
  if (!settings.names) {
    nerState = "off";
    precheck = undefined;
    return;
  }
  if (nerState === "ready") return;
  // The model can need a few seconds the first time (the hidden page has to start), so a
  // failure is retried before it is reported.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await ner.init()) {
      nerState = "ready";
      return;
    }
    if (!settings.names) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  nerState = "unavailable";
  toast("Name detection is not available in this build; using pattern rules only.", 7000);
}

function schedulePrecheck(input: HTMLElement): void {
  if (!useNames()) return;
  if (precheckTimer) clearTimeout(precheckTimer);
  precheckTimer = setTimeout(() => {
    const text = readText(input);
    if (text.trim() === "") return;
    void analyzeText(text).then((findings) => {
      precheck = { text, findings };
    });
  }, 400);
}

function openReview(text: string, findings: Finding[], input: HTMLElement): void {
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

/** After a held send turned out to be clean, send it for the user. */
function resend(): void {
  bypass.allowNext();
  const button = adapter
    ? adapter.sendSelectors.map((s) => document.querySelector<HTMLElement>(s)).find(Boolean)
    : undefined;
  if (button) button.click();
  else toast("Checked: nothing sensitive found. Press send again.");
}

function guardSend(e: Event, input: HTMLElement): void {
  if (!settings.enabled || reviewOpen || checking) return;
  if (bypass.consume()) return;
  const text = readText(input);
  if (text.trim() === "") return;

  if (!useNames()) {
    const findings = evaluate(text, settings);
    if (findings.length === 0) return;
    stop(e);
    openReview(text, findings, input);
    return;
  }

  // Names are on. Use the result computed while the user paused typing if it matches.
  if (precheck && precheck.text === text) {
    if (precheck.findings.length === 0) return;
    stop(e);
    openReview(text, precheck.findings, input);
    return;
  }

  // Not checked yet (the user sent right after typing): hold the send until the model answers.
  stop(e);
  checking = true;
  toast("Checking for names...", 2500);
  void analyzeText(text)
    .then((findings) => {
      checking = false;
      if (findings.length > 0) openReview(text, findings, input);
      else resend();
    })
    .catch(() => {
      checking = false;
      const findings = evaluate(text, settings);
      if (findings.length > 0) openReview(text, findings, input);
      else resend();
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

function onInput(e: Event): void {
  if (!adapter || !isInInput(adapter, e.target)) return;
  const input = findInput(adapter, e.target);
  if (input) schedulePrecheck(input);
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
  } else if (msg.type === "maskit:names-status") {
    respond({ ok: true, names: nerState });
  }
}

async function init(): Promise<void> {
  if (!adapter) return;
  settings = await loadSettings();
  void refreshNames();
  onSettingsChange((s) => {
    settings = s;
    precheck = undefined;
    refreshBadge();
    void refreshNames();
  });
  // Capture phase on `document` runs before the site's own handlers.
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("input", onInput, true);
  chrome.runtime.onMessage.addListener(handleMessage);
  refreshBadge();
  setInterval(refreshBadge, 2000); // single-page apps re-render the prompt box
}

void init();
