import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import type {
  Role,
  WorkspaceDocument,
  WorkspaceMember,
  WorkspaceService,
  WorkspaceSummary,
} from "../workspace.types";
import { firebaseAuth, firestore } from "./client";

const WORKSPACES_COLLECTION = "workspaces";

function requireUserId(): string {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) throw new Error("no signed-in user");
  return uid;
}

function workspacesCollection() {
  return collection(firestore, WORKSPACES_COLLECTION);
}

function workspaceDoc(id: string) {
  return doc(firestore, WORKSPACES_COLLECTION, id);
}

function timestampToDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date();
}

function toMembers(raw: unknown): Record<string, WorkspaceMember> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, WorkspaceMember> = {};
  for (const [uid, value] of Object.entries(raw as Record<string, DocumentData>)) {
    out[uid] = {
      role: (value.role ?? "viewer") as Role,
      addedAt: timestampToDate(value.addedAt),
    };
  }
  return out;
}

function toDocument(data: DocumentData): WorkspaceDocument {
  return {
    ownerId: data.ownerId,
    name: data.name ?? "Untitled",
    projects: data.projects ?? [],
    people: data.people ?? [],
    teams: data.teams ?? [],
    updatedAt: timestampToDate(data.updatedAt),
    members: toMembers(data.members),
    memberIds: Array.isArray(data.memberIds) ? [...data.memberIds] : undefined,
  };
}

function toSummary(id: string, data: DocumentData, uid: string): WorkspaceSummary {
  return {
    id,
    name: data.name ?? "Untitled",
    updatedAt: timestampToDate(data.updatedAt),
    role: roleForListEntry(data, uid),
  };
}

/**
 * Determine the role to display in the workspace picker. Mirrors
 * domain/workspace/roles.ts#resolveRole but never returns null — listMine
 * only includes workspaces the user can read, so a "no access" outcome
 * shouldn't be possible. The two unusual paths:
 *  - Legacy workspace (no members, ownerId match) → "owner".
 *  - User was removed from members but is still the original creator →
 *    "viewer" (matches the read-only access the rules grant them).
 */
function roleForListEntry(data: DocumentData, uid: string): Role {
  const members = data.members;
  const memberRole = members?.[uid]?.role;
  if (memberRole === "owner" || memberRole === "editor" || memberRole === "viewer") {
    return memberRole;
  }
  if (data.ownerId === uid && (!members || Object.keys(members).length === 0)) {
    return "owner";
  }
  return "viewer";
}

function dedupeSummariesById(summaries: WorkspaceSummary[]): WorkspaceSummary[] {
  const seen = new Map<string, WorkspaceSummary>();
  for (const s of summaries) {
    if (!seen.has(s.id)) seen.set(s.id, s);
  }
  return Array.from(seen.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export const firebaseWorkspaceService: WorkspaceService = {
  async listMine() {
    const uid = requireUserId();
    const memberSnap = await getDocs(
      query(
        workspacesCollection(),
        where("memberIds", "array-contains", uid),
        orderBy("updatedAt", "desc"),
      ),
    );
    // Backstop for legacy workspaces that pre-date the members map. If the
    // user once created a workspace and was later removed from its members,
    // the rules will deny this query — log and continue with member results.
    let legacyDocs: WorkspaceSummary[] = [];
    try {
      const legacySnap = await getDocs(
        query(workspacesCollection(), where("ownerId", "==", uid), orderBy("updatedAt", "desc")),
      );
      legacyDocs = legacySnap.docs.map((d) => toSummary(d.id, d.data(), uid));
    } catch (err) {
      console.warn("[workspaces] legacy ownerId query failed:", err);
    }
    return dedupeSummariesById([
      ...memberSnap.docs.map((d) => toSummary(d.id, d.data(), uid)),
      ...legacyDocs,
    ]);
  },

  async create(name) {
    const uid = requireUserId();
    const ref = await addDoc(workspacesCollection(), {
      ownerId: uid,
      name,
      projects: [],
      people: [],
      teams: [],
      members: { [uid]: { role: "owner", addedAt: Timestamp.now() } },
      memberIds: [uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  subscribe(id, callback) {
    return onSnapshot(workspaceDoc(id), (snap) => {
      callback(snap.exists() ? toDocument(snap.data()) : null);
    });
  },

  async saveContent(id, content) {
    await updateDoc(workspaceDoc(id), {
      projects: content.projects,
      people: content.people,
      teams: content.teams,
      updatedAt: serverTimestamp(),
    });
  },

  async rename(id, name) {
    await updateDoc(workspaceDoc(id), {
      name,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(id) {
    await deleteDoc(workspaceDoc(id));
  },

  async addMember(id, uid, role) {
    const snap = await getDoc(workspaceDoc(id));
    if (!snap.exists()) throw new Error(`workspace ${id} not found`);
    const data = snap.data();
    const hasMembers =
      data.members && typeof data.members === "object" && Object.keys(data.members).length > 0;
    const newEntry = { role, addedAt: Timestamp.now() };
    if (hasMembers) {
      await updateDoc(workspaceDoc(id), {
        [`members.${uid}`]: newEntry,
        memberIds: arrayUnion(uid),
        updatedAt: serverTimestamp(),
      });
      return;
    }
    // Lazy upgrade: legacy doc with only `ownerId`. Seed members with the
    // existing owner plus the new member.
    const ownerId = data.ownerId as string;
    await updateDoc(workspaceDoc(id), {
      members: {
        [ownerId]: { role: "owner", addedAt: Timestamp.now() },
        [uid]: newEntry,
      },
      memberIds: [ownerId, uid],
      updatedAt: serverTimestamp(),
    });
  },

  async updateMemberRole(id, uid, role) {
    await updateDoc(workspaceDoc(id), {
      [`members.${uid}.role`]: role,
      updatedAt: serverTimestamp(),
    });
  },

  async removeMember(id, uid) {
    await updateDoc(workspaceDoc(id), {
      [`members.${uid}`]: deleteField(),
      memberIds: arrayRemove(uid),
      updatedAt: serverTimestamp(),
    });
  },
};
