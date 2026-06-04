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
  /** Clear the transient "peek" echo in the parent (called on a canvas-background click). */
  onClearPeek: () => void;
  /**
   * Called when a node or selection drag completes (mouse up). Receives the
   * IDs of all tasks and groups whose positions changed during the drag.
   * Used to fire Firestore writes only at the end of a drag, not per-tick.
   */
  onDragComplete?: (movedTaskIds: string[], movedGroupIds: string[]) => void;
  /**
   * Called when a new connection edge is successfully created via shift-drag.
   * Used to fire a Firestore write for the new connection.
   */
  onConnectionAdded?: (from: string, to: string) => void;
}

export interface UseDragSelectionResult {
  draggingNode: string | null;
  connecting: ConnectingState | null;
  selection: SelectionRect | null;
  selectedNodes: Set<string>;
  selectedGroups: Set<string>;
  /** True while any node or selection drag is in progress. */
  isDragging: boolean;
  handleNodeMouseDown: (e: React.MouseEvent, taskId: string) => void;
  handleGroupMouseDown: (e: React.MouseEvent, groupId: string) => void;
  handleCanvasMouseDown: (e: React.MouseEvent, svgEl: SVGSVGElement | null) => void;
  handleCanvasMouseMove: (e: React.MouseEvent, coords: { x: number; y: number }) => void;
  handleCanvasMouseUp: (e: React.MouseEvent, coords: { x: number; y: number }) => void;
  clearSelection: () => void;
  selectElements: (taskIds: ReadonlySet<string>, groupIds: ReadonlySet<string>) => void;
  /** Add or remove a single group from the current selection (shift/cmd-click). */
  toggleGroupSelection: (groupId: string) => void;
}

const NODE_HIT_RADIUS = 25;
const CONNECTION_DROP_RADIUS = 30;
// Pointer travel (screen px) under which a shift-press on a node counts as a
// click (toggles selection) rather than a drag (creates a connection).
const SHIFT_CLICK_MAX_TRAVEL = 4;

export function useDragSelection({
  present,
  push,
  replace,
  getSvgCoords,
  onClearPeek,
  onDragComplete,
  onConnectionAdded,
}: UseDragSelectionArgs): UseDragSelectionResult {
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [draggingSelection, setDraggingSelection] = useState<DraggingSelection | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const presentRef = useRef(present);
  presentRef.current = present;
  const selectedNodesRef = useRef(selectedNodes);
  selectedNodesRef.current = selectedNodes;
  const selectedGroupsRef = useRef(selectedGroups);
  selectedGroupsRef.current = selectedGroups;
  const draggingNodeRef = useRef(draggingNode);
  draggingNodeRef.current = draggingNode;
  const draggingSelectionRef = useRef(draggingSelection);
  draggingSelectionRef.current = draggingSelection;
  const onDragCompleteRef = useRef(onDragComplete);
  onDragCompleteRef.current = onDragComplete;
  const onConnectionAddedRef = useRef(onConnectionAdded);
  onConnectionAddedRef.current = onConnectionAdded;
  // Screen-space origin of a shift-press, used at mouse-up to tell a shift-click
  // (toggle selection) apart from a shift-drag (create a connection).
  const connectStartClientRef = useRef<{ x: number; y: number } | null>(null);

  const isDragging = draggingNode !== null || draggingSelection !== null;

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
        connectStartClientRef.current = { x: e.clientX, y: e.clientY };
        setConnecting({ from: taskId, mouseX: coords.x, mouseY: coords.y });
      } else if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedNodesRef.current);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        setSelectedNodes(next);
      } else if (selectedNodesRef.current.has(taskId)) {
        push(presentRef.current);
        startSelectionDrag(coords);
      } else {
        setSelectedNodes(new Set([taskId]));
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
      if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedGroupsRef.current);
        if (next.has(groupId)) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }
        setSelectedGroups(next);
      } else if (selectedGroupsRef.current.has(groupId)) {
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
      onClearPeek();
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
    [getSvgCoords, onClearPeek],
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
    (e: React.MouseEvent, coords: { x: number; y: number }) => {
      const current = presentRef.current;

      if (connecting) {
        const startClient = connectStartClientRef.current;
        connectStartClientRef.current = null;
        const travel = startClient
          ? Math.hypot(e.clientX - startClient.x, e.clientY - startClient.y)
          : Number.POSITIVE_INFINITY;

        if (travel < SHIFT_CLICK_MAX_TRAVEL) {
          // Shift-click without a drag: toggle the origin node in the selection.
          const next = new Set(selectedNodesRef.current);
          if (next.has(connecting.from)) next.delete(connecting.from);
          else next.add(connecting.from);
          setSelectedNodes(next);
        } else {
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
              onConnectionAddedRef.current?.(connecting.from, targetTask.id);
            }
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

      // Fire drag-complete callback with IDs of moved entities.
      const activeDraggingNode = draggingNodeRef.current;
      const activeDraggingSelection = draggingSelectionRef.current;
      if (activeDraggingNode) {
        onDragCompleteRef.current?.([activeDraggingNode], []);
      } else if (activeDraggingSelection) {
        onDragCompleteRef.current?.(
          Array.from(activeDraggingSelection.nodePositions.keys()),
          Array.from(activeDraggingSelection.groupPositions.keys()),
        );
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

  const selectElements = useCallback(
    (taskIds: ReadonlySet<string>, groupIds: ReadonlySet<string>) => {
      setSelectedNodes(new Set(taskIds));
      setSelectedGroups(new Set(groupIds));
      setSelection(null);
      setDraggingSelection(null);
    },
    [],
  );

  const toggleGroupSelection = useCallback((groupId: string) => {
    const next = new Set(selectedGroupsRef.current);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setSelectedGroups(next);
  }, []);

  return {
    draggingNode,
    connecting,
    selection,
    selectedNodes,
    selectedGroups,
    isDragging,
    handleNodeMouseDown,
    handleGroupMouseDown,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    clearSelection,
    selectElements,
    toggleGroupSelection,
  };
}
