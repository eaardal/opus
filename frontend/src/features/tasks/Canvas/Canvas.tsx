import {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  useEffect,
} from "react";
import "./Canvas.css";
import { HelpCircle, Pin } from "lucide-react";
import type { Task, Group, TaskStatus } from "../../../domain/tasks/types";
import { Connector, PendingConnector } from "./Connector";
import { TaskNode } from "./TaskNode";
import { ProgressBar } from "./ProgressBar";
import { type CategoryConfig, type StatusConfig, getConnector, getGroupBox } from "../theme";
import { GroupRect } from "./GroupRect";
import type { Person } from "../../../domain/teams/types";
import { PresentationBar } from "./PresentationBar";
import { CanvasActionBar } from "./CanvasActionBar";
import { HelpContent } from "./HelpContent";
import type { StatusFilter } from "./StatusFilterSelect";
import {
  hasTasksWithAssignedPeople,
  peopleWithAssignedTasks,
  taskCountsByPerson,
  tasksAssignedToPerson,
} from "../../../domain/tasks/assignments";
import { TaskContextMenu } from "../TaskContextMenu";
import { TaskQueuePanel } from "../TaskQueuePanel/TaskQueuePanel";
import { TimelinePanel } from "../TimelinePanel/TimelinePanel";
import { MagnifiedTaskOverlay } from "./MagnifiedTaskOverlay";
import { MagnifiedGroupOverlay } from "./MagnifiedGroupOverlay";
import { findOwningGroup } from "../../../domain/tasks/groupGeometry";
import { SettingsDialog, type AppSettings, loadSettings } from "../SettingsDialog";
import { toSvgCoords as toSvgCoordsPure } from "../../../lib/svgCoords";
import { centerViewBoxOnPoint, fitViewBoxToContent } from "../../../domain/tasks/viewport";
import { exportSvgElementAsPng } from "../../../domain/tasks/exportCanvasAsPng";
import type { Connection, ViewBox } from "../../../domain/tasks/types";
import { useCanvasPan } from "../../../hooks/useCanvasPan";
import { useViewBoxAnimation } from "../../../hooks/useViewBoxAnimation";
import { useDismissOnOutside } from "../../../hooks/useDismissOnOutside";
import { useWorkspaceRole } from "../../workspace/WorkspaceRoleContext";

// Width (in canvas units) of the viewport when presentation mode focuses a task.
// Semi-close: the task is comfortably visible with surrounding context, not
// filling the whole viewport. Tasks render ~60 units wide.
const PRESENTATION_VIEW_WIDTH = 600;

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

export interface CanvasHandle {
  getSvgCoords: (e: React.MouseEvent) => { x: number; y: number };
  clientToSvgCoords: (clientX: number, clientY: number) => { x: number; y: number };
  getSvgElement: () => SVGSVGElement | null;
  exportAsPng: () => void;
  openSettings: () => void;
  openHelp: () => void;
}

interface CanvasProps {
  tasks: Task[];
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  connections: Connection[];
  draggingNode: string | null;
  connecting: ConnectingState | null;
  shiftPressed: boolean;
  hoveredNode: string | null;
  peekedTaskId: string | null;
  editingNodeId: string | null;
  selectedNodes: Set<string>;
  selection: SelectionRect | null;
  onMouseDown: (e: React.MouseEvent, svgElement: SVGSVGElement | null) => void;
  onMouseMove: (e: React.MouseEvent, coords: { x: number; y: number }) => void;
  onMouseUp: (e: React.MouseEvent, coords: { x: number; y: number }) => void;
  onNodeMouseDown: (e: React.MouseEvent, taskId: string) => void;
  onNodeClick: (taskId: string) => void;
  onNodeHover: (taskId: string | null) => void;
  onEditingNodeChange: (taskId: string | null) => void;
  onRemoveConnection: (e: React.MouseEvent, from: string, to: string) => void;
  groups: Group[];
  selectedGroups: Set<string>;
  editingGroupId: string | null;
  onGroupMouseDown: (e: React.MouseEvent, groupId: string) => void;
  onGroupMove: (id: string, x: number, y: number) => void;
  onGroupMoveWithTasks: (id: string, x: number, y: number, taskIds: ReadonlySet<string>) => void;
  onGroupMoveStart: () => void;
  onGroupMoveEnd: (id: string, movedTaskIds: ReadonlySet<string>) => void;
  onGroupResize: (id: string, x: number, y: number, width: number, height: number) => void;
  onGroupResizeStart: () => void;
  onGroupResizeEnd: (id: string) => void;
  onGroupTitleChange: (id: string, title: string) => void;
  onEditingGroupChange: (id: string | null) => void;
  onGroupZoomTo: (id: string) => void;
  onGroupToggleLock: (id: string) => void;
  onGroupDelete: (id: string) => void;
  people: Person[];
  onAssignPeople: (taskId: string, personIds: string[]) => void;
  onAssignPersonAndSetInProgress: (taskId: string, personId: string) => void;
  viewBox: ViewBox;
  onViewBoxChange: (vb: ViewBox) => void;
  onSetTaskStatus: (id: string, status: TaskStatus) => void;
  onSetTaskCategory: (id: string, category: string | undefined) => void;
  onDuplicateTask: (id: string) => void;
  onCopyTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteSelected: () => void;
  onCopySelected: () => void;
  onUpdateTaskText: (id: string, text: string) => void;
  onCreateTaskAt: (x: number, y: number) => void;
  onCreateGroupAt: (x: number, y: number) => void;
  /** Pastes clipboard content. With a target point (right-click paste) the
      content lands at that canvas position; without one it follows the
      viewport-centred Cmd/Ctrl+V behaviour. */
  onPaste: (targetPoint?: { x: number; y: number }) => void;
  /** Resolves true when the system clipboard holds Domino-valid canvas content.
      Used to enable/disable the canvas Paste menu item. */
  onCheckPasteAvailable: () => Promise<boolean>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Select a single task and centre the canvas on it (from panels/navigation). */
  onSelectTask: (taskId: string) => void;
  /** Select a single group as the sole selection (plain click on a group body). */
  onSelectGroup: (groupId: string) => void;
  /** Toggle a single group in the multi-selection (shift-click on a group body). */
  onToggleGroupSelect: (groupId: string) => void;
  /**
   * When true, fit all content into the viewport once after mount — used on the
   * first-ever open of a project that already has content, so the user lands on
   * a sensible framing instead of the default origin view.
   */
  autoFitOnLoad: boolean;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  {
    tasks,
    categories,
    statuses,
    connections,
    draggingNode,
    connecting,
    shiftPressed,
    hoveredNode,
    peekedTaskId,
    editingNodeId,
    selectedNodes,
    selection,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onNodeMouseDown,
    onNodeClick,
    onNodeHover,
    onEditingNodeChange,
    onRemoveConnection,
    groups,
    selectedGroups,
    editingGroupId,
    onGroupMouseDown,
    onGroupMove,
    onGroupMoveWithTasks,
    onGroupMoveStart,
    onGroupMoveEnd,
    onGroupResize,
    onGroupResizeStart,
    onGroupResizeEnd,
    onGroupTitleChange,
    onEditingGroupChange,
    onGroupZoomTo,
    onGroupToggleLock,
    onGroupDelete,
    people,
    onAssignPeople,
    onAssignPersonAndSetInProgress,
    viewBox,
    onViewBoxChange,
    onSetTaskStatus,
    onSetTaskCategory,
    onDuplicateTask,
    onCopyTask,
    onDeleteTask,
    onDeleteSelected,
    onCopySelected,
    onUpdateTaskText,
    onCreateTaskAt,
    onCreateGroupAt,
    onPaste,
    onCheckPasteAvailable,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onSelectTask,
    onSelectGroup,
    onToggleGroupSelect,
    autoFitOnLoad,
  },
  ref,
) {
  const groupBox = getGroupBox();
  const connector = getConnector();

  const svgRef = useRef<SVGSVGElement>(null);
  const groupContextMenuRef = useRef<HTMLDivElement>(null);
  const canvasContextMenuRef = useRef<HTMLDivElement>(null);
  const multiSelectionContextMenuRef = useRef<HTMLDivElement>(null);
  const [canvasLocked, setCanvasLocked] = useState(false);
  // Magnifier: enlarges the hovered task in a read-only overlay. The toolbar
  // toggle makes it always-on; otherwise it activates while Alt/Option is held.
  const [magnifyEnabled, setMagnifyEnabled] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  // While magnifying, the cursor position in canvas-container pixels, so the
  // magnifier panel can trail the pointer instead of pinning to the element.
  const [magnifierCursor, setMagnifierCursor] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isTaskQueueOpen, setIsTaskQueueOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    taskId: string;
    x: number;
    y: number;
  } | null>(null);
  const [multiSelectionContextMenu, setMultiSelectionContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [groupContextMenu, setGroupContextMenu] = useState<{
    groupId: string;
    x: number;
    y: number;
    svgX: number;
    svgY: number;
  } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{
    screenX: number;
    screenY: number;
    svgX: number;
    svgY: number;
  } | null>(null);
  // Whether the clipboard currently holds Domino-valid content. Refreshed each
  // time the canvas context menu opens, since the clipboard read is async.
  const [canPaste, setCanPaste] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  const { role } = useWorkspaceRole();
  const isViewerOnly = role === "viewer";
  const [isHelpPanelPinned, setIsHelpPanelPinned] = useState(false);
  const helpPanelRef = useRef<HTMLDivElement>(null);
  const viewBoxInitialized = useRef(false);

  const { panMode, panning, tryStartPan, tryUpdatePan, tryEndPan } = useCanvasPan({
    svgRef,
    viewBox,
    onViewBoxChange,
    scrollToPan: settings.scrollToPan,
  });

  // Track Alt/Option for the hold-to-magnify gesture.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltHeld(false);
    };
    const onBlur = () => setAltHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Initialize viewBox dimensions from container size if not yet set
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || viewBoxInitialized.current) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (viewBox.width === 0 && viewBox.height === 0) {
        onViewBoxChange({ ...viewBox, width: rect.width, height: rect.height });
      }
      viewBoxInitialized.current = true;
    }
  });

  useDismissOnOutside(groupContextMenuRef, () => setGroupContextMenu(null), !!groupContextMenu);

  useDismissOnOutside(canvasContextMenuRef, () => setCanvasContextMenu(null), !!canvasContextMenu);

  useEffect(() => {
    if (!canvasContextMenu) {
      setCanPaste(false);
      return;
    }
    let cancelled = false;
    onCheckPasteAvailable().then((available) => {
      if (!cancelled) setCanPaste(available);
    });
    return () => {
      cancelled = true;
    };
  }, [canvasContextMenu, onCheckPasteAvailable]);

  useDismissOnOutside(
    multiSelectionContextMenuRef,
    () => setMultiSelectionContextMenu(null),
    !!multiSelectionContextMenu,
  );

  // Escape closes the Task Queue / Timeline panel while one is open. Skips events
  // from editable targets (mirroring the global shortcuts) so Escape inside a
  // panel's own field — e.g. the task picker — is left to that field.
  useEffect(() => {
    if (!isTaskQueueOpen && !isTimelineOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      setIsTaskQueueOpen(false);
      setIsTimelineOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isTaskQueueOpen, isTimelineOpen]);

  useDismissOnOutside(
    helpPanelRef,
    () => setShowHelpPanel(false),
    showHelpPanel && !isHelpPanelPinned,
    {
      closeOnEscape: false,
    },
  );

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectedNodes.size > 1 && selectedNodes.has(taskId)) {
        setMultiSelectionContextMenu({ x: e.clientX, y: e.clientY });
      } else {
        setNodeContextMenu({ taskId, x: e.clientX, y: e.clientY });
      }
    },
    [selectedNodes],
  );

  const toSvgCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } =>
      svgRef.current ? toSvgCoordsPure(svgRef.current, clientX, clientY) : { x: 0, y: 0 },
    [],
  );

  const getSvgCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => toSvgCoords(e.clientX, e.clientY),
    [toSvgCoords],
  );

  useImperativeHandle(ref, () => ({
    getSvgCoords,
    clientToSvgCoords: toSvgCoords,
    getSvgElement: () => svgRef.current,
    exportAsPng: () => {
      void exportCanvasAsPng();
    },
    openSettings: () => setShowSettings(true),
    openHelp: () => setShowHelp(true),
  }));

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.target !== svgRef.current) return;
      e.preventDefault();
      const coords = getSvgCoords(e);
      setCanvasContextMenu({
        screenX: e.clientX,
        screenY: e.clientY,
        svgX: coords.x,
        svgY: coords.y,
      });
    },
    [getSvgCoords],
  );

  // The magnifier is on while the toolbar toggle is set or Alt/Option is held,
  // but never during a drag, a connection drag, or panning.
  const magnifyActive =
    (magnifyEnabled || altHeld) && draggingNode === null && connecting === null && !panMode;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tryStartPan(e)) return;
    onMouseDown(e, svgRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tryUpdatePan(e)) return;
    if (magnifyActive && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setMagnifierCursor({ left: e.clientX - rect.left, top: e.clientY - rect.top });
    }
    onMouseMove(e, getSvgCoords(e));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (tryEndPan(e)) return;
    onMouseUp(e, getSvgCoords(e));
  };

  const exportCanvasAsPng = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const computedRoot = getComputedStyle(document.documentElement);
      const bgColor = computedRoot.getPropertyValue("--bg-primary").trim();
      await exportSvgElementAsPng({
        svg,
        filename: "canvas.png",
        getCssValue: (name) => computedRoot.getPropertyValue(name),
        fontFamily: getComputedStyle(document.body).fontFamily,
        backgroundColor: bgColor || "#0f0f1a",
      });
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, []);

  const fitToScreen = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    onViewBoxChange(
      fitViewBoxToContent(
        tasks.map((t) => ({ x: t.x, y: t.y })),
        groups.map((g) => ({ x: g.x, y: g.y, width: g.width, height: g.height })),
        { width: rect.width, height: rect.height },
        60,
      ),
    );
  }, [tasks, groups, onViewBoxChange]);

  const resetZoom = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    onViewBoxChange({ x: 0, y: 0, width: rect.width, height: rect.height });
  }, [onViewBoxChange]);

  // First-open auto-fit: when a project that already has content is opened for
  // the first time (no persisted viewBox yet), frame the whole board so the user
  // lands on a sensible view rather than the default origin. fitToScreen persists
  // the viewBox, so a re-open finds a saved one and autoFitOnLoad is false — this
  // fires at most once, ever, per project. "Already has content" is captured at
  // open time, so creating the first task in an empty project never yanks the view.
  const didAutoFitRef = useRef(false);
  const hadContentOnOpenRef = useRef(tasks.length > 0 || groups.length > 0);
  useEffect(() => {
    if (didAutoFitRef.current || !autoFitOnLoad || !hadContentOnOpenRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    didAutoFitRef.current = true;
    fitToScreen();
  }, [autoFitOnLoad, fitToScreen]);

  // ── Presentation mode: step the viewport through one person's tasks ──────────
  const [presentationPersonId, setPresentationPersonId] = useState<string | null>(null);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [presentationStatus, setPresentationStatus] = useState<StatusFilter>("in_progress");

  const assignedPeople = useMemo(() => peopleWithAssignedTasks(people, tasks), [people, tasks]);
  // Each assigned person's task count in the current status filter, so the bar
  // can show everyone's total all the time (not just the person being presented).
  const presentationTaskCounts = useMemo(
    () =>
      taskCountsByPerson(
        tasks,
        assignedPeople,
        presentationStatus === "all" ? undefined : presentationStatus,
      ),
    [tasks, assignedPeople, presentationStatus],
  );
  const presentationTasks = useMemo(
    () =>
      presentationPersonId
        ? tasksAssignedToPerson(
            tasks,
            presentationPersonId,
            presentationStatus === "all" ? undefined : presentationStatus,
          )
        : [],
    [tasks, presentationPersonId, presentationStatus],
  );

  const animateViewBoxTo = useViewBoxAnimation(viewBox, onViewBoxChange);

  const focusTaskInView = useCallback(
    (task: Task) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      animateViewBoxTo(
        centerViewBoxOnPoint(
          { x: task.x, y: task.y },
          { width: rect.width, height: rect.height },
          PRESENTATION_VIEW_WIDTH,
        ),
      );
    },
    [animateViewBoxTo],
  );

  // Begin (or restart) the carousel for a working set, jumping to its first task.
  const startCarousel = useCallback(
    (workingSet: Task[]) => {
      setPresentationIndex(0);
      if (workingSet.length > 0) focusTaskInView(workingSet[0]);
    },
    [focusTaskInView],
  );

  const handleSelectPresentationPerson = useCallback(
    (personId: string) => {
      if (personId === presentationPersonId) {
        setPresentationPersonId(null);
        return;
      }
      setPresentationPersonId(personId);
      startCarousel(
        tasksAssignedToPerson(
          tasks,
          personId,
          presentationStatus === "all" ? undefined : presentationStatus,
        ),
      );
    },
    [presentationPersonId, presentationStatus, tasks, startCarousel],
  );

  const handleSelectPresentationStatus = useCallback(
    (filter: StatusFilter) => {
      setPresentationStatus(filter);
      if (presentationPersonId) {
        startCarousel(
          tasksAssignedToPerson(tasks, presentationPersonId, filter === "all" ? undefined : filter),
        );
      }
    },
    [presentationPersonId, tasks, startCarousel],
  );

  const handleAdvancePresentation = useCallback(() => {
    if (presentationTasks.length === 0) return;
    const nextIndex = (presentationIndex + 1) % presentationTasks.length;
    setPresentationIndex(nextIndex);
    focusTaskInView(presentationTasks[nextIndex]);
  }, [presentationTasks, presentationIndex, focusTaskInView]);

  // Keep the selection valid as assignments change. A person stays selected as
  // long as they have any assigned task (an empty status filter is fine — it
  // just yields an empty carousel); only clear them if they fall off the list.
  useEffect(() => {
    if (presentationPersonId === null) return;
    const stillAssigned = assignedPeople.some((p) => p.id === presentationPersonId);
    if (!stillAssigned) {
      setPresentationPersonId(null);
      setPresentationIndex(0);
    } else if (presentationTasks.length === 0) {
      if (presentationIndex !== 0) setPresentationIndex(0);
    } else if (presentationIndex >= presentationTasks.length) {
      setPresentationIndex(presentationTasks.length - 1);
    }
  }, [presentationPersonId, assignedPeople, presentationTasks, presentationIndex]);

  // ── Magnifier: the hovered task or group, enlarged in a read-only overlay ────
  // Drop the trailed cursor whenever magnifying stops, so the next session starts
  // pinned to the element centre until the pointer moves again.
  useEffect(() => {
    if (!magnifyActive) setMagnifierCursor(null);
  }, [magnifyActive]);

  let magnifier:
    | {
        kind: "task";
        task: Task;
        groupTitle: string | null;
        left: number;
        top: number;
      }
    | { kind: "group"; title: string; left: number; top: number }
    | null = null;

  if (magnifyActive && svgRef.current && viewBox.width > 0 && viewBox.height > 0) {
    const rect = svgRef.current.getBoundingClientRect();
    const toScreen = (cx: number, cy: number) => ({
      left: ((cx - viewBox.x) / viewBox.width) * rect.width,
      top: ((cy - viewBox.y) / viewBox.height) * rect.height,
    });
    const hoveredTask =
      hoveredNode !== null && hoveredNode !== editingNodeId
        ? tasks.find((t) => t.id === hoveredNode)
        : undefined;
    if (hoveredTask) {
      magnifier = {
        kind: "task",
        task: hoveredTask,
        groupTitle: findOwningGroup(hoveredTask, groups)?.title ?? null,
        ...(magnifierCursor ?? toScreen(hoveredTask.x, hoveredTask.y)),
      };
    } else if (hoveredGroupId !== null && hoveredGroupId !== editingGroupId) {
      const group = groups.find((g) => g.id === hoveredGroupId);
      if (group) {
        magnifier = {
          kind: "group",
          title: group.title,
          ...(magnifierCursor ?? toScreen(group.x + group.width / 2, group.y + group.height / 2)),
        };
      }
    }
  }

  // Tint the whole canvas once every task in the project is done — a quiet "all
  // finished" cue.
  const allTasksDone =
    tasks.length > 0 && tasks.every((t) => t.status === "completed" || t.status === "archived");

  return (
    <div className={`canvas-container ${allTasksDone ? "all-tasks-done" : ""}`}>
      {isViewerOnly && (
        <div className="canvas-viewer-banner" aria-hidden="true">
          <span className="canvas-viewer-banner-badge">Viewer only</span>
        </div>
      )}
      {canvasLocked && !isViewerOnly && (
        <div className="canvas-locked-banner" aria-hidden="true">
          <span className="canvas-locked-banner-badge">Canvas locked</span>
        </div>
      )}
      <CanvasActionBar
        isTaskQueueOpen={isTaskQueueOpen}
        isTimelineOpen={isTimelineOpen}
        taskQueueDisabled={!hasTasksWithAssignedPeople(tasks)}
        showTimelineToggle={settings.showTimelinePanel}
        canvasLocked={canvasLocked}
        magnifyEnabled={magnifyEnabled}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleTaskQueue={() => {
          setIsTaskQueueOpen((prev) => !prev);
          setIsTimelineOpen(false);
        }}
        onToggleTimeline={() => {
          setIsTimelineOpen((prev) => !prev);
          setIsTaskQueueOpen(false);
        }}
        onUndo={onUndo}
        onRedo={onRedo}
        onToggleLock={() => setCanvasLocked((v) => !v)}
        onToggleMagnify={() => setMagnifyEnabled((v) => !v)}
        onFitToScreen={fitToScreen}
        onResetZoom={resetZoom}
      />
      {settings.showPresentationBar && (
        <PresentationBar
          people={assignedPeople}
          statuses={statuses}
          selectedPersonId={presentationPersonId}
          statusFilter={presentationStatus}
          currentIndex={presentationIndex}
          taskCountsByPerson={presentationTaskCounts}
          onSelectPerson={handleSelectPresentationPerson}
          onSelectStatus={handleSelectPresentationStatus}
          onAdvance={handleAdvancePresentation}
        />
      )}
      {isTaskQueueOpen && (
        <TaskQueuePanel
          tasks={tasks}
          groups={groups}
          connections={connections}
          people={people}
          categories={categories}
          statuses={statuses}
          selectedTaskIds={selectedNodes}
          showBlockedBySection={settings.showBlockedBySection}
          onAssignPersonToTask={onAssignPeople}
          onAssignPersonAndSetInProgress={onAssignPersonAndSetInProgress}
          onSetTaskStatus={onSetTaskStatus}
          onSelectTask={onSelectTask}
          onClose={() => setIsTaskQueueOpen(false)}
        />
      )}
      {settings.showTimelinePanel && isTimelineOpen && (
        <TimelinePanel
          tasks={tasks}
          people={people}
          statuses={statuses}
          selectedTaskIds={selectedNodes}
          onSelectTask={onSelectTask}
          onClose={() => setIsTimelineOpen(false)}
        />
      )}
      {magnifier?.kind === "task" && (
        <MagnifiedTaskOverlay
          task={magnifier.task}
          categories={categories}
          statuses={statuses}
          assignedPersons={
            (magnifier.task.assignedPersonIds
              ?.map((id) => people.find((p) => p.id === id))
              .filter(Boolean) as Person[]) ?? []
          }
          groupTitle={magnifier.groupTitle}
          left={magnifier.left}
          top={magnifier.top}
        />
      )}
      {magnifier?.kind === "group" && (
        <MagnifiedGroupOverlay title={magnifier.title} left={magnifier.left} top={magnifier.top} />
      )}
      {showSettings && (
        <SettingsDialog
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      <svg
        ref={svgRef}
        className={`canvas ${panMode || panning ? "panning" : ""}`}
        viewBox={
          viewBox.width > 0
            ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
            : undefined
        }
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleCanvasContextMenu}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={connector.color} />
          </marker>
        </defs>

        {groups.map((group) => (
          <GroupRect
            key={group.id}
            group={group}
            tasks={tasks}
            statuses={statuses}
            groupBox={groupBox}
            isSelected={selectedGroups.has(group.id)}
            isEditing={editingGroupId === group.id}
            panMode={panMode}
            canvasLocked={canvasLocked}
            onMouseDown={onGroupMouseDown}
            onSelect={onSelectGroup}
            onToggleSelect={onToggleGroupSelect}
            onMove={onGroupMove}
            onMoveWithTasks={onGroupMoveWithTasks}
            onMoveStart={onGroupMoveStart}
            onMoveEnd={onGroupMoveEnd}
            onResize={onGroupResize}
            onResizeStart={onGroupResizeStart}
            onResizeEnd={onGroupResizeEnd}
            onTitleChange={onGroupTitleChange}
            onEditingChange={(editing) => onEditingGroupChange(editing ? group.id : null)}
            onZoomTo={onGroupZoomTo}
            onToggleLock={onGroupToggleLock}
            onContextMenu={(e, id) => {
              const svgPos = toSvgCoords(e.clientX, e.clientY);
              setGroupContextMenu({
                groupId: id,
                x: e.clientX,
                y: e.clientY,
                svgX: svgPos.x,
                svgY: svgPos.y,
              });
            }}
            onHover={(hovering) =>
              setHoveredGroupId((prev) => (hovering ? group.id : prev === group.id ? null : prev))
            }
            toSvgCoords={toSvgCoords}
          />
        ))}

        {tasks
          .filter((task) => task.id !== hoveredNode && task.id !== editingNodeId)
          .map((task) => (
            <TaskNode
              key={task.id}
              task={task}
              categories={categories}
              statuses={statuses}
              isDragging={draggingNode === task.id}
              isSelected={selectedNodes.has(task.id)}
              isPeeked={peekedTaskId === task.id}
              isEditing={editingNodeId === task.id}
              assignedPersons={
                task.assignedPersonIds
                  ?.map((id) => people.find((p) => p.id === id))
                  .filter(Boolean) as Person[]
              }
              onMouseDown={(e) => {
                if (canvasLocked && !e.shiftKey) return;
                onNodeMouseDown(e, task.id);
              }}
              onClick={() => onNodeClick(task.id)}
              onMouseEnter={() => onNodeHover(task.id)}
              onMouseLeave={() => onNodeHover(null)}
              onContextMenu={(e) => handleNodeContextMenu(e, task.id)}
              onUpdateText={(text) => onUpdateTaskText(task.id, text)}
              onEditingChange={(editing) => onEditingNodeChange(editing ? task.id : null)}
            />
          ))}

        {connections.map((conn) => {
          const fromTask = tasks.find((t) => t.id === conn.from);
          const toTask = tasks.find((t) => t.id === conn.to);
          if (!fromTask || !toTask) return null;

          return (
            <Connector
              key={`${conn.from}-${conn.to}`}
              fromTask={fromTask}
              toTask={toTask}
              shiftPressed={shiftPressed}
              connector={connector}
              onRemove={(e) => onRemoveConnection(e, conn.from, conn.to)}
            />
          );
        })}

        {/* Nodes drawn on top of the rest: the hovered node and the node being
            edited. The editing node is listed first so the hovered node paints
            above it, and so it stays mounted (keeping focus) once hover clears. */}
        {Array.from(
          new Set([editingNodeId, hoveredNode].filter((id): id is string => id !== null)),
        ).map((id) => {
          const task = tasks.find((t) => t.id === id);
          if (!task) return null;
          return (
            <TaskNode
              key={task.id}
              task={task}
              categories={categories}
              statuses={statuses}
              isDragging={draggingNode === task.id}
              isSelected={selectedNodes.has(task.id)}
              isPeeked={peekedTaskId === task.id}
              isEditing={editingNodeId === task.id}
              assignedPersons={
                task.assignedPersonIds
                  ?.map((pid) => people.find((p) => p.id === pid))
                  .filter(Boolean) as Person[]
              }
              onMouseDown={(e) => {
                if (canvasLocked && !e.shiftKey) return;
                onNodeMouseDown(e, task.id);
              }}
              onClick={() => onNodeClick(task.id)}
              onMouseEnter={() => onNodeHover(task.id)}
              onMouseLeave={() => onNodeHover(null)}
              onContextMenu={(e) => handleNodeContextMenu(e, task.id)}
              onUpdateText={(text) => onUpdateTaskText(task.id, text)}
              onEditingChange={(editing) => onEditingNodeChange(editing ? task.id : null)}
            />
          );
        })}

        {connecting && (
          <PendingConnector
            fromX={tasks.find((t) => t.id === connecting.from)?.x || 0}
            fromY={tasks.find((t) => t.id === connecting.from)?.y || 0}
            toX={connecting.mouseX}
            toY={connecting.mouseY}
            connector={connector}
          />
        )}

        {selection && (
          <rect
            className="selection-rect"
            x={Math.min(selection.startX, selection.currentX)}
            y={Math.min(selection.startY, selection.currentY)}
            width={Math.abs(selection.currentX - selection.startX)}
            height={Math.abs(selection.currentY - selection.startY)}
          />
        )}
      </svg>
      <ProgressBar tasks={tasks} statuses={statuses} groupBox={groupBox} />
      <div className="help-panel-anchor" ref={helpPanelRef}>
        {showHelpPanel && (
          <div className="help-panel">
            <div className="help-panel-header">
              <span>How to Use</span>
              <div className="help-panel-header-actions">
                <button
                  className={`help-pin-btn ${isHelpPanelPinned ? "active" : ""}`}
                  onClick={() => setIsHelpPanelPinned((v) => !v)}
                  title={isHelpPanelPinned ? "Unpin" : "Pin"}
                >
                  <Pin size={13} />
                </button>
                <button className="help-close-btn" onClick={() => setShowHelpPanel(false)}>
                  ×
                </button>
              </div>
            </div>
            <HelpContent categories={categories} statuses={statuses} />
          </div>
        )}
        <button
          type="button"
          className="help-panel-btn"
          onClick={() => setShowHelpPanel((v) => !v)}
          aria-label="How to use"
        >
          <HelpCircle size={18} />
        </button>
      </div>
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="help-dialog-header">
              <h3>How to Use</h3>
              <button className="help-close-btn" onClick={() => setShowHelp(false)}>
                ×
              </button>
            </div>
            <HelpContent categories={categories} statuses={statuses} />
          </div>
        </div>
      )}
      {canvasContextMenu && (
        <div
          ref={canvasContextMenuRef}
          className="task-menu"
          style={{
            position: "fixed",
            top: canvasContextMenu.screenY,
            left: canvasContextMenu.screenX,
            transform: "none",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="menu-item"
            onClick={() => {
              onCreateTaskAt(canvasContextMenu.svgX, canvasContextMenu.svgY);
              setCanvasContextMenu(null);
            }}
          >
            New task here
          </button>
          <button
            className="menu-item"
            onClick={() => {
              onCreateGroupAt(canvasContextMenu.svgX, canvasContextMenu.svgY);
              setCanvasContextMenu(null);
            }}
          >
            New group here
          </button>
          <hr className="menu-divider" />
          <button
            className="menu-item"
            disabled={!canPaste}
            onClick={() => {
              onPaste({ x: canvasContextMenu.svgX, y: canvasContextMenu.svgY });
              setCanvasContextMenu(null);
            }}
          >
            Paste
          </button>
        </div>
      )}
      {groupContextMenu &&
        (() => {
          const ctxGroup = groups.find((g) => g.id === groupContextMenu.groupId);
          return (
            <div
              ref={groupContextMenuRef}
              className="task-menu"
              style={{
                position: "fixed",
                top: groupContextMenu.y,
                left: groupContextMenu.x,
                transform: "none",
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                className="menu-item"
                onClick={() => {
                  onCreateTaskAt(groupContextMenu.svgX, groupContextMenu.svgY);
                  setGroupContextMenu(null);
                }}
              >
                New task here
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  onGroupZoomTo(groupContextMenu.groupId);
                  setGroupContextMenu(null);
                }}
              >
                Zoom to group
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  onGroupToggleLock(groupContextMenu.groupId);
                  setGroupContextMenu(null);
                }}
              >
                {ctxGroup?.locked ? "Unlock group" : "Lock group"}
              </button>
              <button
                className="menu-item delete-item"
                onClick={() => {
                  onGroupDelete(groupContextMenu.groupId);
                  setGroupContextMenu(null);
                }}
              >
                Delete group
              </button>
            </div>
          );
        })()}
      {nodeContextMenu &&
        (() => {
          const task = tasks.find((t) => t.id === nodeContextMenu.taskId);
          if (!task) return null;
          return (
            <TaskContextMenu
              task={task}
              x={nodeContextMenu.x}
              y={nodeContextMenu.y}
              categories={categories}
              statuses={statuses}
              people={people}
              onSetStatus={(status) => {
                onSetTaskStatus(task.id, status);
                setNodeContextMenu(null);
              }}
              onSetCategory={(category) => {
                onSetTaskCategory(task.id, category);
                setNodeContextMenu(null);
              }}
              onDuplicate={() => {
                onDuplicateTask(task.id);
                setNodeContextMenu(null);
              }}
              onCopy={() => {
                onCopyTask(task.id);
                setNodeContextMenu(null);
              }}
              onEditTitle={() => {
                onEditingNodeChange(task.id);
                setNodeContextMenu(null);
              }}
              onDelete={() => {
                onDeleteTask(task.id);
                setNodeContextMenu(null);
              }}
              onAssignPeople={(ids) => onAssignPeople(task.id, ids)}
              onClose={() => setNodeContextMenu(null)}
            />
          );
        })()}
      {multiSelectionContextMenu && (
        <div
          ref={multiSelectionContextMenuRef}
          className="task-menu"
          style={{
            position: "fixed",
            top: multiSelectionContextMenu.y,
            left: multiSelectionContextMenu.x,
            transform: "none",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="menu-item"
            onClick={() => {
              setMultiSelectionContextMenu(null);
              onCopySelected();
            }}
          >
            Copy {selectedNodes.size + selectedGroups.size} items
          </button>
          <button
            className="menu-item delete-item"
            onClick={() => {
              setMultiSelectionContextMenu(null);
              void onDeleteSelected();
            }}
          >
            Delete {selectedNodes.size} tasks
          </button>
        </div>
      )}
    </div>
  );
});
