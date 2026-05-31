import { resolveEnvironmentBadge } from "../domain/environment/resolveEnvironmentBadge";
import { firebaseApp } from "./firebase/client";

/**
 * The backend-environment badge for this bundle, or `null` when none should be
 * shown. Reads the Vite build mode and the live Firebase project id at module
 * load; the classification itself lives in the pure `resolveEnvironmentBadge`.
 */
export const environmentBadge = resolveEnvironmentBadge(
  import.meta.env.MODE,
  firebaseApp.options.projectId,
);
