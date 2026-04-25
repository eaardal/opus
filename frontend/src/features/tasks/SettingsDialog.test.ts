import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./SettingsDialog";

const STORAGE_KEY = "app-settings";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe("loadSettings", () => {
  test("returns the defaults when nothing has been stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test("merges stored values onto the defaults so new fields fall back", () => {
    // Persist a partial settings object — the field exists, but with a
    // non-default value. Any future-added fields will fall through to defaults.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showBlockedBySection: false }));
    const result = loadSettings();
    expect(result).toEqual({ showBlockedBySection: false });
  });

  test("returns the defaults when the stored JSON is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test("returns the defaults when the stored value is an empty string", () => {
    localStorage.setItem(STORAGE_KEY, "");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("saveSettings", () => {
  test("writes a JSON-encoded settings object to localStorage", () => {
    saveSettings({ showBlockedBySection: false });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toEqual({ showBlockedBySection: false });
  });

  test("save then load round-trips the same object", () => {
    saveSettings({ showBlockedBySection: false });
    expect(loadSettings()).toEqual({ showBlockedBySection: false });
  });
});
