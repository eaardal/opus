import type { ComponentProps } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Group, TaskStatus } from "../../../domain/tasks/types";
import type { GroupBoxConfig, StatusConfig } from "../theme";
import { GroupRect } from "./GroupRect";

const STATUSES: Record<TaskStatus, StatusConfig> = {
  pending: { label: "Pending", color: "#000", fontColor: "#fff", emoji: "💤" },
  in_progress: { label: "In progress", color: "#000", fontColor: "#fff", emoji: "🛠️" },
  completed: { label: "Done", color: "#000", fontColor: "#fff", emoji: "✅" },
  archived: { label: "Archived", color: "#000", fontColor: "#fff", emoji: "🗄️" },
};

const GROUP_BOX: GroupBoxConfig = {
  allDoneFill: "rgba(0,0,0,0.1)",
  allDoneStroke: "#000",
  progressCompletedFill: "#000",
};

const GROUP: Group = { id: "g1", title: "Group A", x: 0, y: 0, width: 200, height: 120 };

function renderGroup(overrides: Partial<ComponentProps<typeof GroupRect>> = {}) {
  return render(
    <svg>
      <GroupRect
        group={GROUP}
        tasks={[]}
        statuses={STATUSES}
        groupBox={GROUP_BOX}
        isSelected={false}
        isEditing={false}
        panMode={false}
        canvasLocked={false}
        onMouseDown={vi.fn()}
        onSelect={vi.fn()}
        onToggleSelect={vi.fn()}
        onMove={vi.fn()}
        onMoveWithTasks={vi.fn()}
        onMoveStart={vi.fn()}
        onMoveEnd={vi.fn()}
        onResize={vi.fn()}
        onResizeStart={vi.fn()}
        onResizeEnd={vi.fn()}
        onTitleChange={vi.fn()}
        onEditingChange={vi.fn()}
        onZoomTo={vi.fn()}
        onToggleLock={vi.fn()}
        onContextMenu={vi.fn()}
        toSvgCoords={(x, y) => ({ x, y })}
        {...overrides}
      />
    </svg>,
  );
}

describe("GroupRect", () => {
  afterEach(() => {
    // Release the document-level drag listeners the body handler attaches.
    fireEvent.mouseUp(document);
  });

  test("commits an open title editor when the group body is pressed", () => {
    const onEditorBlur = vi.fn();
    const { container } = renderGroup();

    // Stand in for a task/group title editor that is open elsewhere on the
    // canvas. The real editors commit on blur, so blur is the observable signal.
    const editor = document.createElement("textarea");
    editor.addEventListener("blur", onEditorBlur);
    document.body.appendChild(editor);
    editor.focus();
    expect(editor).toHaveFocus();

    const groupBody = container.querySelector(".group-rect");
    if (!groupBody) throw new Error("group body not rendered");
    fireEvent.mouseDown(groupBody);

    expect(editor).not.toHaveFocus();
    expect(onEditorBlur).toHaveBeenCalledTimes(1);

    editor.remove();
  });
});
