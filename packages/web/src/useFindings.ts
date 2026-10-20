import { analyze, analyzeAsync, type Detector, type Finding, type MaskLevel } from "@maskit/core";
import { useEffect, useMemo, useState } from "react";

/**
 * Findings for the text. The pattern rules answer immediately; if a detector (the name model)
 * is on, its result replaces them a moment later, once typing pauses. A result that arrives
 * after the text changed again is thrown away.
 */
export function useFindings(
  text: string,
  level: MaskLevel,
  customTerms: string[],
  detector: Detector | undefined,
): { findings: Finding[]; busy: boolean } {
  const rules = useMemo(() => analyze(text, { level, customTerms }), [text, level, customTerms]);
  const stamp = useMemo(
    () => JSON.stringify([text, level, customTerms, detector?.id]),
    [text, level, customTerms, detector],
  );
  const [done, setDone] = useState<{ stamp: string; findings: Finding[] }>();

  useEffect(() => {
    if (!detector) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      analyzeAsync(text, { level, customTerms }, [detector])
        .then((findings) => !cancelled && setDone({ stamp, findings }))
        .catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, level, customTerms, detector, stamp]);

  const fresh = !!detector && done?.stamp === stamp;
  return { findings: fresh ? done.findings : rules, busy: !!detector && !fresh };
}
