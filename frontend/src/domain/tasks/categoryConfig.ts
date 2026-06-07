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
  milestone: { label: "Milestone", shape: "diamond" },
  qa: { label: "QA", shape: "diamond" },
  external_dependency: { label: "External dependency", shape: "triangle" },
};

export const CATEGORY_IDS: ReadonlyArray<string> = Object.keys(CATEGORY_DEFINITIONS);

/**
 * Stored category keys that have been renamed, mapped to their current key.
 * Tasks persisted before a rename still carry the old key, so reads must
 * translate it. The "Integration Point" category was renamed to "Milestone";
 * its stored key `integration` became `milestone`.
 */
const LEGACY_CATEGORY_KEYS: Readonly<Record<string, string>> = {
  integration: "milestone",
};

/**
 * Resolve a stored category key to its current key, translating any legacy key
 * that has since been renamed. Current and unknown keys pass through unchanged.
 * This is the single source of truth for legacy-key aliasing — the Firestore
 * read boundary calls it so old documents render under the new category before
 * the data migration rewrites them.
 */
export function resolveCategoryKey(category: string): string {
  return LEGACY_CATEGORY_KEYS[category] ?? category;
}
