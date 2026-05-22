import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { WorkspaceDocument } from "../services/workspace.types";
import { useWorkspaceLoader } from "./useWorkspaceLoader";

type SubscribeCb = (doc: WorkspaceDocument | null) => void;
type ErrorCb = (err: Error) => void;

function makeSubscribe() {
  const callbacks = new Map<string, SubscribeCb[]>();
  const errorCallbacks = new Map<string, ErrorCb[]>();

  const subscribe = vi.fn((id: string, cb: SubscribeCb, onError?: ErrorCb) => {
    const list = callbacks.get(id) ?? [];
    list.push(cb);
    callbacks.set(id, list);

    if (onError) {
      const errList = errorCallbacks.get(id) ?? [];
      errList.push(onError);
      errorCallbacks.set(id, errList);
    }

    return () => {
      callbacks.set(
        id,
        (callbacks.get(id) ?? []).filter((c) => c !== cb),
      );
      if (onError) {
        errorCallbacks.set(
          id,
          (errorCallbacks.get(id) ?? []).filter((c) => c !== onError),
        );
      }
    };
  });

  const fire = (id: string, doc: WorkspaceDocument | null) => {
    for (const cb of callbacks.get(id) ?? []) cb(doc);
  };

  const fireError = (id: string, err: Error) => {
    for (const cb of errorCallbacks.get(id) ?? []) cb(err);
  };

  return { subscribe, fire, fireError };
}

const sampleDoc = (overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument => ({
  ownerId: "u1",
  name: "Original",
  projects: [],
  people: [],
  teams: [],
  updatedAt: new Date(),
  ...overrides,
});

describe("useWorkspaceLoader", () => {
  test("loads loading → ready on first snapshot, exposes name + hydration + loadCount", () => {
    const { subscribe, fire } = makeSubscribe();
    const { result } = renderHook(() => useWorkspaceLoader({ workspaceId: "w1", subscribe }));
    expect(result.current.status).toBe("loading");

    act(() => fire("w1", sampleDoc({ name: "My workspace" })));

    expect(result.current.status).toBe("ready");
    expect(result.current.name).toBe("My workspace");
    expect(result.current.loadCount).toBe(1);
    expect(result.current.hydration).not.toBeNull();
  });

  test("creates a default project when the doc has none", () => {
    const { subscribe, fire } = makeSubscribe();
    const { result } = renderHook(() => useWorkspaceLoader({ workspaceId: "w1", subscribe }));
    act(() => fire("w1", sampleDoc({ projects: [] })));
    expect(result.current.hydration?.projects.length).toBe(1);
    expect(result.current.hydration?.activeProjectId).toBe(
      result.current.hydration?.projects[0].id,
    );
  });

  test("subsequent snapshots for the same workspace only update the name", () => {
    const { subscribe, fire } = makeSubscribe();
    const { result } = renderHook(() => useWorkspaceLoader({ workspaceId: "w1", subscribe }));

    act(() => fire("w1", sampleDoc({ name: "Original" })));
    const firstHydration = result.current.hydration;
    expect(result.current.loadCount).toBe(1);

    act(() => fire("w1", sampleDoc({ name: "Renamed" })));
    expect(result.current.name).toBe("Renamed");
    expect(result.current.hydration).toBe(firstHydration); // same reference, not re-hydrated
    expect(result.current.loadCount).toBe(1);
  });

  test("transitions to 'missing' when the doc disappears", () => {
    const { subscribe, fire } = makeSubscribe();
    const { result } = renderHook(() => useWorkspaceLoader({ workspaceId: "w1", subscribe }));
    act(() => fire("w1", sampleDoc()));
    expect(result.current.status).toBe("ready");
    act(() => fire("w1", null));
    expect(result.current.status).toBe("missing");
  });

  test("transitions to 'error' with 'permission-denied' on a permission-denied snapshot error", () => {
    const { subscribe, fireError } = makeSubscribe();
    const { result } = renderHook(() => useWorkspaceLoader({ workspaceId: "w1", subscribe }));

    const err = Object.assign(new Error("permission-denied"), { code: "permission-denied" });
    act(() => fireError("w1", err));

    expect(result.current.status).toBe("error");
    expect(result.current.loadError).toBe("permission-denied");
  });

  test("transitions to 'error' with 'unknown' on an unrecognised snapshot error", () => {
    const { subscribe, fireError } = makeSubscribe();
    const { result } = renderHook(() => useWorkspaceLoader({ workspaceId: "w1", subscribe }));

    act(() => fireError("w1", new Error("network error")));

    expect(result.current.status).toBe("error");
    expect(result.current.loadError).toBe("unknown");
  });

  test("resets error state when switching to a new workspace", () => {
    const { subscribe, fire, fireError } = makeSubscribe();
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useWorkspaceLoader({ workspaceId: id, subscribe }),
      { initialProps: { id: "w1" as string | null } },
    );

    const err = Object.assign(new Error("permission-denied"), { code: "permission-denied" });
    act(() => fireError("w1", err));
    expect(result.current.status).toBe("error");

    rerender({ id: "w2" });
    expect(result.current.status).toBe("loading");
    expect(result.current.loadError).toBeNull();

    act(() => fire("w2", sampleDoc({ name: "Second" })));
    expect(result.current.status).toBe("ready");
  });

  test("switching to a new workspace re-enters loading and re-hydrates", () => {
    const { subscribe, fire } = makeSubscribe();
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useWorkspaceLoader({ workspaceId: id, subscribe }),
      { initialProps: { id: "w1" as string | null } },
    );

    act(() => fire("w1", sampleDoc({ name: "First" })));
    expect(result.current.loadCount).toBe(1);

    rerender({ id: "w2" });
    expect(result.current.status).toBe("loading");

    act(() => fire("w2", sampleDoc({ name: "Second" })));
    expect(result.current.status).toBe("ready");
    expect(result.current.name).toBe("Second");
    expect(result.current.loadCount).toBe(2);
  });
});
