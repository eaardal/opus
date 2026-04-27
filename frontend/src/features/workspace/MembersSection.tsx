import { useEffect, useMemo, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { userService, workspaceService } from "../../services/container";
import type { RegisteredUser } from "../../services/user.types";
import type { Role, WorkspaceDocument } from "../../services/workspace.types";
import { isLastOwner } from "../../domain/workspace/roles";
import { buildMemberRows, filterCandidates, type MemberRow } from "./membersSection.logic";
import "./MembersSection.css";

interface MembersSectionProps {
  workspaceId: string;
  doc: WorkspaceDocument;
  currentUid: string;
  canManage: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export function MembersSection({ workspaceId, doc, currentUid, canManage }: MembersSectionProps) {
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    userService
      .listAll()
      .then((users) => {
        if (!cancelled) setAllUsers(users);
      })
      .catch((err) => {
        if (!cancelled) setUsersError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const memberRows = useMemo<MemberRow[]>(() => buildMemberRows(doc, allUsers), [doc, allUsers]);

  const inviteCandidates = useMemo<RegisteredUser[]>(
    () => filterCandidates(allUsers, memberRows, search),
    [allUsers, memberRows, search],
  );

  const runMutation = async (label: string, op: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await op();
    } catch (err) {
      console.error(`${label} failed:`, err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = (uid: string, role: Role) => {
    if (uid === currentUid && role !== "owner" && isLastOwner(doc, currentUid)) {
      setError("You're the only owner. Promote someone else before changing your own role.");
      return;
    }
    runMutation("update role", () => workspaceService.updateMemberRole(workspaceId, uid, role));
  };

  const handleRemove = (uid: string) => {
    if (uid === currentUid && isLastOwner(doc, currentUid)) {
      setError("You're the only owner. Promote someone else before removing yourself.");
      return;
    }
    if (memberRows.find((m) => m.uid === uid)?.role === "owner" && isLastOwner(doc, uid)) {
      setError("Cannot remove the only owner of this workspace.");
      return;
    }
    runMutation("remove member", () => workspaceService.removeMember(workspaceId, uid));
  };

  const handleAdd = (uid: string, role: Role) => {
    runMutation("add member", () => workspaceService.addMember(workspaceId, uid, role));
  };

  return (
    <div className="workspace-settings-section">
      <span className="workspace-settings-label">Members</span>
      <ul className="members-list">
        {memberRows.map((m) => (
          <li key={m.uid} className="members-row">
            <div className="members-identity">
              {m.photoURL ? (
                <img src={m.photoURL} alt="" className="members-avatar" />
              ) : (
                <span className="members-avatar members-avatar-fallback" aria-hidden>
                  {(m.displayName || m.email || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="members-text">
                <span className="members-name">
                  {m.displayName || m.email}
                  {m.uid === currentUid && <span className="members-you"> (you)</span>}
                </span>
                <span className="members-email">{m.email}</span>
              </div>
            </div>
            <div className="members-controls">
              {canManage ? (
                <select
                  value={m.role}
                  className="members-role-select"
                  disabled={busy}
                  onChange={(e) => handleRoleChange(m.uid, e.target.value as Role)}
                >
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span className="members-role-badge">{ROLE_LABELS[m.role]}</span>
              )}
              {canManage && (
                <button
                  type="button"
                  className="members-remove-btn"
                  disabled={busy}
                  onClick={() => handleRemove(m.uid)}
                  aria-label={`Remove ${m.displayName || m.email}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canManage && (
        <AddMemberRow
          search={search}
          onSearchChange={setSearch}
          candidates={inviteCandidates}
          onAdd={handleAdd}
          busy={busy}
          loadError={usersError}
        />
      )}

      {error && <p className="workspace-settings-error">{error}</p>}
    </div>
  );
}

interface AddMemberRowProps {
  search: string;
  onSearchChange: (q: string) => void;
  candidates: RegisteredUser[];
  onAdd: (uid: string, role: Role) => void;
  busy: boolean;
  loadError: string | null;
}

function AddMemberRow({
  search,
  onSearchChange,
  candidates,
  onAdd,
  busy,
  loadError,
}: AddMemberRowProps) {
  const [pendingRole, setPendingRole] = useState<Record<string, Role>>({});

  const roleFor = (uid: string): Role => pendingRole[uid] ?? "viewer";

  return (
    <div className="members-add">
      <div className="members-add-header">
        <UserPlus size={14} />
        <input
          type="text"
          className="workspace-settings-input members-add-search"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {loadError && <p className="workspace-settings-error">Could not load users: {loadError}</p>}
      {!loadError && candidates.length === 0 && (
        <p className="members-add-empty">
          {search ? "No matching users." : "No more users to invite."}
        </p>
      )}
      {candidates.slice(0, 20).map((u) => (
        <div key={u.uid} className="members-add-candidate">
          <div className="members-identity">
            {u.photoURL ? (
              <img src={u.photoURL} alt="" className="members-avatar" />
            ) : (
              <span className="members-avatar members-avatar-fallback" aria-hidden>
                {(u.displayName || u.email).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="members-text">
              <span className="members-name">{u.displayName || u.email}</span>
              <span className="members-email">{u.email}</span>
            </div>
          </div>
          <div className="members-controls">
            <select
              value={roleFor(u.uid)}
              className="members-role-select"
              disabled={busy}
              onChange={(e) =>
                setPendingRole((prev) => ({ ...prev, [u.uid]: e.target.value as Role }))
              }
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="button"
              className="workspace-settings-primary-btn members-add-btn"
              disabled={busy}
              onClick={() => onAdd(u.uid, roleFor(u.uid))}
            >
              Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
