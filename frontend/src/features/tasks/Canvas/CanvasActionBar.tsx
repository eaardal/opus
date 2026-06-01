import {
  Focus,
  GanttChart,
  LayoutList,
  Lock,
  LockOpen,
  Maximize,
  Redo2,
  Undo2,
  ZoomIn,
} from "lucide-react";
import "./CanvasActionBar.css";

interface CanvasActionBarProps {
  isTaskQueueOpen: boolean;
  isTimelineOpen: boolean;
  /** Whether to show the Timeline toggle (settings.showTimelinePanel). */
  showTimelineToggle: boolean;
  canvasLocked: boolean;
  magnifyEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleTaskQueue: () => void;
  onToggleTimeline: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleLock: () => void;
  onToggleMagnify: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
}

/**
 * The cluster of icon buttons pinned to the top-right of the canvas: panel
 * toggles (Task Queue, Timeline), undo/redo, canvas lock, magnifier, and
 * viewport controls (fit-to-screen, reset zoom). Purely presentational — every
 * action and piece of state is supplied by the parent Canvas.
 */
export function CanvasActionBar({
  isTaskQueueOpen,
  isTimelineOpen,
  showTimelineToggle,
  canvasLocked,
  magnifyEnabled,
  canUndo,
  canRedo,
  onToggleTaskQueue,
  onToggleTimeline,
  onUndo,
  onRedo,
  onToggleLock,
  onToggleMagnify,
  onFitToScreen,
  onResetZoom,
}: CanvasActionBarProps) {
  return (
    <div className="canvas-action-bar">
      <button
        type="button"
        className={`canvas-toolbar-btn ${isTaskQueueOpen ? "active" : ""}`}
        onClick={onToggleTaskQueue}
        aria-label="Task Queue"
        data-tooltip="Task Queue"
      >
        <LayoutList size={16} />
      </button>
      {showTimelineToggle && (
        <button
          type="button"
          className={`canvas-toolbar-btn ${isTimelineOpen ? "active" : ""}`}
          onClick={onToggleTimeline}
          aria-label="Timeline"
          data-tooltip="Timeline"
        >
          <GanttChart size={16} />
        </button>
      )}
      <button
        type="button"
        className="canvas-toolbar-btn"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        data-tooltip="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        type="button"
        className="canvas-toolbar-btn"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        data-tooltip="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 size={16} />
      </button>
      <button
        type="button"
        className={`canvas-toolbar-btn canvas-lock-btn ${canvasLocked ? "active" : ""}`}
        onClick={onToggleLock}
        aria-label={canvasLocked ? "Unlock canvas" : "Lock canvas"}
        data-tooltip={canvasLocked ? "Unlock canvas" : "Lock canvas"}
      >
        {canvasLocked ? <Lock size={16} /> : <LockOpen size={16} />}
      </button>
      <button
        type="button"
        className={`canvas-toolbar-btn canvas-magnify-btn ${magnifyEnabled ? "active" : ""}`}
        onClick={onToggleMagnify}
        aria-label={magnifyEnabled ? "Turn off magnifier" : "Turn on magnifier"}
        data-tooltip={magnifyEnabled ? "Magnifier on — hover a task" : "Magnifier (or hold Alt)"}
      >
        <ZoomIn size={16} />
      </button>
      <button
        type="button"
        className="canvas-toolbar-btn"
        onClick={onFitToScreen}
        aria-label="Fit to screen"
        data-tooltip="Fit to screen"
      >
        <Maximize size={16} />
      </button>
      <button
        type="button"
        className="canvas-toolbar-btn"
        onClick={onResetZoom}
        aria-label="Reset zoom to 100%"
        data-tooltip="Reset zoom"
      >
        <Focus size={16} />
      </button>
    </div>
  );
}
