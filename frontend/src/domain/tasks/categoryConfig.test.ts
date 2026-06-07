import { describe, expect, test } from "vitest";
import { CATEGORY_DEFINITIONS, CATEGORY_IDS, resolveCategoryKey } from "./categoryConfig";

describe("CATEGORY_DEFINITIONS", () => {
  test("exposes all six known categories", () => {
    expect([...CATEGORY_IDS].sort()).toEqual([
      "backend",
      "external_dependency",
      "frontend",
      "milestone",
      "qa",
      "ux",
    ]);
  });

  test("milestone and qa are diamonds", () => {
    expect(CATEGORY_DEFINITIONS.milestone.shape).toBe("diamond");
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

describe("resolveCategoryKey", () => {
  test("maps the legacy 'integration' key to 'milestone'", () => {
    expect(resolveCategoryKey("integration")).toBe("milestone");
  });

  test("passes through current keys unchanged", () => {
    for (const id of CATEGORY_IDS) {
      expect(resolveCategoryKey(id)).toBe(id);
    }
  });

  test("passes through unknown keys unchanged", () => {
    expect(resolveCategoryKey("something_else")).toBe("something_else");
  });
});
