import type { Person } from "../teams/types";
import type { Task, TaskStatus } from "./types";

/**
 * The people assigned to at least one of the given tasks, sorted alphabetically
 * by name (case-insensitive).
 */
export function peopleWithAssignedTasks(people: Person[], tasks: Task[]): Person[] {
  const assignedIds = new Set<string>();
  for (const task of tasks) {
    for (const personId of task.assignedPersonIds ?? []) {
      assignedIds.add(personId);
    }
  }
  return people
    .filter((person) => assignedIds.has(person.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * The tasks assigned to a person, in their original array order. Task array
 * order is the canvas sequence order (the number badge shown on each node), so
 * this is also the carousel order for presentation mode.
 *
 * When `status` is given, only tasks in that status are returned; when omitted,
 * tasks of every status are included.
 */
export function tasksAssignedToPerson(
  tasks: Task[],
  personId: string,
  status?: TaskStatus,
): Task[] {
  return tasks.filter(
    (task) =>
      (task.assignedPersonIds?.includes(personId) ?? false) &&
      (status === undefined || task.status === status),
  );
}
