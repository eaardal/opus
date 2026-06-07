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
    expect(result).toEqual({ ...DEFAULT_SETTINGS, showBlockedBySection: false });
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
    const settings = { ...DEFAULT_SETTINGS, showBlockedBySection: false };
    saveSettings(settings);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toEqual(settings);
  });

  test("save then load round-trips the same object", () => {
    const settings = { ...DEFAULT_SETTINGS, showBlockedBySection: false, scrollToPan: false };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });
});

describe("presentationBarExpandedByDefault setting", () => {
  test("defaults to false so the bar starts collapsed", () => {
    expect(DEFAULT_SETTINGS.presentationBarExpandedByDefault).toBe(false);
  });

  test("falls back to false when the stored data predates the setting", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showBlockedBySection: false }));
    expect(loadSettings().presentationBarExpandedByDefault).toBe(false);
  });

  test("preserves true when explicitly stored", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ presentationBarExpandedByDefault: true }));
    expect(loadSettings().presentationBarExpandedByDefault).toBe(true);
  });
});

describe("scrollToPan setting", () => {
  test("defaults to true so scroll pans out of the box", () => {
    expect(DEFAULT_SETTINGS.scrollToPan).toBe(true);
  });

  test("loadSettings returns scrollToPan: true when the stored data predates the setting", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showBlockedBySection: false }));
    expect(loadSettings().scrollToPan).toBe(true);
  });

  test("loadSettings preserves scrollToPan: false when explicitly stored", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scrollToPan: false }));
    expect(loadSettings().scrollToPan).toBe(false);
  });
});
