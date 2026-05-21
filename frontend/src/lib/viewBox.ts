import type { ViewBox } from "../domain/tasks/types";

const key = (projectId: string) => `opus:viewbox:${projectId}`;

export function saveViewBox(projectId: string, viewBox: ViewBox): void {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(viewBox));
  } catch {
    // Storage quota exceeded or private browsing — silently ignore.
  }
}

export function loadViewBox(projectId: string): ViewBox | null {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return null;
    return JSON.parse(raw) as ViewBox;
  } catch {
    return null;
  }
}
