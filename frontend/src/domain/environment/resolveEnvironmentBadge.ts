export type DeploymentEnvironment = "staging" | "production";

// The production hosting build (`vite build`) runs in this mode. The badge is a
// developer/staging aid, so it is hidden there.
const PRODUCTION_HOSTING_MODE = "production";
// Staging Firebase projects carry this marker in their id (e.g. "domino-staging-dc209").
const STAGING_PROJECT_MARKER = "staging";

/**
 * Decides which backend-environment badge to show, given the Vite build `mode`
 * and the Firebase project the bundle talks to.
 *
 * Returns the environment to badge, or `null` when no badge should be shown (the
 * production hosting build). The label is derived from the *actual* Firebase
 * project, so a local build accidentally wired to production reads "production".
 * A missing project id is treated as production — better a false alarm than to
 * silently reassure.
 */
export function resolveEnvironmentBadge(
  mode: string,
  firebaseProjectId: string | undefined,
): DeploymentEnvironment | null {
  if (mode === PRODUCTION_HOSTING_MODE) return null;
  return (firebaseProjectId ?? "").includes(STAGING_PROJECT_MARKER) ? "staging" : "production";
}
