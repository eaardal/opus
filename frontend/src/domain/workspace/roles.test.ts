import { describe, expect, test } from "vitest";
import type { WorkspaceDocument } from "../../services/workspace.types";
import { canDeleteWorkspace, canEdit, canManageMembers, isLastOwner, resolveRole } from "./roles";

const baseDoc = (overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument => ({
  ownerId: "owner-uid",
  name: "WS",
  projects: [],
  people: [],
  teams: [],
  updatedAt: new Date(),
  ...overrides,
});

describe("resolveRole", () => {
  test("returns null for a null doc", () => {
    expect(resolveRole(null, "u1")).toBeNull();
  });

  test("returns null when uid is not a member and not the legacy owner", () => {
    const doc = baseDoc({
      ownerId: "owner-uid",
      members: { "owner-uid": { role: "owner", addedAt: new Date() } },
      memberIds: ["owner-uid"],
    });
    expect(resolveRole(doc, "stranger")).toBeNull();
  });

  test("returns the member's role when present in the members map", () => {
    const doc = baseDoc({
      members: {
        "owner-uid": { role: "owner", addedAt: new Date() },
        "editor-uid": { role: "editor", addedAt: new Date() },
        "viewer-uid": { role: "viewer", addedAt: new Date() },
      },
      memberIds: ["owner-uid", "editor-uid", "viewer-uid"],
    });
    expect(resolveRole(doc, "owner-uid")).toBe("owner");
    expect(resolveRole(doc, "editor-uid")).toBe("editor");
    expect(resolveRole(doc, "viewer-uid")).toBe("viewer");
  });

  test("legacy doc without members: ownerId is treated as implicit owner", () => {
    const doc = baseDoc({ ownerId: "owner-uid" });
    expect(resolveRole(doc, "owner-uid")).toBe("owner");
    expect(resolveRole(doc, "stranger")).toBeNull();
  });

  test("if members exists but is empty, falls back to legacy ownerId check", () => {
    const doc = baseDoc({ ownerId: "owner-uid", members: {}, memberIds: [] });
    expect(resolveRole(doc, "owner-uid")).toBe("owner");
    expect(resolveRole(doc, "stranger")).toBeNull();
  });

  test("members entry takes precedence over legacy ownerId", () => {
    const doc = baseDoc({
      ownerId: "old-owner-uid",
      members: { "old-owner-uid": { role: "viewer", addedAt: new Date() } },
      memberIds: ["old-owner-uid"],
    });
    expect(resolveRole(doc, "old-owner-uid")).toBe("viewer");
  });
});

describe("permission helpers", () => {
  test("canEdit: owner and editor true; viewer and null false", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit(null)).toBe(false);
  });

  test("canManageMembers: only owner", () => {
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("editor")).toBe(false);
    expect(canManageMembers("viewer")).toBe(false);
    expect(canManageMembers(null)).toBe(false);
  });

  test("canDeleteWorkspace: only owner", () => {
    expect(canDeleteWorkspace("owner")).toBe(true);
    expect(canDeleteWorkspace("editor")).toBe(false);
    expect(canDeleteWorkspace("viewer")).toBe(false);
    expect(canDeleteWorkspace(null)).toBe(false);
  });
});

describe("isLastOwner", () => {
  test("true when the uid is the only owner in the members map", () => {
    const doc = baseDoc({
      members: {
        u1: { role: "owner", addedAt: new Date() },
        u2: { role: "editor", addedAt: new Date() },
      },
      memberIds: ["u1", "u2"],
    });
    expect(isLastOwner(doc, "u1")).toBe(true);
    expect(isLastOwner(doc, "u2")).toBe(false);
  });

  test("false when there are multiple owners", () => {
    const doc = baseDoc({
      members: {
        u1: { role: "owner", addedAt: new Date() },
        u2: { role: "owner", addedAt: new Date() },
      },
      memberIds: ["u1", "u2"],
    });
    expect(isLastOwner(doc, "u1")).toBe(false);
    expect(isLastOwner(doc, "u2")).toBe(false);
  });

  test("legacy doc with no members: ownerId is the implicit (and only) owner", () => {
    const doc = baseDoc({ ownerId: "u1" });
    expect(isLastOwner(doc, "u1")).toBe(true);
    expect(isLastOwner(doc, "u2")).toBe(false);
  });

  test("returns false for a uid that is not an owner", () => {
    const doc = baseDoc({
      members: {
        u1: { role: "owner", addedAt: new Date() },
        u2: { role: "editor", addedAt: new Date() },
      },
      memberIds: ["u1", "u2"],
    });
    expect(isLastOwner(doc, "u2")).toBe(false);
  });
});
