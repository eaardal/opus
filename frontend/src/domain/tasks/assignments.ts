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

/**
 * The number of assigned tasks for each of the given people, keyed by person id.
 * Honours the same status filter as `tasksAssignedToPerson`: when `status` is
 * given only tasks in that status are counted; when omitted, every status counts.
 * Every given person gets an entry — those with no matching tasks map to 0.
 */
export function taskCountsByPerson(
  tasks: Task[],
  people: Person[],
  status?: TaskStatus,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const person of people) {
    counts[person.id] = tasksAssignedToPerson(tasks, person.id, status).length;
  }
  return counts;
}

/**
 * Orders people for the assignment picker: those currently assigned first, then
 * the rest, each group sorted alphabetically by name (case-insensitive). Grouping
 * is by the given assigned-id set, so un-assigning a person re-sorts them back
 * among the unassigned. Does not mutate the input.
 */
export function orderPeopleByAssignment(
  people: Person[],
  assignedIds: ReadonlySet<string>,
): Person[] {
  return [...people].sort((a, b) => {
    const aAssigned = assignedIds.has(a.id);
    const bAssigned = assignedIds.has(b.id);
    if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
