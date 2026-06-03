/**
 * Shown in place of a task's title when the task has none of its own.
 *
 * Rendering a placeholder unconditionally keeps the title tooltip — and the
 * assignee avatars anchored to it — visible on untitled tasks, which would
 * otherwise have no title block to hang them off.
 */
export const NO_TITLE_PLACEHOLDER = "<No title>";

/**
 * The title to display for a task. Falls back to {@link NO_TITLE_PLACEHOLDER}
 * when the task has no meaningful title (empty or whitespace-only `text`).
 */
export function taskDisplayTitle(text: string): string {
  return text.trim() ? text : NO_TITLE_PLACEHOLDER;
}
