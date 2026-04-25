import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { WorkspaceDocument } from "../services/workspace.types";
import { useWorkspaceLoader } from "./useWorkspaceLoader";

type SubscribeCb = (doc: WorkspaceDocument | null) => void;

function makeSubscribe() {
  const callbacks = new Map<string, SubscribeCb[]>();
  const subscribe = vi.fn((id: string, cb: SubscribeCb) => {
    const list = callbacks.get(id) ?? [];
    list.push(cb);
    callbacks.set(id, list);
    return () => {
      callbacks.set(
        id,
        (callbacks.get(id) ?? []).filter((c) => c !== cb),
      );
    };
  });
  const fire = (id: string, doc: WorkspaceDocument | null) => {
    for (const cb of callbacks.get(id) ?? []) cb(doc);
  };
  return { subscribe, fire };
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
