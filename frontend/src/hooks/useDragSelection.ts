import { useCallback, useRef, useState } from "react";
import {
  addConnectionIfNew,
  selectEntitiesInRect,
  translateEntities,
  updateTask,
} from "../domain/tasks/operations";
import type { TaskGraphState } from "../domain/tasks/types";

interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface ConnectingState {
  from: string;
  mouseX: number;
  mouseY: number;
}

interface DraggingSelection {
  startX: number;
  startY: number;
  nodePositions: Map<string, { x: number; y: number }>;
  groupPositions: Map<string, { x: number; y: number }>;
}

interface UseDragSelectionArgs {
  /** Current graph state. The hook keeps an internal ref so handlers always
   *  see the freshest value, regardless of when they were last bound. */
  present: TaskGraphState;
  /** Append a new history entry. Called at the start of a drag (so undo
   *  rolls back to pre-drag) and on connection-create. */
  push: (state: TaskGraphState) => void;
  /** Overwrite the current history entry. Called continuously during a drag. */
  replace: (state: TaskGraphState) => void;
  /** Map a React.MouseEvent to SVG user-space coordinates. */
  getSvgCoords: (e: React.MouseEvent) => { x: number; y: number };
  /** Clear the "highlighted task" state in the parent (called on canvas click). */
  onClearHighlight: () => void;
}

export interface UseDragSelectionResult {
  draggingNode: string | null;
  connecting: ConnectingState | null;
  selection: SelectionRect | null;
  selectedNodes: Set<string>;
  selectedGroups: Set<string>;
  handleNodeMouseDown: (e: React.MouseEvent, taskId: string) => void;
  handleGroupMouseDown: (e: React.MouseEvent, groupId: string) => void;
  handleCanvasMouseDown: (e: React.MouseEvent, svgEl: SVGSVGElement | null) => void;
  handleCanvasMouseMove: (e: React.MouseEvent, coords: { x: number; y: number }) => void;
  handleCanvasMouseUp: (e: React.MouseEvent, coords: { x: number; y: number }) => void;
  clearSelection: () => void;
}

const NODE_HIT_RADIUS = 25;
const CONNECTION_DROP_RADIUS = 30;

export function useDragSelection({
  present,
  push,
  replace,
  getSvgCoords,
  onClearHighlight,
}: UseDragSelectionArgs): UseDragSelectionResult {
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [draggingSelection, setDraggingSelection] = useState<DraggingSelection | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // Refs let the handlers read the latest values without listing them in
  // useCallback dependency arrays (which would cause re-binding on every
  // render and detach event listeners mid-drag).
  const presentRef = useRef(present);
  presentRef.current = present;
  const selectedNodesRef = useRef(selectedNodes);
  selectedNodesRef.current = selectedNodes;
  const selectedGroupsRef = useRef(selectedGroups);
  selectedGroupsRef.current = selectedGroups;

  const startSelectionDrag = useCallback((coords: { x: number; y: number }) => {
    const { tasks, groups } = presentRef.current;
    const nodePositions = new Map<string, { x: number; y: number }>();
    for (const t of tasks) {
      if (selectedNodesRef.current.has(t.id)) {
        nodePositions.set(t.id, { x: t.x, y: t.y });
      }
    }
    const groupPositions = new Map<string, { x: number; y: number }>();
    for (const g of groups) {
      if (selectedGroupsRef.current.has(g.id)) {
        groupPositions.set(g.id, { x: g.x, y: g.y });
      }
    }
    setDraggingSelection({ startX: coords.x, startY: coords.y, nodePositions, groupPositions });
  }, []);

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const coords = getSvgCoords(e);
      if (e.shiftKey) {
        setConnecting({ from: taskId, mouseX: coords.x, mouseY: coords.y });
      } else if (selectedNodesRef.current.has(taskId)) {
        push(presentRef.current);
        startSelectionDrag(coords);
      } else {
        setSelectedNodes(new Set());
        push(presentRef.current);
        setDraggingNode(taskId);
      }
    },
    [getSvgCoords, push, startSelectionDrag],
  );

  const handleGroupMouseDown = useCallback(
    (e: React.MouseEvent, groupId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const coords = getSvgCoords(e);
      if (selectedGroupsRef.current.has(groupId)) {
        push(presentRef.current);
        startSelectionDrag(coords);
      }
    },
    [getSvgCoords, push, startSelectionDrag],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent, svgEl: SVGSVGElement | null) => {
      if (e.target !== svgEl) return;
      const coords = getSvgCoords(e);
      onClearHighlight();
      if (selectedNodesRef.current.size > 0 || selectedGroupsRef.current.size > 0) {
        const clickedOnSelected = presentRef.current.tasks.some((t) => {
          if (!selectedNodesRef.current.has(t.id)) return false;
          const dx = t.x - coords.x;
          const dy = t.y - coords.y;
          return Math.sqrt(dx * dx + dy * dy) < NODE_HIT_RADIUS;
        });
        if (!clickedOnSelected) {
          setSelectedNodes(new Set());
          setSelectedGroups(new Set());
        }
      }
      setSelection({
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
      });
    },
    [getSvgCoords, onClearHighlight],
  );

  const handleCanvasMouseMove = useCallback(
    (_e: React.MouseEvent, coords: { x: number; y: number }) => {
      const current = presentRef.current;
      if (draggingNode) {
        replace({
          tasks: updateTask(current.tasks, draggingNode, { x: coords.x, y: coords.y }),
          connections: current.connections,
          groups: current.groups,
        });
      } else if (connecting) {
        setConnecting({ ...connecting, mouseX: coords.x, mouseY: coords.y });
      } else if (selection) {
        setSelection({ ...selection, currentX: coords.x, currentY: coords.y });
      } else if (draggingSelection) {
        const { tasks: nextTasks, groups: nextGroups } = translateEntities({
          tasks: current.tasks,
          groups: current.groups,
          taskOrigins: draggingSelection.nodePositions,
          groupOrigins: draggingSelection.groupPositions,
          dx: coords.x - draggingSelection.startX,
          dy: coords.y - draggingSelection.startY,
        });
        replace({ tasks: nextTasks, connections: current.connections, groups: nextGroups });
      }
    },
    [draggingNode, connecting, selection, draggingSelection, replace],
  );

  const handleCanvasMouseUp = useCallback(
    (_e: React.MouseEvent, coords: { x: number; y: number }) => {
      const current = presentRef.current;

      if (connecting) {
        const targetTask = current.tasks.find((t) => {
          const dx = t.x - coords.x;
          const dy = t.y - coords.y;
          return Math.sqrt(dx * dx + dy * dy) < CONNECTION_DROP_RADIUS;
        });
        if (targetTask && targetTask.id !== connecting.from) {
          const nextConnections = addConnectionIfNew(current.connections, {
            from: connecting.from,
            to: targetTask.id,
          });
          if (nextConnections !== current.connections) {
            push({
              tasks: current.tasks,
              connections: nextConnections,
              groups: current.groups,
            });
          }
        }
      }

      if (selection) {
        const { taskIds, groupIds } = selectEntitiesInRect({
          rect: selection,
          tasks: current.tasks,
          groups: current.groups,
          nodeRadius: NODE_HIT_RADIUS,
        });
        setSelectedNodes(taskIds);
        setSelectedGroups(groupIds);
      }

      setDraggingNode(null);
      setConnecting(null);
      setSelection(null);
      setDraggingSelection(null);
    },
    [connecting, selection, push],
  );

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Set());
    setSelectedGroups(new Set());
    setSelection(null);
    setDraggingSelection(null);
  }, []);

  return {
    draggingNode,
    connecting,
    selection,
    selectedNodes,
    selectedGroups,
    handleNodeMouseDown,
    handleGroupMouseDown,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    clearSelection,
  };
}
