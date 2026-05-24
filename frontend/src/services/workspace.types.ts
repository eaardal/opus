import type { Connection, Group, Task } from "../domain/tasks/types";
import type { PersonTaskQueue } from "../domain/workspace/types";
import type { Person, Team } from "../domain/teams/types";

export type WorkspaceId = string;

export type Role = "owner" | "editor" | "viewer";

export interface WorkspaceMember {
  role: Role;
  addedAt: Date;
}

export interface WorkspaceSummary {
  id: WorkspaceId;
  name: string;
  updatedAt: Date;
  /** The current user's role in this workspace, resolved at list time. */
  role: Role;
  /** Email of the workspace owner. Used to display owner info on shared workspace items. */
  ownerEmail: string;
}

/** Root workspace document — subcollections hold projects/people/teams. */
export interface WorkspaceDocument {
  ownerId: string;
  name: string;
  updatedAt: Date;
  /** Map of uid -> member info. Absent on legacy docs (pre-roles). */
  members?: Record<string, WorkspaceMember>;
  /** Mirror of Object.keys(members) for array-contains queries. */
  memberIds?: string[];
}

/** What is stored in workspaces/{id}/projects/{projectId}. */
export interface ProjectDocument {
  id: string;
  name: string;
  theme: "dark" | "light";
  taskQueues: PersonTaskQueue[];
  connections: Connection[];
}

/** Lightweight entry for the project switcher. */
export interface ProjectSummary {
  id: string;
  name: string;
}

/** Aggregated content from the project doc + tasks + groups subcollections. */
export interface ProjectContent {
  projectDoc: ProjectDocument;
  tasks: Task[];
  groups: Group[];
}

export interface WorkspaceService {
  // ── Workspace management ──────────────────────────────────────────────────

  listMine(): Promise<WorkspaceSummary[]>;
  subscribeMine(callback: (workspaces: WorkspaceSummary[]) => void): () => void;
  create(name: string): Promise<WorkspaceId>;
  rename(id: WorkspaceId, name: string): Promise<void>;
  remove(id: WorkspaceId): Promise<void>;
  addMember(id: WorkspaceId, uid: string, role: Role): Promise<void>;
  updateMemberRole(id: WorkspaceId, uid: string, role: Role): Promise<void>;
  removeMember(id: WorkspaceId, uid: string): Promise<void>;

  // ── Subscriptions ─────────────────────────────────────────────────────────

  /** Workspace root doc — name, members, roles. */
  subscribe(id: WorkspaceId, callback: (doc: WorkspaceDocument | null) => void): () => void;

  /** Live list of projects (id + name only). */
  subscribeProjects(id: WorkspaceId, callback: (projects: ProjectSummary[]) => void): () => void;

  /**
   * Aggregates three Firestore listeners (project doc + tasks + groups) and
   * fires whenever any of them updates. Fires only after all three have data.
   * `hasPendingWrites` is true if any sub-listener has uncommitted writes —
   * callers use this to skip remote reconciliation of their own writes.
   */
  subscribeProjectContent(
    id: WorkspaceId,
    projectId: string,
    callback: (content: ProjectContent | null, hasPendingWrites: boolean) => void,
  ): () => void;

  /** Live list of people in the workspace. */
  subscribePeople(id: WorkspaceId, callback: (people: Person[]) => void): () => void;

  /** Live list of teams in the workspace. */
  subscribeTeams(id: WorkspaceId, callback: (teams: Team[]) => void): () => void;

  // ── Project writes ────────────────────────────────────────────────────────

  addProject(id: WorkspaceId, project: ProjectDocument): Promise<void>;
  updateProjectMeta(
    id: WorkspaceId,
    projectId: string,
    changes: Partial<Pick<ProjectDocument, "name" | "theme" | "taskQueues">>,
  ): Promise<void>;
  deleteProject(id: WorkspaceId, projectId: string): Promise<void>;

  // ── Task writes ───────────────────────────────────────────────────────────

  addTask(id: WorkspaceId, projectId: string, task: Task): Promise<void>;
  updateTask(
    id: WorkspaceId,
    projectId: string,
    taskId: string,
    changes: Partial<Task>,
  ): Promise<void>;
  /** Deletes the task doc and removes its connections from the project doc atomically. */
  deleteTask(
    id: WorkspaceId,
    projectId: string,
    taskId: string,
    newConnections: Connection[],
  ): Promise<void>;
  /** Batch-deletes multiple tasks and groups, updating connections atomically. */
  deleteManyEntities(
    id: WorkspaceId,
    projectId: string,
    taskIds: string[],
    groupIds: string[],
    newConnections: Connection[],
  ): Promise<void>;

  // ── Group writes ──────────────────────────────────────────────────────────

  addGroup(id: WorkspaceId, projectId: string, group: Group): Promise<void>;
  updateGroup(
    id: WorkspaceId,
    projectId: string,
    groupId: string,
    changes: Partial<Group>,
  ): Promise<void>;
  deleteGroup(id: WorkspaceId, projectId: string, groupId: string): Promise<void>;

  // ── Connection writes (stored on project doc) ─────────────────────────────

  addConnection(id: WorkspaceId, projectId: string, connection: Connection): Promise<void>;
  removeConnection(id: WorkspaceId, projectId: string, connection: Connection): Promise<void>;

  // ── Undo / redo full-state sync ───────────────────────────────────────────

  /**
   * Batch-upserts all tasks and groups in `state`, deletes any task/group docs
   * whose IDs are listed in the deleted arrays, and overwrites connections on
   * the project doc. Used after undo/redo where the diff is pre-computed by
   * the caller.
   */
  syncProjectState(
    id: WorkspaceId,
    projectId: string,
    state: { tasks: Task[]; groups: Group[]; connections: Connection[] },
    deletedTaskIds: string[],
    deletedGroupIds: string[],
  ): Promise<void>;

  // ── People writes ─────────────────────────────────────────────────────────

  addPerson(id: WorkspaceId, person: Person): Promise<void>;
  updatePerson(id: WorkspaceId, personId: string, changes: Partial<Person>): Promise<void>;
  deletePerson(id: WorkspaceId, personId: string): Promise<void>;

  // ── Team writes ───────────────────────────────────────────────────────────

  addTeam(id: WorkspaceId, team: Team): Promise<void>;
  updateTeam(id: WorkspaceId, teamId: string, changes: Partial<Team>): Promise<void>;
  deleteTeam(id: WorkspaceId, teamId: string): Promise<void>;
}
