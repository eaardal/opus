import type { ProjectData } from "../domain/workspace/types";
import type { Person, Team } from "../domain/teams/types";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthService {
  currentUser(): AuthUser | null;
  onAuthChange(callback: (user: AuthUser | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

export type WorkspaceId = string;

export interface WorkspaceSummary {
  id: WorkspaceId;
  name: string;
  updatedAt: Date;
}

export interface WorkspaceDocument {
  ownerId: string;
  name: string;
  projects: ProjectData[];
  people: Person[];
  teams: Team[];
  updatedAt: Date;
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
}
