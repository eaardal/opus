import "./HelpContent.css";
import type { TaskStatus } from "../../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import { CanvasHelpLegend } from "./CanvasHelpLegend";

interface HelpContentProps {
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
}

/**
 * The shared body of the help surfaces (the "How to Use" modal and the floating
 * panel behind the bottom-right "?"): a keyboard-shortcut reference plus the
 * category/status legend. The surfaces supply their own chrome (header, close,
 * pin); this is the common content so both stay in sync.
 */
export function HelpContent({ categories, statuses }: HelpContentProps) {
  return (
    <>
      <table className="help-table">
        <tbody>
          <tr>
            <td className="help-key">Cmd/Ctrl + Z</td>
            <td>Undo</td>
          </tr>
          <tr>
            <td className="help-key">Cmd/Ctrl + Shift + Z</td>
            <td>Redo</td>
          </tr>
          <tr>
            <td className="help-key">Cmd/Ctrl + Enter</td>
            <td>Add new task</td>
          </tr>
          <tr>
            <td className="help-key">Shift + drag</td>
            <td>Connect nodes</td>
          </tr>
          <tr>
            <td className="help-key">Shift + click connection</td>
            <td>Remove connection</td>
          </tr>
          <tr>
            <td className="help-key">Space + drag</td>
            <td>Pan canvas</td>
          </tr>
          <tr>
            <td className="help-key">Middle mouse + drag</td>
            <td>Pan canvas</td>
          </tr>
          <tr>
            <td className="help-key">Two-finger scroll / scroll wheel</td>
            <td>Pan canvas</td>
          </tr>
          <tr>
            <td className="help-key">Ctrl + scroll / pinch</td>
            <td>Zoom in/out</td>
          </tr>
          <tr>
            <td className="help-key">Alt/Option + hover</td>
            <td>Magnify the task or group under the cursor</td>
          </tr>
          <tr>
            <td className="help-key">Drag on canvas</td>
            <td>Select — node/group must be fully inside the selection area</td>
          </tr>
          <tr>
            <td className="help-key">Cmd/Ctrl + A</td>
            <td>Select all elements</td>
          </tr>
          <tr>
            <td className="help-key">Cmd/Ctrl + C</td>
            <td>Copy selected elements</td>
          </tr>
          <tr>
            <td className="help-key">Cmd/Ctrl + V</td>
            <td>Paste elements (works across projects and workspaces)</td>
          </tr>
          <tr>
            <td className="help-key">Cmd/Ctrl + D</td>
            <td>Duplicate selected elements</td>
          </tr>
          <tr>
            <td className="help-key">Escape</td>
            <td>Clear selection</td>
          </tr>
          <tr>
            <td className="help-key">Double-click group title</td>
            <td>Edit group name</td>
          </tr>
          <tr>
            <td className="help-key">Double-click node tooltip</td>
            <td>Rename node</td>
          </tr>
        </tbody>
      </table>
      <CanvasHelpLegend categories={categories} statuses={statuses} />
    </>
  );
}
