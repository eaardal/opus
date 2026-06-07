// Reflects the active project in the URL as `?project=<id>` so a Domino tab can
// be reloaded or shared and reopen on the same project. Not routing — just a
// query param synced to and read from the active-project state.

const PROJECT_PARAM = "project";

/** Pure: extract the project id from a `location.search` string, or null. */
export function parseProjectIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(PROJECT_PARAM);
  return value ? value : null;
}

/** The active project id encoded in the current URL, or null when absent. */
export function readProjectIdFromUrl(): string | null {
  return parseProjectIdFromSearch(window.location.search);
}

/**
 * Write the active project id into the URL via `history.replaceState` (so it
 * doesn't add browser-history entries), preserving any other query params and
 * the hash. No-op when the param already matches.
 */
export function writeProjectIdToUrl(projectId: string): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get(PROJECT_PARAM) === projectId) return;
  params.set(PROJECT_PARAM, projectId);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
}
