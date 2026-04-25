import { describe, expect, test } from "vitest";
import { CATEGORY_DEFINITIONS, CATEGORY_IDS } from "./categoryConfig";

describe("CATEGORY_DEFINITIONS", () => {
  test("exposes all six known categories", () => {
    expect([...CATEGORY_IDS].sort()).toEqual([
      "backend",
      "external_dependency",
      "frontend",
      "integration",
      "qa",
      "ux",
    ]);
  });

  test("integration and qa are diamonds", () => {
    expect(CATEGORY_DEFINITIONS.integration.shape).toBe("diamond");
    expect(CATEGORY_DEFINITIONS.qa.shape).toBe("diamond");
  });

  test("external_dependency is a triangle", () => {
    expect(CATEGORY_DEFINITIONS.external_dependency.shape).toBe("triangle");
  });

  test("plain categories (backend/frontend/ux) have no explicit shape (default circle)", () => {
    expect(CATEGORY_DEFINITIONS.backend.shape).toBeUndefined();
    expect(CATEGORY_DEFINITIONS.frontend.shape).toBeUndefined();
    expect(CATEGORY_DEFINITIONS.ux.shape).toBeUndefined();
  });

  test("every category has a non-empty label", () => {
    for (const id of CATEGORY_IDS) {
      expect(CATEGORY_DEFINITIONS[id].label.length).toBeGreaterThan(0);
    }
  });
});
