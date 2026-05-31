import { describe, expect, test } from "vitest";
import { wrapText } from "./wrapText";

describe("wrapText", () => {
  test("keeps text that fits on a single line", () => {
    expect(wrapText("Backend team", 20)).toEqual(["Backend team"]);
  });

  test("wraps at word boundaries when a line exceeds the limit", () => {
    expect(wrapText("Customer onboarding and retention", 20)).toEqual([
      "Customer onboarding",
      "and retention",
    ]);
  });

  test("hard-breaks a single word longer than the limit", () => {
    expect(wrapText("supercalifragilistic", 10)).toEqual(["supercalif", "ragilistic"]);
  });

  test("flushes the current line before hard-breaking a long word", () => {
    expect(wrapText("a verylongwordhere", 8)).toEqual(["a", "verylong", "wordhere"]);
  });

  test("collapses runs of whitespace between words", () => {
    expect(wrapText("Backend    team", 20)).toEqual(["Backend team"]);
  });

  test("returns an empty array for blank input", () => {
    expect(wrapText("   ", 20)).toEqual([]);
    expect(wrapText("", 20)).toEqual([]);
  });
});
