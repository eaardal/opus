import { createContext, useContext, type ReactNode } from "react";
import {
  canDeleteWorkspace as canDelete,
  canEdit as canEditFn,
  canManageMembers as canManage,
} from "../../domain/workspace/roles";
import type { Role } from "../../services/workspace.types";

export interface WorkspaceRoleValue {
  /** null when the user has no access (or the workspace hasn't loaded yet). */
  role: Role | null;
  canEdit: boolean;
  canManageMembers: boolean;
  canDeleteWorkspace: boolean;
}

const defaultValue: WorkspaceRoleValue = {
  role: null,
  canEdit: false,
  canManageMembers: false,
  canDeleteWorkspace: false,
};

const WorkspaceRoleContext = createContext<WorkspaceRoleValue>(defaultValue);

export function WorkspaceRoleProvider({
  role,
  children,
}: {
  role: Role | null;
  children: ReactNode;
}) {
  const value: WorkspaceRoleValue = {
    role,
    canEdit: canEditFn(role),
    canManageMembers: canManage(role),
    canDeleteWorkspace: canDelete(role),
  };
  return <WorkspaceRoleContext.Provider value={value}>{children}</WorkspaceRoleContext.Provider>;
}

export function useWorkspaceRole(): WorkspaceRoleValue {
  return useContext(WorkspaceRoleContext);
}
