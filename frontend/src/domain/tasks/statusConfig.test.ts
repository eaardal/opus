import { describe, expect, test } from "vitest";
import { STATUS_DEFINITIONS } from "./statusConfig";
import type { TaskStatus } from "./types";

describe("STATUS_DEFINITIONS", () => {
  const expected: TaskStatus[] = ["pending", "in_progress", "completed", "archived"];

  test("includes a definition for every TaskStatus", () => {
    for (const status of expected) {
      expect(STATUS_DEFINITIONS[status]).toBeDefined();
    }
  });

  test("every status has a non-empty label and emoji", () => {
    for (const status of expected) {
      expect(STATUS_DEFINITIONS[status].label.length).toBeGreaterThan(0);
      expect(STATUS_DEFINITIONS[status].emoji.length).toBeGreaterThan(0);
    }
  });
});
