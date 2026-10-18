import type { MaskLevel } from "@maskit/core";

export type ExtensionLevel = Exclude<MaskLevel, "custom">;

export interface Settings {
  enabled: boolean;
  level: ExtensionLevel;
  customTerms: string[];
}

export const DEFAULT_SETTINGS: Settings = { enabled: true, level: "standard", customTerms: [] };

const LEVELS: ExtensionLevel[] = ["basic", "standard", "strict"];
const STORAGE_KEY = "maskit.settings";

/** Accepts anything read from storage and returns a safe, complete Settings object. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_SETTINGS.enabled,
    level: LEVELS.includes(r.level as ExtensionLevel)
      ? (r.level as ExtensionLevel)
      : DEFAULT_SETTINGS.level,
    customTerms: Array.isArray(r.customTerms)
      ? r.customTerms.filter((t): t is string => typeof t === "string" && t.trim() !== "")
      : [],
  };
}

// Settings (including custom words, which can be sensitive) use storage.local on purpose:
// the synced store would upload them to the user's Google account.
export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export function onSettingsChange(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    const change = changes[STORAGE_KEY];
    if (area === "local" && change) callback(normalizeSettings(change.newValue));
  });
}
