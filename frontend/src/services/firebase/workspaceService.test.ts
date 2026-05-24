import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  addDoc,
  setDoc,
  getDoc,
  doc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp,
  FieldPath,
  arrayUnion,
  arrayRemove,
  deleteField,
  onSnapshot,
} = vi.hoisted(() => {
  class FakeTimestamp {
    constructor(public seconds: number) {}
    toDate() {
      return new Date(this.seconds * 1000);
    }
    static now() {
      return new FakeTimestamp(1_700_000_000);
    }
  }
  class FakeFieldPath {
    segments: string[];
    constructor(...segments: string[]) {
      this.segments = segments;
    }
  }
  return {
    addDoc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    doc: vi.fn((db: unknown, col: string, id: string) => ({ db, col, id })),
    getDocs: vi.fn(),
    collection: vi.fn((db: unknown, col: string) => ({ db, col })),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(() => "SERVER_TS"),
    query: vi.fn((...args: unknown[]) => ({ kind: "query", args })),
    where: vi.fn((field: string, op: string, value: unknown) => ({
      kind: "where",
      field,
      op,
      value,
    })),
    orderBy: vi.fn((field: string, dir: string) => ({ kind: "orderBy", field, dir })),
    Timestamp: FakeTimestamp,
    FieldPath: FakeFieldPath,
    arrayUnion: vi.fn((...ids: string[]) => ({ kind: "arrayUnion", ids })),
    arrayRemove: vi.fn((...ids: string[]) => ({ kind: "arrayRemove", ids })),
    deleteField: vi.fn(() => ({ kind: "deleteField" })),
    onSnapshot: vi.fn(),
  };
});

vi.mock("firebase/firestore", () => ({
  addDoc,
  setDoc,
  getDoc,
  doc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp,
  FieldPath,
  arrayUnion,
  arrayRemove,
  deleteField,
  onSnapshot,
}));

let currentEmail: string | null = "current@apparat.no";
vi.mock("./client", () => ({
  firestore: { name: "test-firestore" },
  firebaseAuth: {
    get currentUser() {
      return currentEmail ? { uid: "current-firebase-uid", email: currentEmail } : null;
    },
  },
}));

import { firebaseWorkspaceService } from "./workspaceService";

beforeEach(() => {
  addDoc.mockReset();
  setDoc.mockReset();
  getDoc.mockReset();
  getDocs.mockReset();
  updateDoc.mockReset();
  deleteDoc.mockReset();
  doc.mockClear();
  collection.mockClear();
  serverTimestamp.mockClear();
  arrayUnion.mockClear();
  arrayRemove.mockClear();
  deleteField.mockClear();
  currentEmail = "current@apparat.no";
});

describe("firebaseWorkspaceService.create", () => {
  test("seeds the creator's email as the sole owner in members + memberIds", async () => {
    addDoc.mockResolvedValueOnce({ id: "ws1" });

    const id = await firebaseWorkspaceService.create("My WS");

    expect(id).toBe("ws1");
    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.ownerId).toBe("current@apparat.no");
    expect(payload.name).toBe("My WS");
    expect(payload.memberIds).toEqual(["current@apparat.no"]);
    expect(payload.members["current@apparat.no"].role).toBe("owner");
    expect(payload.members["current@apparat.no"].addedAt).toBeInstanceOf(Timestamp);
  });

  test("does not write stale projects/people/teams array fields on the workspace doc", async () => {
    addDoc.mockResolvedValueOnce({ id: "ws1" });

    await firebaseWorkspaceService.create("My WS");

    const payload = addDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty("projects");
    expect(payload).not.toHaveProperty("people");
    expect(payload).not.toHaveProperty("teams");
  });

  test("creates a default project in the projects subcollection", async () => {
    addDoc.mockResolvedValueOnce({ id: "ws1" });

    await firebaseWorkspaceService.create("My WS");

    expect(setDoc).toHaveBeenCalledTimes(1);
    const projectPayload = setDoc.mock.calls[0][1];
    expect(projectPayload.name).toBe("New Project");
    expect(projectPayload.theme).toBe("dark");
    expect(projectPayload.taskQueues).toEqual([]);
    expect(projectPayload.connections).toEqual([]);
    expect(typeof projectPayload.id).toBe("string");
    expect(projectPayload.id).toHaveLength(36); // UUID format
  });
});

describe("firebaseWorkspaceService.listMine", () => {
  test("merges memberIds query with legacy ownerId query and dedupes by id", async () => {
    const ts1 = new Timestamp(1_700_000_100);
    const ts2 = new Timestamp(1_700_000_200);
    const ts3 = new Timestamp(1_700_000_300);
    getDocs
      .mockResolvedValueOnce({
        docs: [
          {
            id: "shared",
            data: () => ({
              name: "Shared",
              updatedAt: ts2,
              ownerId: "someone-else@tv2.no",
              members: { "current@apparat.no": { role: "editor" } },
            }),
          },
          {
            id: "legacy",
            data: () => ({ name: "Legacy", updatedAt: ts1, ownerId: "current@apparat.no" }),
          },
        ],
      }) // memberIds query
      .mockResolvedValueOnce({
        docs: [
          {
            id: "legacy",
            data: () => ({ name: "Legacy", updatedAt: ts1, ownerId: "current@apparat.no" }),
          },
          {
            id: "owned",
            data: () => ({
              name: "Owned",
              updatedAt: ts3,
              ownerId: "current@apparat.no",
              members: { "current@apparat.no": { role: "owner" } },
            }),
          },
        ],
      }); // legacy ownerId query

    const result = await firebaseWorkspaceService.listMine();

    expect(result).toHaveLength(3);
    // Sorted by updatedAt desc: owned (ts3) > shared (ts2) > legacy (ts1)
    expect(result.map((r) => r.id)).toEqual(["owned", "shared", "legacy"]);
    expect(result.map((r) => r.role)).toEqual(["owner", "editor", "owner"]);
  });

  test("classifies a removed creator as viewer (members exists but email not in it)", async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] }) // memberIds query — empty
      .mockResolvedValueOnce({
        docs: [
          {
            id: "ws1",
            data: () => ({
              name: "Old workspace",
              updatedAt: new Timestamp(1_700_000_000),
              ownerId: "current@apparat.no",
              members: { "someone-else@tv2.no": { role: "owner" } },
            }),
          },
        ],
      });

    const result = await firebaseWorkspaceService.listMine();
    expect(result).toEqual([expect.objectContaining({ id: "ws1", role: "viewer" })]);
  });

  test("issues both queries with the current user's email", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await firebaseWorkspaceService.listMine();
    expect(where).toHaveBeenCalledWith("memberIds", "array-contains", "current@apparat.no");
    expect(where).toHaveBeenCalledWith("ownerId", "==", "current@apparat.no");
  });

  test("throws when no user is signed in", async () => {
    currentEmail = null;
    await expect(firebaseWorkspaceService.listMine()).rejects.toThrow(/no signed-in user/);
  });
});

describe("firebaseWorkspaceService.addMember", () => {
  test("when members already populated, adds via FieldPath so email dots are not misread as path separators", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        ownerId: "owner@apparat.no",
        members: { "owner@apparat.no": { role: "owner", addedAt: new Timestamp(1) } },
        memberIds: ["owner@apparat.no"],
      }),
    });
    updateDoc.mockResolvedValueOnce(undefined);

    await firebaseWorkspaceService.addMember("ws1", "new@tv2.no", "editor");

    // updateDoc must be called with FieldPath varargs, not a dotted-string object key,
    // because "new@tv2.no" contains a dot that Firestore would otherwise split into nested paths.
    const args = updateDoc.mock.calls[0];
    const [, memberPath, memberEntry, memberIdsKey, memberIdsVal, updatedAtKey, updatedAtVal] = args;
    expect(memberPath).toBeInstanceOf(FieldPath);
    expect((memberPath as InstanceType<typeof FieldPath>).segments).toEqual(["members", "new@tv2.no"]);
    expect(memberEntry).toEqual({ role: "editor", addedAt: expect.any(Timestamp) });
    expect(memberIdsKey).toBe("memberIds");
    expect(memberIdsVal).toEqual({ kind: "arrayUnion", ids: ["new@tv2.no"] });
    expect(updatedAtKey).toBe("updatedAt");
    expect(updatedAtVal).toBe("SERVER_TS");
  });

  test("on a legacy doc, seeds members with the legacy owner + new member", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerId: "legacy@apparat.no", name: "Old WS" }),
    });
    updateDoc.mockResolvedValueOnce(undefined);

    await firebaseWorkspaceService.addMember("ws1", "new@tv2.no", "viewer");

    const payload = updateDoc.mock.calls[0][1];
    expect(payload.members["legacy@apparat.no"].role).toBe("owner");
    expect(payload.members["new@tv2.no"].role).toBe("viewer");
    expect(payload.memberIds).toEqual(["legacy@apparat.no", "new@tv2.no"]);
    expect(payload.updatedAt).toBe("SERVER_TS");
  });

  test("on a doc with empty members object, also seeds (treats empty as legacy)", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerId: "legacy@apparat.no", members: {}, memberIds: [] }),
    });
    updateDoc.mockResolvedValueOnce(undefined);

    await firebaseWorkspaceService.addMember("ws1", "new@tv2.no", "editor");

    const payload = updateDoc.mock.calls[0][1];
    expect(payload.memberIds).toEqual(["legacy@apparat.no", "new@tv2.no"]);
  });

  test("throws if the workspace doc does not exist", async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    await expect(firebaseWorkspaceService.addMember("ws1", "new@tv2.no", "viewer")).rejects.toThrow(
      /not found/,
    );
  });
});

describe("firebaseWorkspaceService.updateMemberRole", () => {
  test("uses FieldPath so email dots are not misread as Firestore path separators", async () => {
    updateDoc.mockResolvedValueOnce(undefined);
    await firebaseWorkspaceService.updateMemberRole("ws1", "user@tv2.no", "editor");
    // updateDoc must be called with FieldPath varargs so "user@tv2.no" stays as a single key
    // rather than being split into ["user@tv2", "no"] by Firestore's dotted-path parser.
    const args = updateDoc.mock.calls[0];
    const [, rolePath, roleValue, updatedAtKey, updatedAtVal] = args;
    expect(rolePath).toBeInstanceOf(FieldPath);
    expect((rolePath as InstanceType<typeof FieldPath>).segments).toEqual(["members", "user@tv2.no", "role"]);
    expect(roleValue).toBe("editor");
    expect(updatedAtKey).toBe("updatedAt");
    expect(updatedAtVal).toBe("SERVER_TS");
  });
});

describe("firebaseWorkspaceService.removeMember", () => {
  test("uses FieldPath so email dots are not misread as Firestore path separators", async () => {
    updateDoc.mockResolvedValueOnce(undefined);
    await firebaseWorkspaceService.removeMember("ws1", "user@tv2.no");
    // FieldPath ensures "user@tv2.no" is treated as a single key, not split on "."
    const args = updateDoc.mock.calls[0];
    const [, memberPath, memberVal, memberIdsKey, memberIdsVal, updatedAtKey, updatedAtVal] = args;
    expect(memberPath).toBeInstanceOf(FieldPath);
    expect((memberPath as InstanceType<typeof FieldPath>).segments).toEqual(["members", "user@tv2.no"]);
    expect(memberVal).toEqual({ kind: "deleteField" });
    expect(memberIdsKey).toBe("memberIds");
    expect(memberIdsVal).toEqual({ kind: "arrayRemove", ids: ["user@tv2.no"] });
    expect(updatedAtKey).toBe("updatedAt");
    expect(updatedAtVal).toBe("SERVER_TS");
  });
});
