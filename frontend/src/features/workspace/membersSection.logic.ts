import type { RegisteredUser } from "../../services/user.types";
import type { Role, WorkspaceDocument } from "../../services/workspace.types";

export interface MemberRow {
  uid: string;
  role: Role;
  /** Resolved against the user directory; empty when unknown. */
  displayName: string;
  email: string;
  photoURL: string | null;
}

const ROLE_ORDER: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

/**
 * Builds the visible list of members for a workspace, joined against the user
 * directory and sorted by role then name. Falls back to the legacy `ownerId`
 * field when `members` is missing or empty so the dialog still shows the
 * implicit owner on pre-roles workspaces.
 */
export function buildMemberRows(doc: WorkspaceDocument, users: RegisteredUser[]): MemberRow[] {
  const directory = new Map(users.map((u) => [u.uid, u]));
  const entries: { uid: string; role: Role }[] = [];

  if (doc.members && Object.keys(doc.members).length > 0) {
    for (const [uid, info] of Object.entries(doc.members)) {
      entries.push({ uid, role: info.role });
    }
  } else if (doc.ownerId) {
    entries.push({ uid: doc.ownerId, role: "owner" });
  }

  return entries
    .map((e) => {
      const u = directory.get(e.uid);
      return {
        uid: e.uid,
        role: e.role,
        displayName: u?.displayName ?? "",
        email: u?.email ?? "",
        photoURL: u?.photoURL ?? null,
      };
    })
    .sort((a, b) => {
      const r = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      if (r !== 0) return r;
      return (a.displayName || a.email).localeCompare(b.displayName || b.email);
    });
}

/**
 * Returns users from the directory who are not already members and who match
 * the search query against displayName or email. Sorted alphabetically.
 */
export function filterCandidates(
  allUsers: RegisteredUser[],
  members: MemberRow[],
  search: string,
): RegisteredUser[] {
  const memberUids = new Set(members.map((m) => m.uid));
  const q = search.trim().toLowerCase();
  return allUsers
    .filter((u) => !memberUids.has(u.uid))
    .filter((u) => {
      if (!q) return true;
      const name = (u.displayName ?? "").toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email));
}
