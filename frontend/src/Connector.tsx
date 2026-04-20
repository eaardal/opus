import "./Connector.css";
import { Task } from "./Sidebar";
import { ConnectorConfig } from "./theme";

interface ConnectorProps {
  fromTask: Task;
  toTask: Task;
  shiftPressed: boolean;
  connector: ConnectorConfig;
  onRemove: (e: React.MouseEvent) => void;
}

const MAX_TOOLTIP_WIDTH = 170;
const CHAR_WIDTH = 8;
const LINE_HEIGHT = 16;
const TOOLTIP_V_PADDING = 8;

// Mirrors wrapLines logic from TaskNode to get accurate tooltip dimensions
function tooltipBounds(task: Task): { cx: number; cy: number; hw: number; hh: number } | null {
  if (!task.text) return null;

  const maxChars = Math.floor(MAX_TOOLTIP_WIDTH / CHAR_WIDTH);
  const words = task.text.split(" ");
  let lines = 1;
  let lineLen = 0;
  for (const word of words) {
    if (word.length > maxChars) {
      if (lineLen > 0) { lines++; lineLen = 0; }
      lines += Math.floor(word.length / maxChars);
      lineLen = word.length % maxChars;
    } else {
      const test = lineLen > 0 ? lineLen + 1 + word.length : word.length;
      if (test > maxChars && lineLen > 0) { lines++; lineLen = word.length; }
      else { lineLen = test; }
    }
  }

  const height = lines * LINE_HEIGHT + TOOLTIP_V_PADDING;
  const width = Math.min(Math.max(task.text.length * CHAR_WIDTH, 80), MAX_TOOLTIP_WIDTH);
  // Tooltip rect sits at translate(0,40) with rect y="-12", so top = task.y + 28
  return { cx: task.x, cy: task.y + 28 + height / 2, hw: width / 2, hh: height / 2 };
}

function getArrowPath(
  fromTask: Task,
  toTask: Task
): { path: string; endX: number; endY: number } {
  const target = tooltipBounds(toTask);
  const targetX = target ? target.cx : toTask.x;
  const targetY = target ? target.cy : toTask.y;

  const dx = targetX - fromTask.x;
  const dy = targetY - fromTask.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { path: "", endX: 0, endY: 0 };

  const ux = dx / len;
  const uy = dy / len;
  const nodeRadius = 25;
  const arrowOffset = 8;

  const startX = fromTask.x + ux * nodeRadius;
  const startY = fromTask.y + uy * nodeRadius;

  let endX: number;
  let endY: number;
  if (target) {
    // Distance from tooltip center to its boundary along the approach direction
    const dBoundary = Math.min(
      Math.abs(ux) > 0 ? target.hw / Math.abs(ux) : Infinity,
      Math.abs(uy) > 0 ? target.hh / Math.abs(uy) : Infinity,
    );
    endX = targetX - ux * (dBoundary + arrowOffset);
    endY = targetY - uy * (dBoundary + arrowOffset);
  } else {
    endX = targetX - ux * (nodeRadius + arrowOffset);
    endY = targetY - uy * (nodeRadius + arrowOffset);
  }

  return { path: `M ${startX} ${startY} L ${endX} ${endY}`, endX, endY };
}

export function Connector({
  fromTask,
  toTask,
  shiftPressed,
  connector,
  onRemove,
}: ConnectorProps) {
  const { path, endX, endY } = getArrowPath(fromTask, toTask);

  return (
    <g className={`connection-group ${shiftPressed ? "shift-active" : ""}`}>
      <path
        d={path}
        stroke={connector.color}
        strokeWidth={connector.strokeWidth}
        fill="none"
        markerEnd="url(#arrowhead)"
        className="connection"
        onClick={onRemove}
      />
      <circle
        cx={endX}
        cy={endY}
        r="12"
        fill="transparent"
        className="connection-target"
        onClick={onRemove}
      />
    </g>
  );
}

interface PendingConnectorProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  connector: ConnectorConfig;
}

export function PendingConnector({
  fromX,
  fromY,
  toX,
  toY,
  connector,
}: PendingConnectorProps) {
  return (
    <line
      x1={fromX}
      y1={fromY}
      x2={toX}
      y2={toY}
      stroke={connector.pendingColor}
      strokeWidth={connector.strokeWidth}
      strokeDasharray={connector.pendingDasharray}
    />
  );
}
