import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  addDoc,
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
  return {
    addDoc: vi.fn(),
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
    arrayUnion: vi.fn((...ids: string[]) => ({ kind: "arrayUnion", ids })),
    arrayRemove: vi.fn((...ids: string[]) => ({ kind: "arrayRemove", ids })),
    deleteField: vi.fn(() => ({ kind: "deleteField" })),
    onSnapshot: vi.fn(),
  };
});

vi.mock("firebase/firestore", () => ({
  addDoc,
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
  arrayUnion,
  arrayRemove,
  deleteField,
  onSnapshot,
}));

let currentUid: string | null = "current-uid";
vi.mock("./client", () => ({
  firestore: { name: "test-firestore" },
  firebaseAuth: {
    get currentUser() {
      return currentUid ? { uid: currentUid } : null;
    },
  },
}));

import { firebaseWorkspaceService } from "./workspaceService";

beforeEach(() => {
  addDoc.mockReset();
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
  currentUid = "current-uid";
});

describe("firebaseWorkspaceService.create", () => {
  test("seeds the creator as the sole owner in members + memberIds", async () => {
    addDoc.mockResolvedValueOnce({ id: "ws1" });

    const id = await firebaseWorkspaceService.create("My WS");

    expect(id).toBe("ws1");
    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.ownerId).toBe("current-uid");
    expect(payload.name).toBe("My WS");
    expect(payload.memberIds).toEqual(["current-uid"]);
    expect(payload.members["current-uid"].role).toBe("owner");
    expect(payload.members["current-uid"].addedAt).toBeInstanceOf(Timestamp);
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
              ownerId: "someone-else",
              members: { "current-uid": { role: "editor" } },
            }),
          },
          {
            id: "legacy",
            data: () => ({ name: "Legacy", updatedAt: ts1, ownerId: "current-uid" }),
          },
        ],
      }) // memberIds query
      .mockResolvedValueOnce({
        docs: [
          {
            id: "legacy",
            data: () => ({ name: "Legacy", updatedAt: ts1, ownerId: "current-uid" }),
          },
          {
            id: "owned",
            data: () => ({
              name: "Owned",
              updatedAt: ts3,
              ownerId: "current-uid",
              members: { "current-uid": { role: "owner" } },
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

  test("classifies a removed creator as viewer (members exists but uid not in it)", async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] }) // memberIds query — empty
      .mockResolvedValueOnce({
        docs: [
          {
            id: "ws1",
            data: () => ({
              name: "Old workspace",
              updatedAt: new Timestamp(1_700_000_000),
              ownerId: "current-uid",
              members: { "someone-else": { role: "owner" } },
            }),
          },
        ],
      });

    const result = await firebaseWorkspaceService.listMine();
    expect(result).toEqual([expect.objectContaining({ id: "ws1", role: "viewer" })]);
  });

  test("issues both queries with the current uid", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await firebaseWorkspaceService.listMine();
    expect(where).toHaveBeenCalledWith("memberIds", "array-contains", "current-uid");
    expect(where).toHaveBeenCalledWith("ownerId", "==", "current-uid");
  });

  test("throws when no user is signed in", async () => {
    currentUid = null;
    await expect(firebaseWorkspaceService.listMine()).rejects.toThrow(/no signed-in user/);
  });
});

describe("firebaseWorkspaceService.addMember", () => {
  test("when members already populated, adds via dotted path + arrayUnion", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        ownerId: "owner-uid",
        members: { "owner-uid": { role: "owner", addedAt: new Timestamp(1) } },
        memberIds: ["owner-uid"],
      }),
    });
    updateDoc.mockResolvedValueOnce(undefined);

    await firebaseWorkspaceService.addMember("ws1", "new-uid", "editor");

    const payload = updateDoc.mock.calls[0][1];
    expect(payload["members.new-uid"]).toEqual({
      role: "editor",
      addedAt: expect.any(Timestamp),
    });
    expect(payload.memberIds).toEqual({ kind: "arrayUnion", ids: ["new-uid"] });
    expect(payload.updatedAt).toBe("SERVER_TS");
    // Should NOT touch the existing members map
    expect(payload.members).toBeUndefined();
  });

  test("on a legacy doc, seeds members with the legacy owner + new member", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerId: "legacy-owner", name: "Old WS" }),
    });
    updateDoc.mockResolvedValueOnce(undefined);

    await firebaseWorkspaceService.addMember("ws1", "new-uid", "viewer");

    const payload = updateDoc.mock.calls[0][1];
    expect(payload.members["legacy-owner"].role).toBe("owner");
    expect(payload.members["new-uid"].role).toBe("viewer");
    expect(payload.memberIds).toEqual(["legacy-owner", "new-uid"]);
    expect(payload.updatedAt).toBe("SERVER_TS");
  });

  test("on a doc with empty members object, also seeds (treats empty as legacy)", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerId: "legacy-owner", members: {}, memberIds: [] }),
    });
    updateDoc.mockResolvedValueOnce(undefined);

    await firebaseWorkspaceService.addMember("ws1", "new-uid", "editor");

    const payload = updateDoc.mock.calls[0][1];
    expect(payload.memberIds).toEqual(["legacy-owner", "new-uid"]);
  });

  test("throws if the workspace doc does not exist", async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    await expect(firebaseWorkspaceService.addMember("ws1", "new", "viewer")).rejects.toThrow(
      /not found/,
    );
  });
});

describe("firebaseWorkspaceService.updateMemberRole", () => {
  test("uses a dotted path so other member fields are untouched", async () => {
    updateDoc.mockResolvedValueOnce(undefined);
    await firebaseWorkspaceService.updateMemberRole("ws1", "u1", "editor");
    const payload = updateDoc.mock.calls[0][1];
    expect(payload["members.u1.role"]).toBe("editor");
    expect(payload.updatedAt).toBe("SERVER_TS");
  });
});

describe("firebaseWorkspaceService.removeMember", () => {
  test("deletes the member entry and pulls the uid from memberIds", async () => {
    updateDoc.mockResolvedValueOnce(undefined);
    await firebaseWorkspaceService.removeMember("ws1", "u1");
    const payload = updateDoc.mock.calls[0][1];
    expect(payload["members.u1"]).toEqual({ kind: "deleteField" });
    expect(payload.memberIds).toEqual({ kind: "arrayRemove", ids: ["u1"] });
    expect(payload.updatedAt).toBe("SERVER_TS");
  });
});
