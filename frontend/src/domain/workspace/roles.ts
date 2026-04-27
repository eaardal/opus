import type { Role, WorkspaceDocument } from "../../services/workspace.types";

/**
 * Resolves the given uid's role in a workspace.
 * - If `members` is populated, the map is authoritative.
 * - Legacy docs (no `members`, or empty `members`) treat `ownerId` as
 *   the implicit owner so users can still access docs that predate roles.
 * Returns null when the user has no access.
 */
export function resolveRole(doc: WorkspaceDocument | null, uid: string): Role | null {
  if (!doc) return null;
  const members = doc.members;
  if (members && Object.keys(members).length > 0) {
    return members[uid]?.role ?? null;
  }
  return doc.ownerId === uid ? "owner" : null;
}

export function canEdit(role: Role | null): boolean {
  return role === "owner" || role === "editor";
}

export function canManageMembers(role: Role | null): boolean {
  return role === "owner";
}

export function canDeleteWorkspace(role: Role | null): boolean {
  return role === "owner";
}

/**
 * True when the given uid is the only owner of the workspace. Used to block
 * actions that would leave the workspace without an owner (demoting the last
 * owner, removing oneself, etc.).
 */
export function isLastOwner(doc: WorkspaceDocument | null, uid: string): boolean {
  if (!doc) return false;
  if (resolveRole(doc, uid) !== "owner") return false;
  const members = doc.members;
  if (!members || Object.keys(members).length === 0) {
    return doc.ownerId === uid;
  }
  const ownerCount = Object.values(members).filter((m) => m.role === "owner").length;
  return ownerCount <= 1;
}
