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
            <td>Undo</td>
            <td className="help-key">Cmd/Ctrl + Z</td>
          </tr>
          <tr>
            <td>Redo</td>
            <td className="help-key">Cmd/Ctrl + Shift + Z</td>
          </tr>
          <tr>
            <td>Add new task</td>
            <td className="help-key">Cmd/Ctrl + Enter</td>
          </tr>
          <tr>
            <td>Connect nodes</td>
            <td className="help-key">Shift + drag</td>
          </tr>
          <tr>
            <td>Remove connection</td>
            <td className="help-key">Shift + click connection</td>
          </tr>
          <tr>
            <td>Pan canvas</td>
            <td className="help-key">Space + drag</td>
          </tr>
          <tr>
            <td>Pan canvas</td>
            <td className="help-key">Middle mouse + drag</td>
          </tr>
          <tr>
            <td>Pan canvas</td>
            <td className="help-key">Two-finger scroll / scroll wheel</td>
          </tr>
          <tr>
            <td>Zoom in/out</td>
            <td className="help-key">Cmd/Ctrl + scroll / pinch</td>
          </tr>
          <tr>
            <td>Magnify the task or group under the cursor</td>
            <td className="help-key">Alt/Option + hover</td>
          </tr>
          <tr>
            <td>Select — node/group must be fully inside the selection area</td>
            <td className="help-key">Drag on canvas</td>
          </tr>
          <tr>
            <td>Select all elements</td>
            <td className="help-key">Cmd/Ctrl + A</td>
          </tr>
          <tr>
            <td>Copy selected elements</td>
            <td className="help-key">Cmd/Ctrl + C</td>
          </tr>
          <tr>
            <td>Paste elements (works across projects and workspaces)</td>
            <td className="help-key">Cmd/Ctrl + V</td>
          </tr>
          <tr>
            <td>Duplicate selected elements</td>
            <td className="help-key">Cmd/Ctrl + D</td>
          </tr>
          <tr>
            <td>Clear selection</td>
            <td className="help-key">Escape</td>
          </tr>
          <tr>
            <td>Edit group name</td>
            <td className="help-key">Double-click group title</td>
          </tr>
          <tr>
            <td>Rename node</td>
            <td className="help-key">Double-click node tooltip</td>
          </tr>
        </tbody>
      </table>
      <CanvasHelpLegend categories={categories} statuses={statuses} />
    </>
  );
}
