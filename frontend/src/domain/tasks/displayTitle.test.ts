import { describe, expect, test } from "vitest";
import { NO_TITLE_PLACEHOLDER, taskDisplayTitle } from "./displayTitle";

describe("taskDisplayTitle", () => {
  test("returns the task's own title when it has one", () => {
    expect(taskDisplayTitle("Build the thing")).toBe("Build the thing");
  });

  test("returns the placeholder when the title is an empty string", () => {
    expect(taskDisplayTitle("")).toBe(NO_TITLE_PLACEHOLDER);
  });

  test("returns the placeholder when the title is only whitespace", () => {
    expect(taskDisplayTitle("   ")).toBe(NO_TITLE_PLACEHOLDER);
  });
});
