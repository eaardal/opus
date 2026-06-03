import { type RefObject, useEffect, useRef } from "react";

interface DismissOptions {
  /** Also dismiss when the Escape key is pressed. Defaults to true. */
  closeOnEscape?: boolean;
}

/**
 * Dismisses a floating element (context menu, popover, panel) when the user
 * presses a pointer down outside it, or presses Escape.
 *
 * The pointer listener is registered in the **capture phase** on purpose:
 * canvas elements such as a group body call `stopPropagation()` on mousedown,
 * which stops a bubble-phase listener from ever seeing the click and leaves the
 * element stuck open. Capture fires on the way down to the target, before any
 * child can stop propagation.
 *
 * @param ref       Element treated as "inside"; pointer-downs within it never dismiss.
 * @param onDismiss Called on an outside pointer-down or on Escape.
 * @param enabled   Listeners are attached only while this is true (e.g. while open).
 */
export function useDismissOnOutside(
  ref: RefObject<HTMLElement>,
  onDismiss: () => void,
  enabled = true,
  { closeOnEscape = true }: DismissOptions = {},
): void {
  // Hold the latest callback in a ref so an inline arrow passed by the caller
  // doesn't re-subscribe the listeners on every render.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!enabled) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismissRef.current();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") onDismissRef.current();
    };
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, enabled, closeOnEscape]);
}
