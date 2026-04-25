import type { Person, Team } from "../../domain/teams/types";

/** View-only handle exposed by the TeamsApp component. */
export interface TeamMgtHandle {
  getPeople: () => Person[];
  getTeams: () => Team[];
}
