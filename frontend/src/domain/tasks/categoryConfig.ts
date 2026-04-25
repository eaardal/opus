import type { NodeShape } from "./types";

/** Theme-independent properties of a task category. View-only props (colour) */
/** live with the per-theme tables in features/. */
export interface CategoryDefinition {
  label: string;
  /** Render shape on the canvas; defaults to circle when omitted. */
  shape?: NodeShape;
}

export const CATEGORY_DEFINITIONS: Record<string, CategoryDefinition> = {
  backend: { label: "Backend" },
  frontend: { label: "Frontend" },
  ux: { label: "UX" },
  integration: { label: "Integration Point", shape: "diamond" },
  qa: { label: "QA", shape: "diamond" },
  external_dependency: { label: "External dependency", shape: "triangle" },
};

export const CATEGORY_IDS: ReadonlyArray<string> = Object.keys(CATEGORY_DEFINITIONS);
