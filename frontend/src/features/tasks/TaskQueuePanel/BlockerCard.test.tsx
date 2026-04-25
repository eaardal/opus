import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Task } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import { BlockerCard } from "./BlockerCard";

const STATUS: Record<Task["status"], StatusConfig> = {
  pending: { label: "Pending", emoji: "💤", color: "#cbcce2", fontColor: "#000" },
  in_progress: { label: "In Progress", emoji: "👀", color: "#8e8ebb", fontColor: "#fff" },
  completed: { label: "Completed", emoji: "✅", color: "#56cf7c", fontColor: "#000" },
  archived: { label: "Archived", emoji: "🪦", color: "#a0a0a0", fontColor: "#000" },
};

const CATEGORIES: Record<string, CategoryConfig> = {};

const blocker: Task = {
  id: "t-block",
  text: "Backend API not deployed",
  x: 0,
  y: 0,
  status: "pending",
};

const alice: Person = { id: "p1", name: "Alice", picture: null };
const bob: Person = { id: "p2", name: "Bob", picture: null };

const baseProps = {
  task: blocker,
  seqNum: 12,
  groupTitle: null,
  assignedPeople: [],
  isHighlighted: false,
  categories: CATEGORIES,
  statuses: STATUS,
  onClick: vi.fn(),
};

describe("BlockerCard", () => {
  test("renders the task text without an assignees row when nobody is assigned", () => {
    const { container, getByText } = render(<BlockerCard {...baseProps} />);
    expect(getByText("Backend API not deployed")).toBeTruthy();
    expect(container.querySelector(".tq-blocker-assignees")).toBeNull();
  });

  test("renders an avatar per assignee plus a comma-separated name list", () => {
    const { container, getByText } = render(
      <BlockerCard {...baseProps} assignedPeople={[alice, bob]} />,
    );
    expect(container.querySelectorAll(".tq-blocker-assignees > *").length).toBeGreaterThan(0);
    expect(getByText("Alice, Bob")).toBeTruthy();
  });

  test("falls back to '?' in the names list when an assignee has no name", () => {
    const namelessPerson: Person = { id: "p3", name: "", picture: null };
    const { container } = render(<BlockerCard {...baseProps} assignedPeople={[namelessPerson]} />);
    const names = container.querySelector(".tq-blocker-assignee-names");
    expect(names?.textContent).toBe("?");
  });

  test("matches snapshot with two assignees and highlight on", () => {
    const { container } = render(
      <BlockerCard {...baseProps} assignedPeople={[alice, bob]} isHighlighted={true} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
