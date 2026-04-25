import { useCallback, useEffect, useState } from "react";

interface UseResizableSidebarArgs {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
}

export interface UseResizableSidebarResult {
  width: number;
  isResizing: boolean;
  /** Attach to the resize handle's onMouseDown. */
  startResize: (e: React.MouseEvent) => void;
}

/**
 * Drag-to-resize state machine for a left-aligned sidebar. The width tracks
 * the mouse's clientX while a drag is active, clamped to [minWidth, maxWidth].
 * Document-level mousemove/mouseup listeners are attached only while resizing.
 */
export function useResizableSidebar({
  initialWidth,
  minWidth,
  maxWidth,
}: UseResizableSidebarArgs): UseResizableSidebarResult {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      setWidth(Math.max(minWidth, Math.min(maxWidth, e.clientX)));
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  return { width, isResizing, startResize };
}
