import { beforeEach, describe, expect, test, vi } from "vitest";

const { setDoc, getDoc, doc, getDocs, collection, serverTimestamp, query, orderBy, Timestamp } =
  vi.hoisted(() => {
    class FakeTimestamp {
      constructor(public seconds: number) {}
      toDate() {
        return new Date(this.seconds * 1000);
      }
    }
    return {
      setDoc: vi.fn(),
      getDoc: vi.fn(),
      doc: vi.fn((db: unknown, col: string, id: string) => ({ db, col, id })),
      getDocs: vi.fn(),
      collection: vi.fn((db: unknown, col: string) => ({ db, col })),
      serverTimestamp: vi.fn(() => "SERVER_TS"),
      query: vi.fn((...args: unknown[]) => ({ kind: "query", args })),
      orderBy: vi.fn((...args: unknown[]) => ({ kind: "orderBy", args })),
      Timestamp: FakeTimestamp,
    };
  });

vi.mock("firebase/firestore", () => ({
  setDoc,
  getDoc,
  doc,
  getDocs,
  collection,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
}));

vi.mock("./client", () => ({
  firestore: { name: "test-firestore" },
  firebaseAuth: {},
}));

import { firebaseUserService } from "./userService";

beforeEach(() => {
  setDoc.mockReset();
  getDoc.mockReset();
  getDocs.mockReset();
  doc.mockClear();
  collection.mockClear();
  serverTimestamp.mockClear();
});

describe("firebaseUserService.upsertOnSignIn", () => {
  test("writes the user profile to users/{email} with a server timestamp", async () => {
    setDoc.mockResolvedValueOnce(undefined);

    await firebaseUserService.upsertOnSignIn({
      uid: "firebase-uid-u1",
      email: "alice@apparat.no",
      displayName: "Alice",
      photoURL: "https://example.com/a.png",
    });

    expect(doc).toHaveBeenCalledWith(expect.anything(), "users", "alice@apparat.no");
    expect(setDoc).toHaveBeenCalledWith(
      { db: { name: "test-firestore" }, col: "users", id: "alice@apparat.no" },
      {
        email: "alice@apparat.no",
        displayName: "Alice",
        photoURL: "https://example.com/a.png",
        firebaseUid: "firebase-uid-u1",
        updatedAt: "SERVER_TS",
      },
    );
  });

  test("preserves null displayName and photoURL when the auth user has none", async () => {
    setDoc.mockResolvedValueOnce(undefined);

    await firebaseUserService.upsertOnSignIn({
      uid: "firebase-uid-u2",
      email: "b@tv2.no",
      displayName: null,
      photoURL: null,
    });

    expect(setDoc).toHaveBeenCalledWith(expect.anything(), {
      email: "b@tv2.no",
      displayName: null,
      photoURL: null,
      firebaseUid: "firebase-uid-u2",
      updatedAt: "SERVER_TS",
    });
  });

  test("throws when the auth user has no email", async () => {
    await expect(
      firebaseUserService.upsertOnSignIn({
        uid: "firebase-uid-u3",
        email: null,
        displayName: "X",
        photoURL: null,
      }),
    ).rejects.toThrow(/email/i);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe("firebaseUserService.listAll", () => {
  test("returns all users with document ID as uid and timestamps converted to Date", async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: "alice@apparat.no",
          data: () => ({
            email: "alice@apparat.no",
            displayName: "Alice",
            photoURL: null,
            firebaseUid: "firebase-uid-u1",
            updatedAt: new Timestamp(1_700_000_000),
          }),
        },
        {
          id: "bob@tv2.no",
          data: () => ({
            email: "bob@tv2.no",
            displayName: "Bob",
            photoURL: "https://example.com/b.png",
            firebaseUid: "firebase-uid-u2",
            updatedAt: new Timestamp(1_700_000_500),
          }),
        },
      ],
    });

    const users = await firebaseUserService.listAll();

    expect(collection).toHaveBeenCalledWith(expect.anything(), "users");
    expect(users).toHaveLength(2);
    expect(users[0]).toEqual({
      uid: "alice@apparat.no",
      email: "alice@apparat.no",
      displayName: "Alice",
      photoURL: null,
      updatedAt: new Date(1_700_000_000_000),
    });
    expect(users[1].uid).toBe("bob@tv2.no");
    expect(users[1].updatedAt).toEqual(new Date(1_700_000_500_000));
  });

  test("falls back to current time if updatedAt is missing", async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: "alice@apparat.no",
          data: () => ({
            email: "alice@apparat.no",
            displayName: "Alice",
            photoURL: null,
          }),
        },
      ],
    });

    const before = Date.now();
    const users = await firebaseUserService.listAll();
    const after = Date.now();

    expect(users[0].updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(users[0].updatedAt.getTime()).toBeLessThanOrEqual(after);
  });
});
