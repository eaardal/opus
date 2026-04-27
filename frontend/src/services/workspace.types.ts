import type { ProjectData } from "../domain/workspace/types";
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
}

export interface WorkspaceDocument {
  ownerId: string;
  name: string;
  projects: ProjectData[];
  people: Person[];
  teams: Team[];
  updatedAt: Date;
  /** Map of uid -> member info. Absent on legacy docs (pre-roles). */
  members?: Record<string, WorkspaceMember>;
  /** Mirror of Object.keys(members) for array-contains queries. */
  memberIds?: string[];
}

/** The subset of a workspace the user edits in-app. */
export type WorkspaceContent = Pick<WorkspaceDocument, "projects" | "people" | "teams">;

export interface WorkspaceService {
  listMine(): Promise<WorkspaceSummary[]>;
  create(name: string): Promise<WorkspaceId>;
  subscribe(id: WorkspaceId, callback: (doc: WorkspaceDocument | null) => void): () => void;
  saveContent(id: WorkspaceId, content: WorkspaceContent): Promise<void>;
  rename(id: WorkspaceId, name: string): Promise<void>;
  remove(id: WorkspaceId): Promise<void>;
  addMember(id: WorkspaceId, uid: string, role: Role): Promise<void>;
  updateMemberRole(id: WorkspaceId, uid: string, role: Role): Promise<void>;
  removeMember(id: WorkspaceId, uid: string): Promise<void>;
}
