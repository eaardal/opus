import type { Connection, Group, Task, ViewBox } from "../tasks/types";
import type { Person, Team } from "../teams/types";
import { createDefaultProject } from "./projectState";
import type { WorkspaceFile } from "./types";

/**
 * Detect and migrate a workspace save file from any historical shape into the
 * current v2 format. Branches, in priority order:
 *
 *   1. v2 file → returned unchanged.
 *   2. Legacy task-only save (had `tasks: [...]`) → wrapped in an
 *      "Imported Project" with empty people/teams.
 *   3. Legacy teams-only save (had `people: [...]`) → wrapped with a fresh
 *      default project.
 *   4. Anything else → an empty default workspace.
 *
 * Saves from before v2 only ever had ONE of `tasks` or `people`, so the
 * priority ordering only matters for malformed inputs that include both.
 */
export function parseWorkspaceFile(raw: unknown): WorkspaceFile {
  const data = raw as Record<string, unknown>;

  // Already new format.
  if (data.version === 2 && Array.isArray(data.projects)) {
    return data as unknown as WorkspaceFile;
  }

  // Old task-only format: { tasks, connections, groups, theme, viewBox }
  if (Array.isArray(data.tasks)) {
    return {
      version: 2,
      projects: [
        {
          id: crypto.randomUUID(),
          name: "Imported Project",
          tasks: (data.tasks ?? []) as Task[],
          connections: (data.connections ?? []) as Connection[],
          groups: (data.groups ?? []) as Group[],
          viewBox: (data.viewBox ?? { x: 0, y: 0, width: 0, height: 0 }) as ViewBox,
          theme: data.theme === "dark" ? "dark" : "light",
          taskQueues: [],
        },
      ],
      people: [],
      teams: [],
    };
  }

  // Old teams-only format: { people, teams }
  if (Array.isArray(data.people)) {
    return {
      version: 2,
      projects: [createDefaultProject()],
      people: (data.people ?? []) as Person[],
      teams: (data.teams ?? []) as Team[],
    };
  }

  // Unknown — return empty workspace.
  return { version: 2, projects: [createDefaultProject()], people: [], teams: [] };
}
