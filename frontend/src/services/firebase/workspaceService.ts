import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import type {
  ProjectDocument,
  ProjectSummary,
  Role,
  WorkspaceDocument,
  WorkspaceMember,
  WorkspaceService,
  WorkspaceSummary,
} from "../workspace.types";
import { resolveCategoryKey } from "../../domain/tasks/categoryConfig";
import type { Task, Group } from "../../domain/tasks/types";
import type { Person, Team } from "../../domain/teams/types";
import { firebaseAuth, firestore } from "./client";

// ── Collection / document path helpers ────────────────────────────────────────

const WORKSPACES = "workspaces";

function workspacesCol() {
  return collection(firestore, WORKSPACES);
}
function workspaceDoc(id: string) {
  return doc(firestore, WORKSPACES, id);
}
function projectsCol(workspaceId: string) {
  return collection(firestore, WORKSPACES, workspaceId, "projects");
}
function projectDoc(workspaceId: string, projectId: string) {
  return doc(firestore, WORKSPACES, workspaceId, "projects", projectId);
}
function tasksCol(workspaceId: string, projectId: string) {
  return collection(firestore, WORKSPACES, workspaceId, "projects", projectId, "tasks");
}
function taskDoc(workspaceId: string, projectId: string, taskId: string) {
  return doc(firestore, WORKSPACES, workspaceId, "projects", projectId, "tasks", taskId);
}
function groupsCol(workspaceId: string, projectId: string) {
  return collection(firestore, WORKSPACES, workspaceId, "projects", projectId, "groups");
}
function groupDoc(workspaceId: string, projectId: string, groupId: string) {
  return doc(firestore, WORKSPACES, workspaceId, "projects", projectId, "groups", groupId);
}
function peopleCol(workspaceId: string) {
  return collection(firestore, WORKSPACES, workspaceId, "people");
}
function personDoc(workspaceId: string, personId: string) {
  return doc(firestore, WORKSPACES, workspaceId, "people", personId);
}
function teamsCol(workspaceId: string) {
  return collection(firestore, WORKSPACES, workspaceId, "teams");
}
function teamDoc(workspaceId: string, teamId: string) {
  return doc(firestore, WORKSPACES, workspaceId, "teams", teamId);
}

// ── Firestore → domain type converters ───────────────────────────────────────

function requireUserEmail(): string {
  const email = firebaseAuth.currentUser?.email;
  if (!email) throw new Error("no signed-in user");
  return email;
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

function toWorkspaceDocument(data: DocumentData): WorkspaceDocument {
  return {
    ownerId: data.ownerId,
    name: data.name ?? "Untitled",
    updatedAt: timestampToDate(data.updatedAt),
    members: toMembers(data.members),
    memberIds: Array.isArray(data.memberIds) ? [...data.memberIds] : undefined,
  };
}

function toSummary(id: string, data: DocumentData, email: string): WorkspaceSummary {
  return {
    id,
    name: data.name ?? "Untitled",
    updatedAt: timestampToDate(data.updatedAt),
    role: roleForListEntry(data, email),
    ownerEmail: (data.ownerId as string) ?? "",
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
function roleForListEntry(data: DocumentData, email: string): Role {
  const members = data.members;
  const memberRole = members?.[email]?.role;
  if (memberRole === "owner" || memberRole === "editor" || memberRole === "viewer") {
    return memberRole;
  }
  if (data.ownerId === email && (!members || Object.keys(members).length === 0)) {
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

function toProjectDocument(data: DocumentData): ProjectDocument {
  return {
    id: data.id ?? "",
    name: data.name ?? "Untitled",
    theme: data.theme ?? "dark",
    taskQueues: Array.isArray(data.taskQueues) ? data.taskQueues : [],
    connections: Array.isArray(data.connections) ? data.connections : [],
  };
}

function toTask(data: DocumentData): Task {
  // Omit optional fields entirely when absent. Firestore's SDK rejects writes
  // that contain explicit `undefined` values, so any task that round-trips
  // through a full-document `set` (batched undo/redo sync) must not carry one.
  const task: Task = {
    id: data.id,
    text: data.text ?? "",
    x: data.x ?? 0,
    y: data.y ?? 0,
    status: data.status ?? "pending",
  };
  if (data.category != null && data.category !== "") {
    // Translate legacy category keys (e.g. "integration" → "milestone") so tasks
    // written before a rename still resolve to a current category. This is the
    // single choke point for all Firestore reads; it covers every task until the
    // one-time data migration rewrites the stored keys.
    task.category = resolveCategoryKey(data.category);
  }
  if (Array.isArray(data.assignedPersonIds)) {
    task.assignedPersonIds = data.assignedPersonIds;
  }
  if (Array.isArray(data.inProgressIntervals)) {
    const validStatuses = ["pending", "in_progress", "blocked", "completed", "archived"];
    const intervals: NonNullable<Task["inProgressIntervals"]> = [];
    for (const iv of data.inProgressIntervals) {
      if (!iv || typeof iv.start !== "number") continue;
      const interval: NonNullable<Task["inProgressIntervals"]>[number] = {
        start: iv.start,
        end: typeof iv.end === "number" ? iv.end : null,
      };
      if (typeof iv.endStatus === "string" && validStatuses.includes(iv.endStatus)) {
        interval.endStatus = iv.endStatus as Task["status"];
      }
      intervals.push(interval);
    }
    if (intervals.length > 0) task.inProgressIntervals = intervals;
  }
  if (data.assignedAt != null && typeof data.assignedAt === "object") {
    const assignedAt: Record<string, number> = {};
    for (const [personId, value] of Object.entries(data.assignedAt)) {
      if (typeof value === "number") assignedAt[personId] = value;
    }
    if (Object.keys(assignedAt).length > 0) task.assignedAt = assignedAt;
  }
  return task;
}

function toGroup(data: DocumentData): Group {
  return {
    id: data.id,
    title: data.title ?? "",
    x: data.x ?? 0,
    y: data.y ?? 0,
    width: data.width ?? 200,
    height: data.height ?? 150,
    locked: data.locked ?? false,
  };
}

function toPerson(data: DocumentData): Person {
  return {
    id: data.id,
    name: data.name ?? "",
    picture: data.picture ?? null,
  };
}

function toTeam(data: DocumentData): Team {
  return {
    id: data.id,
    name: data.name ?? "",
    memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
  };
}

// ── Service implementation ────────────────────────────────────────────────────

export const firebaseWorkspaceService: WorkspaceService = {
  // ── Workspace management ─────────────────────────────────────────────────

  async listMine() {
    const email = requireUserEmail();
    const memberSnap = await getDocs(
      query(
        workspacesCol(),
        where("memberIds", "array-contains", email),
        orderBy("updatedAt", "desc"),
      ),
    );
    let legacyDocs: WorkspaceSummary[] = [];
    try {
      const legacySnap = await getDocs(
        query(workspacesCol(), where("ownerId", "==", email), orderBy("updatedAt", "desc")),
      );
      legacyDocs = legacySnap.docs.map((d) => toSummary(d.id, d.data(), email));
    } catch (err) {
      console.warn("[workspaces] legacy ownerId query failed:", err);
    }
    return dedupeSummariesById([
      ...memberSnap.docs.map((d) => toSummary(d.id, d.data(), email)),
      ...legacyDocs,
    ]);
  },

  async create(name) {
    const email = requireUserEmail();
    const ref = await addDoc(workspacesCol(), {
      ownerId: email,
      name,
      members: { [email]: { role: "owner", addedAt: Timestamp.now() } },
      memberIds: [email],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const defaultProjectId = crypto.randomUUID();
    await setDoc(projectDoc(ref.id, defaultProjectId), {
      id: defaultProjectId,
      name: "New Project",
      theme: "dark",
      taskQueues: [],
      connections: [],
    });
    return ref.id;
  },

  subscribe(id, callback) {
    return onSnapshot(workspaceDoc(id), (snap) => {
      callback(snap.exists() ? toWorkspaceDocument(snap.data()) : null);
    });
  },

  subscribeMine(callback) {
    const email = requireUserEmail();
    let memberResults: WorkspaceSummary[] = [];
    let legacyResults: WorkspaceSummary[] = [];

    const fire = () => {
      callback(dedupeSummariesById([...memberResults, ...legacyResults]));
    };

    const unsubMember = onSnapshot(
      query(
        workspacesCol(),
        where("memberIds", "array-contains", email),
        orderBy("updatedAt", "desc"),
      ),
      (snap) => {
        memberResults = snap.docs.map((d) => toSummary(d.id, d.data(), email));
        fire();
      },
      (err) => console.error("[workspaces] subscribeMine member query error:", err),
    );

    let unsubLegacy: (() => void) | undefined;
    try {
      unsubLegacy = onSnapshot(
        query(workspacesCol(), where("ownerId", "==", email), orderBy("updatedAt", "desc")),
        (snap) => {
          legacyResults = snap.docs.map((d) => toSummary(d.id, d.data(), email));
          fire();
        },
        (err) => console.warn("[workspaces] subscribeMine legacy query error:", err),
      );
    } catch (err) {
      console.warn("[workspaces] subscribeMine legacy query setup failed:", err);
    }

    return () => {
      unsubMember();
      unsubLegacy?.();
    };
  },

  async rename(id, name) {
    await updateDoc(workspaceDoc(id), { name, updatedAt: serverTimestamp() });
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
      await updateDoc(
        workspaceDoc(id),
        new FieldPath("members", uid),
        newEntry,
        "memberIds",
        arrayUnion(uid),
        "updatedAt",
        serverTimestamp(),
      );
      return;
    }
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
    await updateDoc(
      workspaceDoc(id),
      new FieldPath("members", uid, "role"),
      role,
      "updatedAt",
      serverTimestamp(),
    );
  },

  async removeMember(id, uid) {
    await updateDoc(
      workspaceDoc(id),
      new FieldPath("members", uid),
      deleteField(),
      "memberIds",
      arrayRemove(uid),
      "updatedAt",
      serverTimestamp(),
    );
  },

  // ── Subscriptions ────────────────────────────────────────────────────────

  subscribeProjects(id, callback) {
    return onSnapshot(projectsCol(id), (snap) => {
      const summaries: ProjectSummary[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name ?? "Untitled",
      }));
      callback(summaries);
    });
  },

  subscribeProjectContent(id, projectId, callback) {
    let projectDocData: ProjectDocument | null = null;
    let tasks: Task[] | null = null;
    let groups: Group[] | null = null;

    const fire = () => {
      if (!projectDocData || tasks === null || groups === null) return;
      callback({ projectDoc: projectDocData, tasks, groups });
    };

    const unsubProject = onSnapshot(projectDoc(id, projectId), (snap) => {
      projectDocData = snap.exists() ? toProjectDocument({ ...snap.data(), id: snap.id }) : null;
      fire();
    });

    const unsubTasks = onSnapshot(tasksCol(id, projectId), (snap) => {
      tasks = snap.docs.map((d) => toTask(d.data()));
      fire();
    });

    const unsubGroups = onSnapshot(groupsCol(id, projectId), (snap) => {
      groups = snap.docs.map((d) => toGroup(d.data()));
      fire();
    });

    return () => {
      unsubProject();
      unsubTasks();
      unsubGroups();
    };
  },

  subscribePeople(id, callback) {
    return onSnapshot(peopleCol(id), (snap) => {
      callback(snap.docs.map((d) => toPerson(d.data())));
    });
  },

  subscribeTeams(id, callback) {
    return onSnapshot(teamsCol(id), (snap) => {
      callback(snap.docs.map((d) => toTeam(d.data())));
    });
  },

  // ── Project writes ───────────────────────────────────────────────────────

  async addProject(id, project) {
    await setDoc(projectDoc(id, project.id), {
      id: project.id,
      name: project.name,
      theme: project.theme,
      taskQueues: project.taskQueues,
      connections: project.connections,
    });
  },

  async updateProjectMeta(id, projectId, changes) {
    await updateDoc(projectDoc(id, projectId), changes);
  },

  async deleteProject(id, projectId) {
    // Delete all tasks and groups in subcollections before deleting the project doc.
    const batch = writeBatch(firestore);
    const [taskSnap, groupSnap] = await Promise.all([
      getDocs(tasksCol(id, projectId)),
      getDocs(groupsCol(id, projectId)),
    ]);
    for (const d of taskSnap.docs) batch.delete(d.ref);
    for (const d of groupSnap.docs) batch.delete(d.ref);
    batch.delete(projectDoc(id, projectId));
    await batch.commit();
  },

  // ── Task writes ──────────────────────────────────────────────────────────

  async addTask(id, projectId, task) {
    await setDoc(taskDoc(id, projectId, task.id), task);
  },

  async updateTask(id, projectId, taskId, changes) {
    await updateDoc(taskDoc(id, projectId, taskId), changes);
  },

  async deleteTask(id, projectId, taskId, newConnections) {
    const batch = writeBatch(firestore);
    batch.delete(taskDoc(id, projectId, taskId));
    batch.update(projectDoc(id, projectId), { connections: newConnections });
    await batch.commit();
  },

  async deleteManyEntities(id, projectId, taskIds, groupIds, newConnections) {
    const batch = writeBatch(firestore);
    for (const tid of taskIds) batch.delete(taskDoc(id, projectId, tid));
    for (const gid of groupIds) batch.delete(groupDoc(id, projectId, gid));
    if (taskIds.length > 0) {
      batch.update(projectDoc(id, projectId), { connections: newConnections });
    }
    await batch.commit();
  },

  // ── Group writes ─────────────────────────────────────────────────────────

  async addGroup(id, projectId, group) {
    await setDoc(groupDoc(id, projectId, group.id), group);
  },

  async updateGroup(id, projectId, groupId, changes) {
    await updateDoc(groupDoc(id, projectId, groupId), changes);
  },

  async deleteGroup(id, projectId, groupId) {
    await deleteDoc(groupDoc(id, projectId, groupId));
  },

  // ── Connection writes ────────────────────────────────────────────────────

  async addConnection(id, projectId, connection) {
    await updateDoc(projectDoc(id, projectId), { connections: arrayUnion(connection) });
  },

  async removeConnection(id, projectId, connection) {
    await updateDoc(projectDoc(id, projectId), { connections: arrayRemove(connection) });
  },

  // ── Undo / redo full-state sync ──────────────────────────────────────────

  async syncProjectState(id, projectId, state, deletedTaskIds, deletedGroupIds) {
    const batch = writeBatch(firestore);
    for (const task of state.tasks) batch.set(taskDoc(id, projectId, task.id), task);
    for (const group of state.groups) batch.set(groupDoc(id, projectId, group.id), group);
    for (const tid of deletedTaskIds) batch.delete(taskDoc(id, projectId, tid));
    for (const gid of deletedGroupIds) batch.delete(groupDoc(id, projectId, gid));
    batch.update(projectDoc(id, projectId), { connections: state.connections });
    await batch.commit();
  },

  // ── People writes ────────────────────────────────────────────────────────

  async addPerson(id, person) {
    await setDoc(personDoc(id, person.id), person);
  },

  async updatePerson(id, personId, changes) {
    await updateDoc(personDoc(id, personId), changes);
  },

  async deletePerson(id, personId) {
    await deleteDoc(personDoc(id, personId));
  },

  // ── Team writes ──────────────────────────────────────────────────────────

  async addTeam(id, team) {
    await setDoc(teamDoc(id, team.id), team);
  },

  async updateTeam(id, teamId, changes) {
    await updateDoc(teamDoc(id, teamId), changes);
  },

  async deleteTeam(id, teamId) {
    await deleteDoc(teamDoc(id, teamId));
  },
};
