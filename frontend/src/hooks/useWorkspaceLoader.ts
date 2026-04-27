import { useEffect, useRef, useState } from "react";
import { createDefaultProject } from "../domain/workspace/projectState";
import type { ProjectData } from "../domain/workspace/types";
import type { Person, Team } from "../domain/teams/types";
import type { WorkspaceDocument, WorkspaceId } from "../services/workspace.types";

export type WorkspaceLoadStatus = "loading" | "ready" | "missing";

export interface WorkspaceHydration {
  projects: ProjectData[];
  activeProjectId: string;
  people: Person[];
  teams: Team[];
}

export interface UseWorkspaceLoaderResult {
  status: WorkspaceLoadStatus;
  /** Live workspace name — updates on every snapshot, including renames. */
  name: string;
  /** Increments once per successful hydration (initial load or workspace switch).
   *  Useful as part of a child-component key to force remount on switch. */
  loadCount: number;
  /** Initial hydration data; only present when `status === "ready"`. The hook
   *  hydrates exactly once per workspace id — subsequent snapshots only update
   *  `name`, so unsaved local edits are not clobbered by remote echoes. */
  hydration: WorkspaceHydration | null;
  /** The latest snapshot of the workspace document. Updates on every snapshot
   *  (unlike `hydration`, which is one-shot). Used to derive live values that
   *  must reflect remote changes — e.g. the current user's role. */
  latestDoc: WorkspaceDocument | null;
}

interface UseWorkspaceLoaderArgs {
  workspaceId: WorkspaceId | null;
  subscribe: (id: WorkspaceId, callback: (doc: WorkspaceDocument | null) => void) => () => void;
}

/**
 * Subscribe to a Firestore workspace doc and surface a clean state machine.
 * Encapsulates the hydration-once + name-on-rename + missing-doc detection
 * dance that App.tsx used to do inline.
 */
export function useWorkspaceLoader({
  workspaceId,
  subscribe,
}: UseWorkspaceLoaderArgs): UseWorkspaceLoaderResult {
  const [status, setStatus] = useState<WorkspaceLoadStatus>(workspaceId ? "loading" : "loading");
  const [name, setName] = useState("");
  const [loadCount, setLoadCount] = useState(0);
  const [hydration, setHydration] = useState<WorkspaceHydration | null>(null);
  const [latestDoc, setLatestDoc] = useState<WorkspaceDocument | null>(null);
  const hydratedForRef = useRef<WorkspaceId | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    setStatus("loading");
    setLatestDoc(null);
    hydratedForRef.current = null;

    return subscribe(workspaceId, (doc) => {
      if (!doc) {
        setLatestDoc(null);
        setStatus("missing");
        return;
      }
      setName(doc.name);
      setLatestDoc(doc);
      if (hydratedForRef.current === workspaceId) return;
      hydratedForRef.current = workspaceId;

      const projects = doc.projects.length > 0 ? doc.projects : [createDefaultProject()];
      setHydration({
        projects,
        activeProjectId: projects[0].id,
        people: doc.people,
        teams: doc.teams,
      });
      setLoadCount((c) => c + 1);
      setStatus("ready");
    });
  }, [workspaceId, subscribe]);

  return { status, name, loadCount, hydration, latestDoc };
}
