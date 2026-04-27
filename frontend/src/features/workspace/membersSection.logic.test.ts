import { describe, expect, test } from "vitest";
import type { RegisteredUser } from "../../services/user.types";
import type { WorkspaceDocument } from "../../services/workspace.types";
import { buildMemberRows, filterCandidates } from "./membersSection.logic";

const baseDoc = (overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument => ({
  ownerId: "owner-uid",
  name: "WS",
  projects: [],
  people: [],
  teams: [],
  updatedAt: new Date(),
  ...overrides,
});

const user = (overrides: Partial<RegisteredUser>): RegisteredUser => ({
  uid: "u1",
  email: "u1@apparat.no",
  displayName: "User 1",
  photoURL: null,
  updatedAt: new Date(),
  ...overrides,
});

describe("buildMemberRows", () => {
  test("uses members map when populated, sorted owner > editor > viewer", () => {
    const doc = baseDoc({
      members: {
        u1: { role: "viewer", addedAt: new Date() },
        u2: { role: "owner", addedAt: new Date() },
        u3: { role: "editor", addedAt: new Date() },
      },
      memberIds: ["u1", "u2", "u3"],
    });
    const rows = buildMemberRows(doc, [
      user({ uid: "u1", displayName: "Alice" }),
      user({ uid: "u2", displayName: "Bob" }),
      user({ uid: "u3", displayName: "Carol" }),
    ]);
    expect(rows.map((r) => r.uid)).toEqual(["u2", "u3", "u1"]);
  });

  test("falls back to ownerId when members is absent", () => {
    const doc = baseDoc({ ownerId: "legacy-owner" });
    const rows = buildMemberRows(doc, [user({ uid: "legacy-owner", displayName: "Legacy" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ uid: "legacy-owner", role: "owner", displayName: "Legacy" });
  });

  test("falls back to ownerId when members is an empty map", () => {
    const doc = baseDoc({ ownerId: "legacy-owner", members: {}, memberIds: [] });
    const rows = buildMemberRows(doc, []);
    expect(rows).toEqual([
      {
        uid: "legacy-owner",
        role: "owner",
        displayName: "",
        email: "",
        photoURL: null,
      },
    ]);
  });

  test("ties within the same role break alphabetically by displayName then email", () => {
    const doc = baseDoc({
      members: {
        u1: { role: "editor", addedAt: new Date() },
        u2: { role: "editor", addedAt: new Date() },
      },
      memberIds: ["u1", "u2"],
    });
    const rows = buildMemberRows(doc, [
      user({ uid: "u1", displayName: "Zara" }),
      user({ uid: "u2", displayName: "Alex" }),
    ]);
    expect(rows.map((r) => r.uid)).toEqual(["u2", "u1"]);
  });

  test("missing user directory entries leave displayName/email blank but keep the row", () => {
    const doc = baseDoc({
      members: { ghost: { role: "viewer", addedAt: new Date() } },
      memberIds: ["ghost"],
    });
    const rows = buildMemberRows(doc, []);
    expect(rows).toEqual([
      { uid: "ghost", role: "viewer", displayName: "", email: "", photoURL: null },
    ]);
  });
});

describe("filterCandidates", () => {
  const u1 = user({ uid: "u1", displayName: "Alice", email: "alice@apparat.no" });
  const u2 = user({ uid: "u2", displayName: "Bob", email: "bob@tv2.no" });
  const u3 = user({ uid: "u3", displayName: null, email: "charlie@apparat.no" });

  test("excludes users already in the members list", () => {
    const result = filterCandidates(
      [u1, u2, u3],
      [{ uid: "u2", role: "editor", displayName: "Bob", email: "bob@tv2.no", photoURL: null }],
      "",
    );
    expect(result.map((u) => u.uid)).toEqual(["u1", "u3"]);
  });

  test("matches search query against displayName (case-insensitive)", () => {
    const result = filterCandidates([u1, u2], [], "ali");
    expect(result.map((u) => u.uid)).toEqual(["u1"]);
  });

  test("matches search query against email", () => {
    const result = filterCandidates([u1, u2], [], "tv2");
    expect(result.map((u) => u.uid)).toEqual(["u2"]);
  });

  test("matches against email when displayName is null", () => {
    const result = filterCandidates([u1, u3], [], "charlie");
    expect(result.map((u) => u.uid)).toEqual(["u3"]);
  });

  test("blank query returns everyone not already a member", () => {
    const result = filterCandidates([u1, u2, u3], [], "  ");
    expect(result.map((u) => u.uid).sort()).toEqual(["u1", "u2", "u3"]);
  });
});
