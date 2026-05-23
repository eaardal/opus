import { useEffect, useRef, useState } from "react";
import type { Person, Team } from "../domain/teams/types";
import type {
  ProjectSummary,
  WorkspaceDocument,
  WorkspaceId,
  WorkspaceService,
} from "../services/workspace.types";

export type WorkspaceLoadStatus = "loading" | "ready" | "missing" | "error";
export type WorkspaceLoadError = "permission-denied" | "unknown";

export interface UseWorkspaceLoaderResult {
  status: WorkspaceLoadStatus;
  /** Only set when `status === "error"`. */
  loadError: WorkspaceLoadError | null;
  /** Live workspace name — updates on every snapshot, including renames. */
  name: string;
  /** Increments once per successful load (initial load or workspace switch).
   *  Use as part of a child-component key to force remount on switch. */
  loadCount: number;
  /** Live list of project summaries (id + name). */
  projects: ProjectSummary[];
  /** Live list of people in the workspace. */
  people: Person[];
  /** Live list of teams in the workspace. */
  teams: Team[];
  /** Latest workspace root doc snapshot — used to derive roles. */
  latestDoc: WorkspaceDocument | null;
}

interface UseWorkspaceLoaderArgs {
  workspaceId: WorkspaceId | null;
  service: WorkspaceService;
}

/**
 * Subscribes to all workspace-level Firestore data (root doc, projects list,
 * people, teams) and surfaces a clean state machine. Returns ready once all
 * four listeners have fired at least once.
 */
export function useWorkspaceLoader({
  workspaceId,
  service,
}: UseWorkspaceLoaderArgs): UseWorkspaceLoaderResult {
  const [status, setStatus] = useState<WorkspaceLoadStatus>("loading");
  const [loadError, setLoadError] = useState<WorkspaceLoadError | null>(null);
  const [name, setName] = useState("");
  const [loadCount, setLoadCount] = useState(0);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [latestDoc, setLatestDoc] = useState<WorkspaceDocument | null>(null);

  // Track which listeners have fired at least once for the current workspaceId.
  const readyFlags = useRef({ meta: false, projects: false, people: false, teams: false });
  const becameReadyRef = useRef(false);

  useEffect(() => {
    if (!workspaceId) return;

    setStatus("loading");
    setLoadError(null);
    setLatestDoc(null);
    setProjects([]);
    setPeople([]);
    setTeams([]);
    readyFlags.current = { meta: false, projects: false, people: false, teams: false };
    becameReadyRef.current = false;

    const checkReady = () => {
      if (becameReadyRef.current) return;
      const { meta, projects: p, people: pe, teams: t } = readyFlags.current;
      if (meta && p && pe && t) {
        becameReadyRef.current = true;
        setLoadCount((c) => c + 1);
        setStatus("ready");
      }
    };

    const unsubMeta = service.subscribe(workspaceId, (doc) => {
      if (!doc) {
        setLatestDoc(null);
        setStatus("missing");
        return;
      }
      setName(doc.name);
      setLatestDoc(doc);
      readyFlags.current.meta = true;
      checkReady();
    });

    const unsubProjects = service.subscribeProjects(workspaceId, (list) => {
      setProjects(list);
      readyFlags.current.projects = true;
      checkReady();
    });

    const unsubPeople = service.subscribePeople(workspaceId, (list) => {
      setPeople(list);
      readyFlags.current.people = true;
      checkReady();
    });

    const unsubTeams = service.subscribeTeams(workspaceId, (list) => {
      setTeams(list);
      readyFlags.current.teams = true;
      checkReady();
    });

    return () => {
      unsubMeta();
      unsubProjects();
      unsubPeople();
      unsubTeams();
    };
  }, [workspaceId, service]);

  return { status, loadError, name, loadCount, projects, people, teams, latestDoc };
}
