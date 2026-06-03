import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { useDismissOnOutside } from "./useDismissOnOutside";

function Harness({
  onDismiss,
  enabled = true,
  closeOnEscape = true,
}: {
  onDismiss: () => void;
  enabled?: boolean;
  closeOnEscape?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissOnOutside(ref, onDismiss, enabled, { closeOnEscape });
  return (
    <div>
      {/* Mirrors a canvas group body: it stops propagation on mousedown, which
          would defeat a bubble-phase listener. */}
      <button type="button" data-testid="outside" onMouseDown={(e) => e.stopPropagation()}>
        outside
      </button>
      <div ref={ref} data-testid="inside">
        menu
      </div>
    </div>
  );
}

describe("useDismissOnOutside", () => {
  test("dismisses on an outside pointer-down even when the target stops propagation", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test("does not dismiss on a pointer-down inside the ref element", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);

    fireEvent.mouseDown(screen.getByTestId("inside"));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  test("dismisses on Escape by default", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test("does not listen for Escape when closeOnEscape is false", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} closeOnEscape={false} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  test("does not dismiss while disabled", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} enabled={false} />);

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
