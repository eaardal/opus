import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Task, TaskStatus } from "../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "./theme";
import { TaskContextMenu } from "./TaskContextMenu";

const STATUSES: Record<TaskStatus, StatusConfig> = {
  pending: { label: "Pending", color: "#000", fontColor: "#fff", emoji: "💤" },
  in_progress: { label: "In progress", color: "#000", fontColor: "#fff", emoji: "🛠️" },
  blocked: { label: "Blocked", color: "#000", fontColor: "#fff", emoji: "🚫" },
  completed: { label: "Done", color: "#000", fontColor: "#fff", emoji: "✅" },
  archived: { label: "Archived", color: "#000", fontColor: "#fff", emoji: "🗄️" },
};

const CATEGORIES: Record<string, CategoryConfig> = {};

const TASK: Task = { id: "t1", text: "Task", x: 0, y: 0, status: "pending" };

function renderMenu(onClose: () => void) {
  return render(
    // The button mirrors GroupRect's body: it calls stopPropagation() on
    // mousedown, which (in the bubble phase) would stop the event reaching a
    // document-level bubble listener. The menu must dismiss regardless.
    <div>
      <button type="button" data-testid="group-body" onMouseDown={(e) => e.stopPropagation()}>
        group body
      </button>
      <TaskContextMenu
        task={TASK}
        x={0}
        y={0}
        categories={CATEGORIES}
        statuses={STATUSES}
        people={[]}
        onSetStatus={vi.fn()}
        onSetCategory={vi.fn()}
        onDuplicate={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
        onAssignPeople={vi.fn()}
        onClose={onClose}
      />
    </div>,
  );
}

describe("TaskContextMenu", () => {
  test("closes when mousedown lands on an element that stops propagation (e.g. a group body)", () => {
    const onClose = vi.fn();
    renderMenu(onClose);

    fireEvent.mouseDown(screen.getByTestId("group-body"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("does not close when mousedown lands inside the menu", () => {
    const onClose = vi.fn();
    renderMenu(onClose);

    fireEvent.mouseDown(screen.getByText("Delete"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
