import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
  WorkspaceContent,
  WorkspaceDocument,
  WorkspaceService,
  WorkspaceSummary,
} from "../types";
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

function toDocument(data: DocumentData): WorkspaceDocument {
  return {
    ownerId: data.ownerId,
    name: data.name ?? "Untitled",
    projects: data.projects ?? [],
    people: data.people ?? [],
    teams: data.teams ?? [],
    updatedAt: timestampToDate(data.updatedAt),
  };
}

function toSummary(id: string, data: DocumentData): WorkspaceSummary {
  return {
    id,
    name: data.name ?? "Untitled",
    updatedAt: timestampToDate(data.updatedAt),
  };
}

function timestampToDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date();
}

export const firebaseWorkspaceService: WorkspaceService = {
  async listMine() {
    const uid = requireUserId();
    const snap = await getDocs(
      query(
        workspacesCollection(),
        where("ownerId", "==", uid),
        orderBy("updatedAt", "desc"),
      ),
    );
    return snap.docs.map((d) => toSummary(d.id, d.data()));
  },

  async create(name) {
    const uid = requireUserId();
    const ref = await addDoc(workspacesCollection(), {
      ownerId: uid,
      name,
      projects: [],
      people: [],
      teams: [],
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
};
