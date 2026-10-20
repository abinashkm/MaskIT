/**
 * Builds stand-ins for the chat pages. They use the real editor libraries the sites are built
 * on (ProseMirror for ChatGPT and Claude, Quill for Gemini), so the extension's text reading
 * and writing is exercised against genuine rich-text behavior. The markup around the editors
 * follows the selectors in packages/extension/src/adapters.ts; whether the *real* sites still
 * match those selectors can only be checked on the live sites.
 */
import { build } from "esbuild";

const PROSEMIRROR_ENTRY = `
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { schema } from "prosemirror-schema-basic";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";

window.__sent = [];
const host = document.getElementById("editor");
const view = new EditorView(host, {
  state: EditorState.create({ schema, plugins: [keymap({ Enter: () => { send(); return true; } }), keymap(baseKeymap)] }),
  attributes: window.__attrs || {},
});
function text() { return view.state.doc.textBetween(0, view.state.doc.content.size, "\\n"); }
function send() {
  window.__sent.push(text());
  view.dispatch(view.state.tr.delete(0, view.state.doc.content.size));
}
window.__text = text;
document.getElementById("send").addEventListener("click", send);
`;

const QUILL_ENTRY = `
import Quill from "quill";
window.__sent = [];
const quill = new Quill("#editor");
function send() {
  window.__sent.push(quill.getText().replace(/\\n$/, ""));
  quill.setText("");
}
window.__text = () => quill.getText().replace(/\\n$/, "");
// Capture phase, so the send runs before Quill's own Enter binding inserts a newline.
quill.root.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); send(); }
}, true);
document.getElementById("send").addEventListener("click", send);
`;

async function bundle(entry: string): Promise<string> {
  const result = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: "js" },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    logLevel: "silent",
  });
  return result.outputFiles[0]?.text ?? "";
}

export type Site = "claude" | "chatgpt" | "gemini" | "chatgpt-textarea";

const cache = new Map<string, string>();

export async function mockPage(site: Site): Promise<string> {
  const hit = cache.get(site);
  if (hit) return hit;
  let body: string;
  if (site === "chatgpt-textarea") {
    // The plain <textarea> composer seen on the logged-out ChatGPT page.
    body = `<textarea id="mobile-composer-prompt" aria-label="Chat with ChatGPT"></textarea>
      <button aria-label="Send message" id="send">Send</button><script>
      window.__sent = [];
      const box = document.getElementById("mobile-composer-prompt");
      function send() { window.__sent.push(box.value); box.value = ""; }
      window.__text = () => box.value;
      box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
      document.getElementById("send").addEventListener("click", send);
      </script>`;
  } else if (site === "gemini") {
    const js = await bundle(QUILL_ENTRY);
    body = `<rich-textarea><div id="editor"></div></rich-textarea>
      <button aria-label="Send message" id="send">Send</button><script>${js}</script>`;
  } else {
    const attrs = site === "chatgpt" ? '{ id: "prompt-textarea" }' : "{}";
    const js = await bundle(PROSEMIRROR_ENTRY);
    const label = site === "chatgpt" ? "Send prompt" : "Send message";
    const testId = site === "chatgpt" ? ' data-testid="send-button"' : "";
    body = `<div id="editor"></div>
      <button aria-label="${label}"${testId} id="send">Send</button>
      <script>window.__attrs = ${attrs};</script><script>${js}</script>`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>mock ${site}</title></head><body>${body}</body></html>`;
  cache.set(site, html);
  return html;
}
