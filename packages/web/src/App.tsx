import {
  applyMask,
  MaskSession,
  restoreText,
  type EntityType,
  type Finding,
  type MaskLevel,
  type MaskStyle,
} from "@maskit/core";
import { useMemo, useRef, useState } from "react";
import { FilePanel } from "./FilePanel";
import { WebNer } from "./nerClient";
import { useFindings } from "./useFindings";

const SAMPLE = `Patient: Jane Doe, DOB: 03/15/1980, MRN: 00482913
Email jane.doe@example.com, phone (415) 555-2671
Card 4111 1111 1111 1111, SSN 123-45-6789
Lives at 221 Baker Street, Apt 4B. Admitted March 20, 2024.
Server 192.168.1.10, password: hunter2!`;

const LEVELS: { id: MaskLevel; label: string; hint: string }[] = [
  { id: "basic", label: "Basic", hint: "Contact details, financial IDs, secrets" },
  { id: "standard", label: "Standard", hint: "Adds names, addresses, DOB, health and network IDs" },
  {
    id: "strict",
    label: "Strict",
    hint: "Adds all dates and ages over 89 (HIPAA Safe Harbor style)",
  },
];

const key = (f: Finding) => `${f.start}:${f.end}`;

export function App() {
  const [text, setText] = useState(SAMPLE);
  const [level, setLevel] = useState<MaskLevel>("standard");
  const [style, setStyle] = useState<MaskStyle>("token");
  const [terms, setTerms] = useState("");
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [reply, setReply] = useState("");
  const [restored, setRestored] = useState("");
  const [copied, setCopied] = useState(false);
  // The mapping lives only in this component's memory; it is never stored or sent anywhere.
  const [session, setSession] = useState(() => new MaskSession());
  // Bumped when the saved mapping changes, so the preview and the counter refresh.
  const [mappingVersion, setMappingVersion] = useState(0);

  const customTerms = useMemo(
    () =>
      terms
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [terms],
  );
  // Optional on-device name model (off until the user turns it on).
  const nerRef = useRef<WebNer>();
  const [nerState, setNerState] = useState<"off" | "loading" | "on" | "unavailable">("off");
  const [nerError, setNerError] = useState("");
  const detector = nerState === "on" ? nerRef.current : undefined;
  const { findings, busy } = useFindings(text, level, customTerms, detector);

  async function toggleNer(enabled: boolean) {
    if (!enabled) {
      setNerState("off");
      return;
    }
    setNerState("loading");
    setNerError("");
    try {
      nerRef.current ??= new WebNer();
      await nerRef.current.load();
      setNerState("on");
    } catch (e) {
      nerRef.current?.dispose();
      nerRef.current = undefined;
      setNerError(e instanceof Error ? e.message : String(e));
      setNerState("unavailable");
    }
  }
  const approved = useMemo(() => findings.filter((f) => !skipped.has(key(f))), [findings, skipped]);
  // The preview runs on a scratch copy: typing must never save half-typed values in the
  // real mapping. The mapping is saved only when the user uses the result (see `commit`).
  const masked = useMemo(
    () => applyMask(text, approved, session.clone(), style),
    // `mappingVersion` is listed so the preview renumbers after the mapping changes.
    [text, approved, session, style, mappingVersion],
  );

  const counts = useMemo(() => {
    const c = new Map<EntityType, number>();
    for (const f of approved) c.set(f.entityType, (c.get(f.entityType) ?? 0) + 1);
    return [...c.entries()];
  }, [approved]);

  function toggle(f: Finding) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (!next.delete(key(f))) next.add(key(f));
      return next;
    });
  }

  /** Saves this result's tokens so replies can be restored later. */
  function commit() {
    if (style !== "token") return;
    applyMask(text, approved, session, style);
    setMappingVersion((v) => v + 1);
  }

  async function copy() {
    commit();
    try {
      await navigator.clipboard.writeText(masked);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable: the user can select and copy manually.
    }
  }

  function clearMapping() {
    session.clear();
    setSession(new MaskSession());
    setMappingVersion((v) => v + 1);
    setRestored("");
  }

  return (
    <main>
      <header>
        <h1>MaskIT</h1>
        <p>
          Mask sensitive data before you paste it into an AI tool.{" "}
          <strong>Everything runs in your browser; nothing is uploaded.</strong>
        </p>
      </header>

      <section className="controls" aria-label="Masking options">
        <label>
          Level
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value as MaskLevel);
              setSkipped(new Set());
            }}
          >
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <small>{LEVELS.find((l) => l.id === level)?.hint}</small>
        </label>
        <label>
          Style
          <select value={style} onChange={(e) => setStyle(e.target.value as MaskStyle)}>
            <option value="token">Reversible tokens [EMAIL_1]</option>
            <option value="redact">Redact [REDACTED]</option>
          </select>
        </label>
        <label className="check">
          <span>
            <input
              type="checkbox"
              checked={nerState === "on" || nerState === "loading"}
              disabled={nerState === "loading"}
              onChange={(e) => void toggleNer(e.target.checked)}
            />{" "}
            Find names, organizations and places
          </span>
          <small>
            {nerState === "loading" && "Loading the model (about 66 MB, from this site only)..."}
            {nerState === "on" && (busy ? "Checking..." : "On. The model runs in your browser.")}
            {nerState === "off" && "Optional on-device model for names without a label."}
            {nerState === "unavailable" &&
              `Not available: the model files are not installed on this site. ${nerError}`}
          </small>
        </label>
        <label>
          Always mask these words (comma separated)
          <input
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Project Falcon, Acme Corp"
          />
        </label>
      </section>

      <div className="grid">
        <section>
          <h2>1. Your text</h2>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSkipped(new Set());
            }}
            rows={14}
            spellCheck={false}
          />
        </section>

        <section>
          <h2>
            2. Review ({approved.length} of {findings.length} will be masked)
          </h2>
          {findings.length === 0 ? (
            <p className="muted">
              Nothing sensitive found. Always double-check before sending: no tool catches
              everything.
            </p>
          ) : (
            <ul className="findings">
              {findings.map((f) => (
                <li key={key(f)}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!skipped.has(key(f))}
                      onChange={() => toggle(f)}
                    />
                    <span className="tag">{f.entityType}</span>
                    <code>{text.slice(f.start, f.end)}</code>
                    <small>{Math.round(f.confidence * 100)}%</small>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2>3. Masked text</h2>
        <p className="muted">{counts.map(([t, n]) => `${t} x${n}`).join(" · ") || "No changes"}</p>
        <pre className="masked" onCopy={commit}>
          {masked}
        </pre>
        <button onClick={copy}>{copied ? "Copied" : "Copy masked text"}</button>
      </section>

      <FilePanel
        level={level}
        style={style}
        customTerms={customTerms}
        detectors={detector ? [detector] : []}
        session={session}
        onMapped={() => setMappingVersion((v) => v + 1)}
      />

      {style === "token" && (
        <section>
          <h2>Restore the AI reply</h2>
          <p className="muted">
            Use the Copy button (or select and copy the masked text) so MaskIT remembers the values,
            then paste an AI reply that contains tokens like [EMAIL_1] to put the real values back,
            locally.
          </p>
          <textarea
            value={reply}
            onChange={(e) => {
              setReply(e.target.value);
              setRestored("");
            }}
            rows={5}
            spellCheck={false}
          />
          <div className="row">
            <button onClick={() => setRestored(restoreText(reply, session))}>Restore</button>
            <button className="secondary" onClick={clearMapping}>
              Clear mapping ({session.size} saved)
            </button>
          </div>
          {restored && <pre className="masked">{restored}</pre>}
        </section>
      )}

      <footer>
        <p>
          Limits: no tool catches everything, so review before sending. Without the optional name
          model, names are only found after labels such as &quot;Patient:&quot; or &quot;Dr.&quot;;
          the model is English only and can miss unusual names. OCR can misread scans. MaskIT
          supports HIPAA Safe Harbor-style de-identification; it is not a compliance certification.
        </p>
      </footer>
    </main>
  );
}
