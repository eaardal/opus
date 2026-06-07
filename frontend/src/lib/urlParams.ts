// Reflects view state in the URL query so a Domino tab can be reloaded or shared
// and reopen where it was: `?project=<id>` for the active project, and
// `?task=<id>` / `?group=<id>` for the selected entity. Not routing — just query
// params synced to and read from app state.

const PROJECT_PARAM = "project";
const TASK_PARAM = "task";
const GROUP_PARAM = "group";

/** A focused entity on the canvas. Task is more granular than group. */
export type EntityFocus = { kind: "task" | "group"; id: string };

// ── Project ───────────────────────────────────────────────────────────────────

/** Pure: extract the project id from a `location.search` string, or null. */
export function parseProjectIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(PROJECT_PARAM);
  return value ? value : null;
}

/** The active project id encoded in the current URL, or null when absent. */
export function readProjectIdFromUrl(): string | null {
  return parseProjectIdFromSearch(window.location.search);
}

/** Write the active project id into the URL, preserving other params. No-op when unchanged. */
export function writeProjectIdToUrl(projectId: string): void {
  if (new URLSearchParams(window.location.search).get(PROJECT_PARAM) === projectId) return;
  replaceSearch((params) => params.set(PROJECT_PARAM, projectId));
}

// ── Focus (selected task / group) ──────────────────────────────────────────────

/**
 * Pure: the most granular focus encoded in a `location.search` string — a task
 * takes priority over a group — or null when neither is present.
 */
export function parseFocusFromSearch(search: string): EntityFocus | null {
  const params = new URLSearchParams(search);
  const taskId = params.get(TASK_PARAM);
  if (taskId) return { kind: "task", id: taskId };
  const groupId = params.get(GROUP_PARAM);
  if (groupId) return { kind: "group", id: groupId };
  return null;
}

/** The focused entity encoded in the current URL, or null when absent. */
export function readFocusFromUrl(): EntityFocus | null {
  return parseFocusFromSearch(window.location.search);
}

/**
 * Write the focused entity into the URL: sets the task param XOR the group param
 * and removes the other; passing null removes both. Preserves the project param
 * and the hash. No-op when the resulting params are unchanged (so it's safe to
 * call on every selection change, including rapid marquee updates).
 */
export function writeFocusToUrl(focus: EntityFocus | null): void {
  const current = new URLSearchParams(window.location.search);
  const nextTask = focus?.kind === "task" ? focus.id : null;
  const nextGroup = focus?.kind === "group" ? focus.id : null;
  if (current.get(TASK_PARAM) === nextTask && current.get(GROUP_PARAM) === nextGroup) return;
  replaceSearch((params) => {
    params.delete(TASK_PARAM);
    params.delete(GROUP_PARAM);
    if (nextTask) params.set(TASK_PARAM, nextTask);
    if (nextGroup) params.set(GROUP_PARAM, nextGroup);
  });
}

// ── Internal ────────────────────────────────────────────────────────────────────

/**
 * Apply a mutation to the current query params and push it via
 * `history.replaceState` (so it doesn't add browser-history entries), keeping
 * the pathname and hash intact.
 */
function replaceSearch(mutate: (params: URLSearchParams) => void): void {
  const params = new URLSearchParams(window.location.search);
  mutate(params);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
}
