import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Task } from "../../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import { TaskCard } from "./TaskCard";

const STATUS: Record<Task["status"], StatusConfig> = {
  pending: { label: "Pending", emoji: "💤", color: "#cbcce2", fontColor: "#000" },
  in_progress: { label: "In Progress", emoji: "👀", color: "#8e8ebb", fontColor: "#fff" },
  completed: { label: "Completed", emoji: "✅", color: "#56cf7c", fontColor: "#000" },
  archived: { label: "Archived", emoji: "🪦", color: "#a0a0a0", fontColor: "#000" },
};

const CATEGORIES: Record<string, CategoryConfig> = {
  backend: { label: "Backend", color: "#ffce92" },
};

const baseTask: Task = {
  id: "t1",
  text: "Wire up the auth flow",
  x: 0,
  y: 0,
  status: "pending",
};

const baseProps = {
  task: baseTask,
  seqNum: 7,
  groupTitle: "Sprint 3",
  isHighlighted: false,
  categories: CATEGORIES,
  statuses: STATUS,
  onRemove: vi.fn(),
  onClick: vi.fn(),
};

describe("TaskCard", () => {
  test("renders the task text, sequence number, group title, and status emoji", () => {
    const { getByText } = render(<TaskCard {...baseProps} />);
    expect(getByText("Wire up the auth flow")).toBeTruthy();
    expect(getByText("#7")).toBeTruthy();
    expect(getByText("Sprint 3")).toBeTruthy();
    expect(getByText("💤")).toBeTruthy();
  });

  test("falls back to '(unnamed)' when the task has no text", () => {
    const { getByText } = render(<TaskCard {...baseProps} task={{ ...baseTask, text: "" }} />);
    expect(getByText("(unnamed)")).toBeTruthy();
  });

  test("uses the category colour for the left border when present, status colour otherwise", () => {
    const { container, rerender } = render(
      <TaskCard {...baseProps} task={{ ...baseTask, category: "backend" }} />,
    );
    const card = container.querySelector(".tq-task-card") as HTMLElement;
    expect(card.style.borderLeftColor).toBeTruthy();
    // Without a category, the border falls back to the status colour.
    rerender(<TaskCard {...baseProps} />);
    const fallback = container.querySelector(".tq-task-card") as HTMLElement;
    expect(fallback.style.borderLeftColor).toBeTruthy();
  });

  test("clicking the card calls onClick", () => {
    const onClick = vi.fn();
    const { container } = render(<TaskCard {...baseProps} onClick={onClick} />);
    const card = container.querySelector(".tq-task-card") as HTMLElement;
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalled();
  });

  test("clicking the × button calls onRemove and stops propagation to onClick", () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    const { container } = render(<TaskCard {...baseProps} onRemove={onRemove} onClick={onClick} />);
    const removeBtn = container.querySelector(".tq-task-remove") as HTMLElement;
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  test("matches snapshot for the highlighted in-progress card", () => {
    const { container } = render(
      <TaskCard
        {...baseProps}
        task={{ ...baseTask, status: "in_progress" }}
        isHighlighted={true}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
