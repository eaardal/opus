import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { zoomViewBoxAtPoint } from "../domain/tasks/viewport";
import type { ViewBox } from "../domain/tasks/types";

interface PanningState {
  startX: number;
  startY: number;
  origVx: number;
  origVy: number;
}

interface UseCanvasPanArgs {
  svgRef: RefObject<SVGSVGElement | null>;
  viewBox: ViewBox;
  onViewBoxChange: (next: ViewBox) => void;
}

export interface UseCanvasPanResult {
  /** True when space is held OR the middle mouse button is pressed.
   *  Drives the grab/grabbing cursor styling on the SVG. */
  panMode: boolean;
  /** Non-null while a pan gesture is in progress. */
  panning: PanningState | null;
  /** Called from the SVG's onMouseDown. Returns true if the event began a
   *  pan (caller should NOT propagate to its own selection handlers). */
  tryStartPan: (e: React.MouseEvent) => boolean;
  /** Called from onMouseMove. Returns true if a pan was advanced. */
  tryUpdatePan: (e: React.MouseEvent) => boolean;
  /** Called from onMouseUp. Returns true if a pan was ended. */
  tryEndPan: (e: React.MouseEvent) => boolean;
}

const ZOOM_SENSITIVITY = 0.001;
const ZOOM_SENSITIVITY_TRACKPAD = 0.02;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const TOUCH_PAN_FINGERS = 3;

/**
 * Bundles all pan/zoom input on the canvas SVG:
 *
 *   - Spacebar tracking → `panMode` for cursor styling.
 *   - Middle-button or space+drag → mouse-pan via tryStart/Update/End.
 *   - Wheel → zoom anchored at the cursor.
 *   - Three-finger touch → pan.
 *
 * The wheel and touch handlers are registered directly on the SVG so they
 * can call `e.preventDefault()` (React's synthetic events are passive).
 */
export function useCanvasPan({
  svgRef,
  viewBox,
  onViewBoxChange,
}: UseCanvasPanArgs): UseCanvasPanResult {
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [middleMouseHeld, setMiddleMouseHeld] = useState(false);
  const [panning, setPanning] = useState<PanningState | null>(null);

  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;
  const panningRef = useRef(panning);
  panningRef.current = panning;
  const touchPanRef = useRef<PanningState | null>(null);

  const panMode = spaceHeld || middleMouseHeld;
  const panModeRef = useRef(panMode);
  panModeRef.current = panMode;

  // Spacebar tracking — global listener so the user can press space anywhere.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setSpaceHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Wheel-zoom (registered on the SVG to allow preventDefault).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const sensitivity = e.ctrlKey ? ZOOM_SENSITIVITY_TRACKPAD : ZOOM_SENSITIVITY;
      onViewBoxChange(
        zoomViewBoxAtPoint({
          viewBox: viewBoxRef.current,
          screen: { width: rect.width, height: rect.height },
          mouseFracX: (e.clientX - rect.left) / rect.width,
          mouseFracY: (e.clientY - rect.top) / rect.height,
          zoomFactor: 1 + e.deltaY * sensitivity,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        }),
      );
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [svgRef, onViewBoxChange]);

  // Three-finger touch pan.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const avgTouchPos = (touches: TouchList) => ({
      x: Array.from(touches).reduce((s, t) => s + t.clientX, 0) / touches.length,
      y: Array.from(touches).reduce((s, t) => s + t.clientY, 0) / touches.length,
    });

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length < TOUCH_PAN_FINGERS) return;
      e.preventDefault();
      const { x, y } = avgTouchPos(e.touches);
      touchPanRef.current = {
        startX: x,
        startY: y,
        origVx: viewBoxRef.current.x,
        origVy: viewBoxRef.current.y,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchPanRef.current || e.touches.length < TOUCH_PAN_FINGERS) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const { x, y } = avgTouchPos(e.touches);
      const scale = viewBoxRef.current.width / rect.width;
      onViewBoxChange({
        ...viewBoxRef.current,
        x: touchPanRef.current.origVx - (x - touchPanRef.current.startX) * scale,
        y: touchPanRef.current.origVy - (y - touchPanRef.current.startY) * scale,
      });
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < TOUCH_PAN_FINGERS) touchPanRef.current = null;
    };

    svg.addEventListener("touchstart", handleTouchStart, { passive: false });
    svg.addEventListener("touchmove", handleTouchMove, { passive: false });
    svg.addEventListener("touchend", handleTouchEnd);
    return () => {
      svg.removeEventListener("touchstart", handleTouchStart);
      svg.removeEventListener("touchmove", handleTouchMove);
      svg.removeEventListener("touchend", handleTouchEnd);
    };
  }, [svgRef, onViewBoxChange]);

  const tryStartPan = useCallback((e: React.MouseEvent): boolean => {
    if (e.button === 1) {
      e.preventDefault();
      setMiddleMouseHeld(true);
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        origVx: viewBoxRef.current.x,
        origVy: viewBoxRef.current.y,
      });
      return true;
    }
    if (panModeRef.current) {
      e.preventDefault();
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        origVx: viewBoxRef.current.x,
        origVy: viewBoxRef.current.y,
      });
      return true;
    }
    return false;
  }, []);

  const tryUpdatePan = useCallback(
    (e: React.MouseEvent): boolean => {
      const pan = panningRef.current;
      if (!pan) return false;
      const svg = svgRef.current;
      if (!svg) return true;
      const rect = svg.getBoundingClientRect();
      const scale = viewBoxRef.current.width / rect.width;
      onViewBoxChange({
        ...viewBoxRef.current,
        x: pan.origVx - (e.clientX - pan.startX) * scale,
        y: pan.origVy - (e.clientY - pan.startY) * scale,
      });
      return true;
    },
    [svgRef, onViewBoxChange],
  );

  const tryEndPan = useCallback((e: React.MouseEvent): boolean => {
    if (e.button === 1) setMiddleMouseHeld(false);
    if (!panningRef.current) return false;
    setPanning(null);
    return true;
  }, []);

  return {
    panMode,
    panning,
    tryStartPan,
    tryUpdatePan,
    tryEndPan,
  };
}
