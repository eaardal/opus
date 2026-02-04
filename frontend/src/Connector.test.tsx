import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Connector, PendingConnector } from "./Connector";
import type { Task } from "./Sidebar";

const baseFromTask: Task = {
  id: "from",
  text: "From task",
  x: 0,
  y: 0,
  status: "pending",
};

const baseToTask: Task = {
  id: "to",
  text: "To task",
  x: 100,
  y: 0,
  status: "pending",
};

const noop = () => {};

describe("Connector", () => {
  describe("structure and rendering", () => {
    it("renders connection group with path and target circle", () => {
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={baseFromTask}
            toTask={baseToTask}
            shiftPressed={false}
            onRemove={noop}
          />
        </svg>
      );
      const group = container.querySelector(".connection-group");
      expect(group).toBeInTheDocument();
      expect(container.querySelector(".connection")).toBeInTheDocument();
      expect(container.querySelector(".connection-target")).toBeInTheDocument();
    });

    it("renders path with M and L (line from start to end)", () => {
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={baseFromTask}
            toTask={baseToTask}
            shiftPressed={false}
            onRemove={noop}
          />
        </svg>
      );
      const path = container.querySelector(".connection") as SVGPathElement;
      expect(path).toHaveAttribute("d");
      const d = path.getAttribute("d") ?? "";
      expect(d).toMatch(/^M\s/);
      expect(d).toContain(" L ");
    });

    it("path has arrowhead marker and stroke", () => {
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={baseFromTask}
            toTask={baseToTask}
            shiftPressed={false}
            onRemove={noop}
          />
        </svg>
      );
      const path = container.querySelector(".connection") as SVGPathElement;
      const markerEnd = path.getAttribute("markerEnd") ?? path.getAttribute("marker-end");
      expect(markerEnd).toBe("url(#arrowhead)");
      expect(path).toHaveAttribute("stroke", "#666");
      const strokeWidth = path.getAttribute("strokeWidth") ?? path.getAttribute("stroke-width");
      expect(strokeWidth).toBe("2");
      expect(path).toHaveAttribute("fill", "none");
    });
  });

  describe("shift-active state", () => {
    it("applies shift-active class when shiftPressed is true", () => {
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={baseFromTask}
            toTask={baseToTask}
            shiftPressed={true}
            onRemove={noop}
          />
        </svg>
      );
      const group = container.querySelector(".connection-group");
      expect(group).toHaveClass("shift-active");
    });

    it("does not apply shift-active class when shiftPressed is false", () => {
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={baseFromTask}
            toTask={baseToTask}
            shiftPressed={false}
            onRemove={noop}
          />
        </svg>
      );
      const group = container.querySelector(".connection-group");
      expect(group).not.toHaveClass("shift-active");
    });
  });

  describe("path geometry", () => {
    it("path starts near fromTask and ends near toTask", () => {
      const from = { ...baseFromTask, x: 50, y: 50 };
      const to = { ...baseToTask, x: 150, y: 50 };
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={from}
            toTask={to}
            shiftPressed={false}
            onRemove={noop}
          />
        </svg>
      );
      const path = container.querySelector(".connection") as SVGPathElement;
      const d = path.getAttribute("d") ?? "";
      expect(d).toMatch(/^M\s[\d.]+\s50\s+L\s[\d.]+\s50/);
    });

    it("connection-target circle is at path end", () => {
      const from = { ...baseFromTask, x: 0, y: 0 };
      const to = { ...baseToTask, x: 100, y: 0 };
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={from}
            toTask={to}
            shiftPressed={false}
            onRemove={noop}
          />
        </svg>
      );
      const circle = container.querySelector(".connection-target") as SVGCircleElement;
      expect(circle).toHaveAttribute("r", "12");
      expect(circle).toHaveAttribute("fill", "transparent");
      expect(Number(circle.getAttribute("cx"))).toBeCloseTo(67, 0);
      expect(Number(circle.getAttribute("cy"))).toBe(0);
    });
  });

  describe("event handlers", () => {
    it("calls onRemove when connection path is clicked", () => {
      const onRemove = vi.fn();
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={baseFromTask}
            toTask={baseToTask}
            shiftPressed={false}
            onRemove={onRemove}
          />
        </svg>
      );
      const path = container.querySelector(".connection");
      path?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onRemove).toHaveBeenCalled();
    });

    it("calls onRemove when connection-target is clicked", () => {
      const onRemove = vi.fn();
      const { container } = render(
        <svg>
          <defs>
            <marker id="arrowhead" />
          </defs>
          <Connector
            fromTask={baseFromTask}
            toTask={baseToTask}
            shiftPressed={false}
            onRemove={onRemove}
          />
        </svg>
      );
      const target = container.querySelector(".connection-target");
      target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onRemove).toHaveBeenCalled();
    });
  });
});

describe("PendingConnector", () => {
  it("renders a dashed line from (fromX, fromY) to (toX, toY)", () => {
    const { container } = render(
      <svg>
        <PendingConnector fromX={10} fromY={20} toX={110} toY={120} />
      </svg>
    );
    const line = container.querySelector("line");
    expect(line).toBeInTheDocument();
    expect(line).toHaveAttribute("x1", "10");
    expect(line).toHaveAttribute("y1", "20");
    expect(line).toHaveAttribute("x2", "110");
    expect(line).toHaveAttribute("y2", "120");
    expect(line).toHaveAttribute("stroke", "#999");
    const strokeWidth = line?.getAttribute("strokeWidth") ?? line?.getAttribute("stroke-width");
    expect(strokeWidth).toBe("2");
    const strokeDasharray = line?.getAttribute("strokeDasharray") ?? line?.getAttribute("stroke-dasharray");
    expect(strokeDasharray).toBe("5,5");
  });
});
