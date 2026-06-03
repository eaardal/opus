import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { TaskStatus } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import type { StatusConfig } from "../theme";
import { PresentationBar } from "./PresentationBar";

const STATUSES: Record<TaskStatus, StatusConfig> = {
  pending: { label: "Pending", color: "#000", fontColor: "#fff", emoji: "💤" },
  in_progress: { label: "In progress", color: "#000", fontColor: "#fff", emoji: "🛠️" },
  completed: { label: "Done", color: "#000", fontColor: "#fff", emoji: "✅" },
  archived: { label: "Archived", color: "#000", fontColor: "#fff", emoji: "🗄️" },
};

const ALICE: Person = { id: "p1", name: "Alice", picture: null };

function renderBar() {
  return render(
    <PresentationBar
      people={[ALICE]}
      statuses={STATUSES}
      selectedPersonId={null}
      statusFilter="all"
      currentIndex={0}
      taskCountsByPerson={{ p1: 2 }}
      onSelectPerson={vi.fn()}
      onSelectStatus={vi.fn()}
      onAdvance={vi.fn()}
    />,
  );
}

describe("PresentationBar", () => {
  test("renders a Presentation mode heading while expanded", () => {
    renderBar();

    expect(screen.getByText(/presentation mode/i)).toBeInTheDocument();
  });

  test("hides the heading when collapsed", () => {
    renderBar();

    fireEvent.click(screen.getByLabelText("Collapse presentation bar"));

    expect(screen.queryByText(/presentation mode/i)).not.toBeInTheDocument();
  });
});
