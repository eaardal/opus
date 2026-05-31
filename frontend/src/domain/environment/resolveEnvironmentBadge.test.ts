import { describe, expect, test } from "vitest";
import { resolveEnvironmentBadge } from "./resolveEnvironmentBadge";

describe("resolveEnvironmentBadge", () => {
  test("badges staging during local development against the staging project", () => {
    expect(resolveEnvironmentBadge("development", "domino-staging-dc209")).toBe("staging");
  });

  test("badges staging in the staging hosting build", () => {
    expect(resolveEnvironmentBadge("staging", "domino-staging-dc209")).toBe("staging");
  });

  test("hides the badge in the production hosting build", () => {
    expect(resolveEnvironmentBadge("production", "domino-34fce")).toBeNull();
  });

  test("badges production when developing locally against the production project", () => {
    // Safety: a local build wired to the prod backend must be unmistakable.
    expect(resolveEnvironmentBadge("development", "domino-34fce")).toBe("production");
  });

  test("treats a missing project id as production so a misconfig never reads as safe", () => {
    expect(resolveEnvironmentBadge("development", undefined)).toBe("production");
  });
});
