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

function getArrowPath(
  fromTask: Task,
  toTask: Task
): { path: string; endX: number; endY: number } {
  const dx = toTask.x - fromTask.x;
  const dy = toTask.y - fromTask.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { path: "", endX: 0, endY: 0 };

  const nodeRadius = 25;
  const arrowOffset = 8;

  const ux = dx / len;
  const uy = dy / len;

  const startX = fromTask.x + ux * nodeRadius;
  const startY = fromTask.y + uy * nodeRadius;
  const endX = toTask.x - ux * (nodeRadius + arrowOffset);
  const endY = toTask.y - uy * (nodeRadius + arrowOffset);

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
