import { Task, Group } from "../taskMgt/Sidebar";
import { Connection, ViewBox } from "../taskMgt/Canvas";
import { Person, Team } from "../teamMgt/types";

export interface TaskQueueEntry {
  taskId: string;
}

export interface PersonTaskQueue {
  personId: string;
  currentTasks: TaskQueueEntry[];
  queuedTasks: TaskQueueEntry[];
}

export interface ProjectData {
  id: string;
  name: string;
  tasks: Task[];
  connections: Connection[];
  groups: Group[];
  viewBox: ViewBox;
  theme: "dark" | "light";
  taskQueues: PersonTaskQueue[];
}

export interface WorkspaceFile {
  version: 2;
  projects: ProjectData[];
  people: Person[];
  teams: Team[];
}

export type ProjectState = Pick<ProjectData, "tasks" | "connections" | "groups" | "viewBox" | "theme" | "taskQueues">;

export function extractProjectState(p: ProjectData): ProjectState {
  return { tasks: p.tasks, connections: p.connections, groups: p.groups, viewBox: p.viewBox, theme: p.theme, taskQueues: p.taskQueues ?? [] };
}

export function createDefaultProject(name = "My Project"): ProjectData {
  return {
    id: crypto.randomUUID(),
    name,
    tasks: [],
    connections: [],
    groups: [],
    viewBox: { x: 0, y: 0, width: 0, height: 0 },
    theme: "light",
    taskQueues: [],
  };
}

/** Detect and migrate old single-project task save files */
export function parseWorkspaceFile(raw: unknown): WorkspaceFile {
  const data = raw as Record<string, unknown>;

  // Already new format
  if (data.version === 2 && Array.isArray(data.projects)) {
    return data as unknown as WorkspaceFile;
  }

  // Old task-only format: { tasks, connections, groups, theme, viewBox }
  if (Array.isArray(data.tasks)) {
    return {
      version: 2,
      projects: [{
        id: crypto.randomUUID(),
        name: "Imported Project",
        tasks: (data.tasks ?? []) as Task[],
        connections: (data.connections ?? []) as Connection[],
        groups: (data.groups ?? []) as Group[],
        viewBox: (data.viewBox ?? { x: 0, y: 0, width: 0, height: 0 }) as ViewBox,
        theme: (data.theme === "dark" ? "dark" : "light"),
        taskQueues: [],
      }],
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

  // Unknown — return empty workspace
  return { version: 2, projects: [createDefaultProject()], people: [], teams: [] };
}
