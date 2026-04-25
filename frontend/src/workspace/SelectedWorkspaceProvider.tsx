import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authService } from "../services/container";
import type { WorkspaceId } from "../services/types";

const STORAGE_KEY = "domino.selectedWorkspaceId";

interface SelectedWorkspace {
  id: WorkspaceId | null;
  select: (id: WorkspaceId | null) => void;
}

const SelectedWorkspaceContext = createContext<SelectedWorkspace | null>(null);

function readStored(): WorkspaceId | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: WorkspaceId | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — the selection still works in-memory
  }
}

interface Props {
  children: ReactNode;
}

export function SelectedWorkspaceProvider({ children }: Props) {
  const [id, setId] = useState<WorkspaceId | null>(readStored);

  const select = useCallback((next: WorkspaceId | null) => {
    writeStored(next);
    setId(next);
  }, []);

  // A stored id from a signed-out user must not leak to the next
  // session; clear on sign-out.
  useEffect(() => {
    return authService.onAuthChange((user) => {
      if (!user) {
        writeStored(null);
        setId(null);
      }
    });
  }, []);

  return (
    <SelectedWorkspaceContext.Provider value={{ id, select }}>
      {children}
    </SelectedWorkspaceContext.Provider>
  );
}

export function useSelectedWorkspace(): SelectedWorkspace {
  const ctx = useContext(SelectedWorkspaceContext);
  if (!ctx) throw new Error("useSelectedWorkspace outside SelectedWorkspaceProvider");
  return ctx;
}
