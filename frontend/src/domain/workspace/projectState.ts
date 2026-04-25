import type { ProjectData, ProjectState } from "./types";

/**
 * Pull the editable subset of a ProjectData out for use as ProjectState — the
 * shape that TaskMgt reports back to the workspace owner via onStateChange.
 */
export function extractProjectState(p: ProjectData): ProjectState {
  return {
    tasks: p.tasks,
    connections: p.connections,
    groups: p.groups,
    viewBox: p.viewBox,
    theme: p.theme,
    taskQueues: (p.taskQueues ?? []).map((q) => ({ personId: q.personId })),
  };
}

/** Construct an empty project with a fresh id. */
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
