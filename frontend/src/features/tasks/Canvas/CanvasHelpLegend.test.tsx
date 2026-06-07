import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { TaskStatus } from "../../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import { CanvasHelpLegend } from "./CanvasHelpLegend";

const CATEGORIES: Record<string, CategoryConfig> = {
  backend: { label: "Backend", color: "#9dcbef", shape: "circle" },
  business: { label: "Business", color: "#90ede4", shape: "triangle" },
  milestone: { label: "Milestone", color: "#f5f5f5", shape: "diamond" },
};

const STATUSES: Record<TaskStatus, StatusConfig> = {
  pending: { label: "Pending", color: "#000", fontColor: "#fff", emoji: "💤" },
  in_progress: { label: "In progress", color: "#000", fontColor: "#fff", emoji: "🛠️" },
  blocked: { label: "Blocked", color: "#000", fontColor: "#fff", emoji: "🚫" },
  completed: { label: "Done", color: "#000", fontColor: "#fff", emoji: "✅" },
  archived: { label: "Archived", color: "#000", fontColor: "#fff", emoji: "🗄️" },
};

describe("CanvasHelpLegend", () => {
  test("explains what each category shape means", () => {
    render(<CanvasHelpLegend categories={CATEGORIES} statuses={STATUSES} />);

    expect(screen.getByText("Tasks local to the team")).toBeInTheDocument();
    expect(screen.getByText("Tasks external to the team")).toBeInTheDocument();
    expect(screen.getByText("Gates/Checkpoints")).toBeInTheDocument();
  });
});
