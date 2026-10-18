import type { Finding } from "@maskit/core";

/**
 * All on-page UI lives in a closed shadow root so the host page cannot read it or restyle it.
 * Text from the user's prompt is only ever inserted with textContent, never as HTML.
 */
const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, sans-serif; }
.badge { position: fixed; right: 12px; bottom: 12px; z-index: 2147483646; padding: 4px 10px;
  border-radius: 999px; font-size: 12px; color: #fff; background: #1a7f37; opacity: .9; }
.badge.warn { background: #b35900; } .badge.off { background: #5f6368; }
.backdrop { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center; }
.dialog { background: #fff; color: #1a1a1a; width: min(560px, 92vw); max-height: 80vh; overflow: auto;
  border-radius: 12px; padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,.35); }
h2 { margin: 0 0 4px; font-size: 18px; } p { margin: 4px 0 12px; color: #444; font-size: 14px; }
ul { list-style: none; margin: 0 0 16px; padding: 0; max-height: 280px; overflow: auto; }
li label { display: flex; gap: 8px; align-items: center; padding: 4px 0; font-size: 14px; }
.tag { background: #e8f0fe; border-radius: 6px; padding: 1px 6px; font-size: 12px; font-weight: 600; }
code { background: #f1f3f4; padding: 1px 4px; border-radius: 4px; word-break: break-all; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
button { font-size: 14px; padding: 8px 14px; border-radius: 8px; border: 1px solid #1a56db;
  background: #fff; color: #1a56db; cursor: pointer; }
button.primary { background: #1a56db; color: #fff; }
button:focus-visible { outline: 3px solid #f5a623; outline-offset: 2px; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483647;
  background: #202124; color: #fff; padding: 10px 16px; border-radius: 8px; font-size: 14px; max-width: 90vw; }
`;

type Child = Node | string;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { class: className, ...rest } = props;
  if (className) el.className = className;
  Object.assign(el, rest);
  for (const c of children) el.append(c);
  return el;
}

let root: ShadowRoot | undefined;
function shadow(): ShadowRoot {
  if (root) return root;
  const host = document.createElement("div");
  host.id = "maskit-root";
  root = host.attachShadow({ mode: "closed" });
  root.append(h("style", { textContent: STYLE }));
  document.documentElement.append(host);
  return root;
}

export type BadgeState = "on" | "warn" | "off";
let badgeEl: HTMLDivElement | undefined;
export function setBadge(state: BadgeState, text: string): void {
  const r = shadow();
  badgeEl ??= r.appendChild(h("div", { class: "badge", role: "status" }));
  badgeEl.className = `badge ${state === "on" ? "" : state}`.trim();
  badgeEl.textContent = text;
}

export function toast(message: string, ms = 5000): void {
  const el = shadow().appendChild(
    h("div", { class: "toast", role: "status", textContent: message }),
  );
  setTimeout(() => el.remove(), ms);
}

export interface ReviewRequest {
  text: string;
  findings: Finding[];
  /** Called with the findings the user left ticked. */
  onMask(approved: Finding[]): void;
  onSendAnyway(): void;
  onCancel(): void;
}

let openDialog: HTMLElement | undefined;

export function showReview(req: ReviewRequest): void {
  openDialog?.remove();
  const checks: { box: HTMLInputElement; finding: Finding }[] = [];
  const list = h("ul");
  for (const finding of req.findings) {
    const box = h("input", { type: "checkbox", checked: true });
    checks.push({ box, finding });
    list.append(
      h(
        "li",
        {},
        h(
          "label",
          {},
          box,
          h("span", { class: "tag", textContent: finding.entityType }),
          h("code", { textContent: req.text.slice(finding.start, finding.end) }),
        ),
      ),
    );
  }

  const close = () => {
    openDialog?.remove();
    openDialog = undefined;
  };
  const maskBtn = h("button", { class: "primary", textContent: "Mask selected" });
  const anywayBtn = h("button", { textContent: "Send without masking" });
  const cancelBtn = h("button", { textContent: "Cancel" });
  maskBtn.onclick = () => {
    close();
    req.onMask(checks.filter((c) => c.box.checked).map((c) => c.finding));
  };
  anywayBtn.onclick = () => {
    close();
    req.onSendAnyway();
  };
  cancelBtn.onclick = () => {
    close();
    req.onCancel();
  };

  const dialog = h(
    "div",
    { class: "dialog", role: "dialog" },
    h("h2", { textContent: `MaskIT found ${req.findings.length} sensitive item(s)` }),
    h("p", { textContent: "Untick anything that is fine to send. Nothing leaves your browser." }),
    list,
    h("div", { class: "actions" }, cancelBtn, anywayBtn, maskBtn),
  );
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "MaskIT review");
  const backdrop = h("div", { class: "backdrop" }, dialog);
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      req.onCancel();
    }
  });
  openDialog = backdrop;
  shadow().append(backdrop);
  maskBtn.focus();
}
