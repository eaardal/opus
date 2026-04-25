import { describe, expect, test } from "vitest";
import { AVATAR_COLORS, avatarColor } from "./avatar";

describe("avatarColor", () => {
  test("is deterministic — the same id always maps to the same colour", () => {
    expect(avatarColor("user-42")).toBe(avatarColor("user-42"));
  });

  test("only returns colours from the AVATAR_COLORS palette", () => {
    const palette = new Set(AVATAR_COLORS);
    for (const id of ["a", "bb", "ccc", "abcdef0123456789", "user-with-many-chars"]) {
      expect(palette.has(avatarColor(id))).toBe(true);
    }
  });

  test("returns a valid colour even for the empty string (the hash collapses to 0)", () => {
    const colour = avatarColor("");
    expect(AVATAR_COLORS).toContain(colour);
  });

  test("distributes ids across the palette (sanity check, not strict statistical guarantee)", () => {
    // For 200 sequential ids we should hit at least 5 of the 7 buckets.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(avatarColor(`user-${i}`));
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});
