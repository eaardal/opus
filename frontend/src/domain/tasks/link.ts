import type { Group, LinkTarget, Task } from "./types";

/** Whether a task is a link task (navigates to a destination) vs a standard task. */
export function isLinkTask(task: Pick<Task, "type">): boolean {
  return task.type === "link";
}

/**
 * How to navigate to a link's destination, decided purely from the target and
 * the currently-active project. The orchestrator turns this into UI actions:
 * same-project hops zoom in place; cross-project hops switch project first; a
 * project target just activates the project.
 */
export type LinkNavigation =
  | { kind: "activateProject"; projectId: string }
  | { kind: "sameProjectTask"; taskId: string }
  | { kind: "sameProjectGroup"; groupId: string }
  | { kind: "crossProjectTask"; projectId: string; taskId: string }
  | { kind: "crossProjectGroup"; projectId: string; groupId: string };

export function classifyLinkNavigation(
  target: LinkTarget,
  activeProjectId: string,
): LinkNavigation {
  if (target.kind === "project") {
    return { kind: "activateProject", projectId: target.projectId };
  }
  const sameProject = target.projectId === activeProjectId;
  if (target.kind === "task") {
    return sameProject
      ? { kind: "sameProjectTask", taskId: target.taskId }
      : { kind: "crossProjectTask", projectId: target.projectId, taskId: target.taskId };
  }
  return sameProject
    ? { kind: "sameProjectGroup", groupId: target.groupId }
    : { kind: "crossProjectGroup", projectId: target.projectId, groupId: target.groupId };
}

/**
 * Whether the task/group a link points at still exists in a given project's
 * loaded content. Project targets return false — their existence is checked
 * against the workspace's project summaries, not a project's content.
 */
export function linkTargetExistsIn(
  target: LinkTarget,
  content: { tasks: Pick<Task, "id">[]; groups: Pick<Group, "id">[] },
): boolean {
  if (target.kind === "task") return content.tasks.some((t) => t.id === target.taskId);
  if (target.kind === "group") return content.groups.some((g) => g.id === target.groupId);
  return false;
}

/**
 * Validate and narrow a raw stored value into a `LinkTarget`, or return
 * undefined when it is missing or malformed. The single source of truth for
 * what a persisted link target must look like; called by the Firestore read
 * boundary so corrupt data can't masquerade as a valid link.
 */
export function parseLinkTarget(raw: unknown): LinkTarget | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const data = raw as Record<string, unknown>;
  const projectId = data.projectId;
  if (typeof projectId !== "string" || projectId === "") return undefined;

  if (data.kind === "project") {
    return { kind: "project", projectId };
  }
  if (data.kind === "task" && typeof data.taskId === "string" && data.taskId !== "") {
    return { kind: "task", projectId, taskId: data.taskId };
  }
  if (data.kind === "group" && typeof data.groupId === "string" && data.groupId !== "") {
    return { kind: "group", projectId, groupId: data.groupId };
  }
  return undefined;
}
