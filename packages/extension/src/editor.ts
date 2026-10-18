type TextControl = HTMLTextAreaElement | HTMLInputElement;

function isTextControl(el: HTMLElement): el is TextControl {
  return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
}

export function readText(el: HTMLElement): string {
  if (isTextControl(el)) return el.value;
  return el.innerText ?? el.textContent ?? "";
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Replaces the whole content of a prompt box in a way rich editors (ProseMirror, Quill) notice.
 * Returns false if the editor did not end up with the expected text, so the caller can fall
 * back to the clipboard instead of leaving the user with a half-masked prompt.
 */
export function writeText(el: HTMLElement, text: string): boolean {
  if (isTextControl(el)) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    // Use the native setter so frameworks that track `value` see the change.
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return el.value === text;
  }
  el.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const accepted = document.execCommand("insertText", false, text);
  return accepted && squash(readText(el)) === squash(text);
}
