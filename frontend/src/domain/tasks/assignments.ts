import type { Person } from "../teams/types";
import type { Task } from "./types";

/**
 * The people assigned to at least one of the given tasks, returned in the same
 * order as the input `people` list.
 */
export function peopleWithAssignedTasks(people: Person[], tasks: Task[]): Person[] {
  const assignedIds = new Set<string>();
  for (const task of tasks) {
    for (const personId of task.assignedPersonIds ?? []) {
      assignedIds.add(personId);
    }
  }
  return people.filter((person) => assignedIds.has(person.id));
}

/**
 * The tasks assigned to a person, in their original array order. Task array
 * order is the canvas sequence order (the number badge shown on each node), so
 * this is also the carousel order for presentation mode.
 */
export function tasksAssignedToPerson(tasks: Task[], personId: string): Task[] {
  return tasks.filter((task) => task.assignedPersonIds?.includes(personId) ?? false);
}
