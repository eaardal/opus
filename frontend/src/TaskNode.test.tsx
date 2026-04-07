import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TaskNode } from "./TaskNode";
import type { Task } from "./Sidebar";
import { getStatuses, getCategories } from "./theme";

const STATUSES = getStatuses("dark");
const CATEGORIES = getCategories("dark");

const baseTask: Task = {
  id: "task-1",
  text: "Test task",
  x: 100,
  y: 200,
  status: "pending",
};

const noop = () => {};

function renderTaskNode(overrides: Partial<Task> = {}, nodeState = {}) {
  const task: Task = { ...baseTask, ...overrides };
  const defaultState = {
    categories: CATEGORIES,
    statuses: STATUSES,
    isDragging: false,
    isHighlighted: false,
    isSelected: false,
    isHovered: false,
    onMouseDown: noop,
    onClick: noop,
    onMouseEnter: noop,
    onMouseLeave: noop,
  };
  const { container } = render(
    <svg>
      <TaskNode
        task={task}
        index={0}
        {...defaultState}
        {...nodeState}
      />
    </svg>
  );
  return { container, task };
}

describe("TaskNode", () => {
  describe("position and structure", () => {
    it("renders with transform based on task x and y", () => {
      const { container } = renderTaskNode({ x: 50, y: 75 });
      const g = container.querySelector("g");
      expect(g).toHaveAttribute("transform", "translate(50, 75)");
    });

    it("renders main circle, number badge, and text", () => {
      const { container } = renderTaskNode();
      const circles = container.querySelectorAll("circle");
      expect(circles.length).toBe(2);
      expect(container.querySelector(".node")).toBeInTheDocument();
      expect(container.querySelector(".node-number-badge")).toBeInTheDocument();
      expect(container.querySelector(".node-text")).toBeInTheDocument();
    });

    it("displays truncated task text (first 8 chars) or ? when empty", () => {
      const { container } = renderTaskNode({ text: "Very long task name" });
      const textEl = container.querySelector(".node-text");
      expect(textEl?.textContent).toBe("Very lon"); // slice(0, 8) => 8 chars
    });

    it("displays ? when task text is empty", () => {
      const { container } = renderTaskNode({ text: "" });
      const textEl = container.querySelector(".node-text");
      expect(textEl?.textContent).toBe("?");
    });

    it("displays index + 1 in node number", () => {
      const { container } = render(
        <svg>
          <TaskNode
            task={baseTask}
            index={2}
            categories={CATEGORIES}
            statuses={STATUSES}
            isDragging={false}
            isHighlighted={false}
            isSelected={false}
            isHovered={false}
            onMouseDown={noop}
            onClick={noop}
            onMouseEnter={noop}
            onMouseLeave={noop}
          />
        </svg>
      );
      const numberText = container.querySelector(".node-number");
      expect(numberText?.textContent).toBe("3");
    });
  });

  describe("status (progress) styling", () => {
    it("applies pending fill color when status is pending", () => {
      const { container } = renderTaskNode({ status: "pending" });
      const node = container.querySelector(".node") as SVGElement;
      expect(node).toHaveStyle({ fill: STATUSES.pending.color });
    });

    it("applies in_progress fill color when status is in_progress", () => {
      const { container } = renderTaskNode({ status: "in_progress" });
      const node = container.querySelector(".node") as SVGElement;
      expect(node).toHaveStyle({ fill: STATUSES.in_progress.color });
    });

    it("applies completed fill color when status is completed", () => {
      const { container } = renderTaskNode({ status: "completed" });
      const node = container.querySelector(".node") as SVGElement;
      expect(node).toHaveStyle({ fill: STATUSES.completed.color });
    });

    it("applies archived fill color when status is archived", () => {
      const { container } = renderTaskNode({ status: "archived" });
      const node = container.querySelector(".node") as SVGElement;
      expect(node).toHaveStyle({ fill: STATUSES.archived.color });
    });
  });

  describe("category styling", () => {
    it("applies category stroke and strokeWidth when category is set and not selected", () => {
      const { container } = renderTaskNode(
        { category: "frontend" },
        { isSelected: false }
      );
      const node = container.querySelector(".node") as SVGElement;
      expect(node).toHaveStyle({
        stroke: CATEGORIES.frontend.color,
        strokeWidth: 3,
      });
    });

    it("applies backend category color to node stroke", () => {
      const { container } = renderTaskNode(
        { category: "backend" },
        { isSelected: false }
      );
      const node = container.querySelector(".node") as SVGElement;
      expect(node).toHaveStyle({ stroke: CATEGORIES.backend.color });
    });

    it("applies ux category color to node stroke", () => {
      const { container } = renderTaskNode(
        { category: "ux" },
        { isSelected: false }
      );
      const node = container.querySelector(".node") as SVGElement;
      expect(node).toHaveStyle({ stroke: CATEGORIES.ux.color });
    });

    it("applies category color to number badge fill when category is set", () => {
      const { container } = renderTaskNode({ category: "frontend" });
      const badge = container.querySelector(".node-number-badge") as SVGElement;
      expect(badge).toHaveStyle({ fill: CATEGORIES.frontend.color });
    });

    it("does not apply category stroke when node is selected", () => {
      const { container } = renderTaskNode(
        { category: "frontend" },
        { isSelected: true }
      );
      const node = container.querySelector(".node") as SVGElement;
      expect(node).toHaveClass("selected");
      // Category stroke is omitted when isSelected (component uses task.category && !isSelected)
      expect(node.getAttribute("style")).not.toContain(CATEGORIES.frontend.color);
    });
  });

  describe("selected state", () => {
    it("applies selected class when isSelected is true", () => {
      const { container } = renderTaskNode({}, { isSelected: true });
      const node = container.querySelector(".node");
      expect(node).toHaveClass("selected");
    });

    it("does not apply selected class when isSelected is false", () => {
      const { container } = renderTaskNode({}, { isSelected: false });
      const node = container.querySelector(".node");
      expect(node).not.toHaveClass("selected");
    });
  });

  describe("highlighted state", () => {
    it("applies highlighted class when isHighlighted is true", () => {
      const { container } = renderTaskNode({}, { isHighlighted: true });
      const node = container.querySelector(".node");
      expect(node).toHaveClass("highlighted");
    });

    it("does not apply highlighted class when isHighlighted is false", () => {
      const { container } = renderTaskNode({}, { isHighlighted: false });
      const node = container.querySelector(".node");
      expect(node).not.toHaveClass("highlighted");
    });
  });

  describe("dragging state", () => {
    it("applies dragging class when isDragging is true", () => {
      const { container } = renderTaskNode({}, { isDragging: true });
      const node = container.querySelector(".node");
      expect(node).toHaveClass("dragging");
    });

    it("does not apply dragging class when isDragging is false", () => {
      const { container } = renderTaskNode({}, { isDragging: false });
      const node = container.querySelector(".node");
      expect(node).not.toHaveClass("dragging");
    });
  });

  describe("combined state", () => {
    it("applies multiple state classes when several are true", () => {
      const { container } = renderTaskNode(
        { category: "ux", status: "in_progress" },
        { isHighlighted: true, isSelected: true }
      );
      const node = container.querySelector(".node");
      expect(node).toHaveClass("node", "highlighted", "selected");
    });
  });

  describe("tooltip", () => {
    it("shows tooltip with full task text when isHovered and task has text", () => {
      const { container } = renderTaskNode(
        { text: "Full task name" },
        { isHovered: true }
      );
      const tooltip = container.querySelector(".tooltip");
      expect(tooltip).toBeInTheDocument();
      const tooltipText = tooltip?.querySelector("text");
      expect(tooltipText?.textContent).toBe("Full task name");
    });

    it("does not show tooltip when not hovered", () => {
      const { container } = renderTaskNode(
        { text: "Some task" },
        { isHovered: false }
      );
      expect(container.querySelector(".tooltip")).not.toBeInTheDocument();
    });

    it("does not show tooltip when task text is empty even if hovered", () => {
      const { container } = renderTaskNode(
        { text: "" },
        { isHovered: true }
      );
      expect(container.querySelector(".tooltip")).not.toBeInTheDocument();
    });
  });

  describe("event handlers", () => {
    it("calls onMouseEnter when mouse enters", () => {
      const onMouseEnter = vi.fn();
      const { container } = renderTaskNode(
        {},
        { onMouseEnter, onMouseLeave: noop }
      );
      const g = container.querySelector("g");
      if (g) fireEvent.mouseEnter(g);
      expect(onMouseEnter).toHaveBeenCalled();
    });

    it("calls onMouseLeave when mouse leaves", () => {
      const onMouseLeave = vi.fn();
      const { container } = renderTaskNode(
        {},
        { onMouseEnter: noop, onMouseLeave }
      );
      const g = container.querySelector("g");
      if (g) fireEvent.mouseLeave(g);
      expect(onMouseLeave).toHaveBeenCalled();
    });

    it("calls onClick when main circle is clicked", async () => {
      const onClick = vi.fn();
      const { container } = renderTaskNode({}, { onClick });
      const node = container.querySelector(".node");
      node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onClick).toHaveBeenCalled();
    });
  });
});
