import type { Connection, Group, Task, ViewBox } from "../tasks/types";
import type { Person, Team } from "../teams/types";

export interface PersonTaskQueue {
  personId: string;
}

export interface ProjectData {
  id: string;
  name: string;
  tasks: Task[];
  connections: Connection[];
  groups: Group[];
  viewBox: ViewBox;
  theme: "dark" | "light";
  taskQueues: PersonTaskQueue[];
}

export interface WorkspaceFile {
  version: 2;
  projects: ProjectData[];
  people: Person[];
  teams: Team[];
}

export type ProjectState = Pick<
  ProjectData,
  "tasks" | "connections" | "groups" | "viewBox" | "theme" | "taskQueues"
>;
