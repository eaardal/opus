import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { WorkspaceDocument, ProjectSummary, WorkspaceService } from "../services/workspace.types";
import type { Person, Team } from "../domain/teams/types";
import { useWorkspaceLoader } from "./useWorkspaceLoader";

// ── Minimal WorkspaceService mock ────────────────────────────────────────────

type MetaCb = (doc: WorkspaceDocument | null) => void;
type ProjectsCb = (projects: ProjectSummary[]) => void;
type PeopleCb = (people: Person[]) => void;
type TeamsCb = (teams: Team[]) => void;

interface MockService {
  service: WorkspaceService;
  fireMeta: (id: string, doc: WorkspaceDocument | null) => void;
  fireProjects: (id: string, list: ProjectSummary[]) => void;
  firePeople: (id: string, list: Person[]) => void;
  fireTeams: (id: string, list: Team[]) => void;
}

function makeService(): MockService {
  const metaMap = new Map<string, MetaCb[]>();
  const projectsMap = new Map<string, ProjectsCb[]>();
  const peopleMap = new Map<string, PeopleCb[]>();
  const teamsMap = new Map<string, TeamsCb[]>();

  function reg<T>(map: Map<string, T[]>, id: string, cb: T) {
    const list = map.get(id) ?? [];
    list.push(cb);
    map.set(id, list);
    return () => map.set(id, (map.get(id) ?? []).filter((c) => c !== cb));
  }

  const fire =
    <T>(map: Map<string, T[]>) =>
    (id: string, payload: T extends (arg: infer A) => void ? A : never) => {
      for (const cb of map.get(id) ?? []) (cb as (a: typeof payload) => void)(payload);
    };

  const service = {
    subscribe: vi.fn((id, cb: MetaCb) => reg(metaMap, id, cb)),
    subscribeProjects: vi.fn((id, cb: ProjectsCb) => reg(projectsMap, id, cb)),
    subscribePeople: vi.fn((id, cb: PeopleCb) => reg(peopleMap, id, cb)),
    subscribeTeams: vi.fn((id, cb: TeamsCb) => reg(teamsMap, id, cb)),
  } as unknown as WorkspaceService;

  return {
    service,
    fireMeta: fire(metaMap) as (id: string, doc: WorkspaceDocument | null) => void,
    fireProjects: fire(projectsMap) as (id: string, list: ProjectSummary[]) => void,
    firePeople: fire(peopleMap) as (id: string, list: Person[]) => void,
    fireTeams: fire(teamsMap) as (id: string, list: Team[]) => void,
  };
}

const sampleDoc = (overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument => ({
  ownerId: "u1",
  name: "My Workspace",
  updatedAt: new Date(),
  ...overrides,
});

// ── Helpers to fire all four listeners at once ────────────────────────────────

function fireAll(mock: MockService, id: string, doc: WorkspaceDocument) {
  mock.fireMeta(id, doc);
  mock.fireProjects(id, []);
  mock.firePeople(id, []);
  mock.fireTeams(id, []);
}

describe("useWorkspaceLoader", () => {
  test("stays loading until all four listeners have fired", () => {
    const mock = makeService();
    const { result } = renderHook(() =>
      useWorkspaceLoader({ workspaceId: "w1", service: mock.service }),
    );

    expect(result.current.status).toBe("loading");

    act(() => mock.fireMeta("w1", sampleDoc()));
    expect(result.current.status).toBe("loading");

    act(() => mock.fireProjects("w1", []));
    expect(result.current.status).toBe("loading");

    act(() => mock.firePeople("w1", []));
    expect(result.current.status).toBe("loading");

    act(() => mock.fireTeams("w1", []));
    expect(result.current.status).toBe("ready");
  });

  test("exposes name, loadCount, projects, people, teams when ready", () => {
    const mock = makeService();
    const { result } = renderHook(() =>
      useWorkspaceLoader({ workspaceId: "w1", service: mock.service }),
    );

    const projects: ProjectSummary[] = [{ id: "p1", name: "Project Alpha" }];
    const people: Person[] = [{ id: "u1", name: "Alice", picture: null }];
    const teams: Team[] = [{ id: "t1", name: "Team A", memberIds: ["u1"] }];

    act(() => {
      mock.fireMeta("w1", sampleDoc({ name: "My Workspace" }));
      mock.fireProjects("w1", projects);
      mock.firePeople("w1", people);
      mock.fireTeams("w1", teams);
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.name).toBe("My Workspace");
    expect(result.current.loadCount).toBe(1);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.people).toEqual(people);
    expect(result.current.teams).toEqual(teams);
  });

  test("transitions to 'missing' when the doc disappears", () => {
    const mock = makeService();
    const { result } = renderHook(() =>
      useWorkspaceLoader({ workspaceId: "w1", service: mock.service }),
    );

    act(() => fireAll(mock, "w1", sampleDoc()));
    expect(result.current.status).toBe("ready");

    act(() => mock.fireMeta("w1", null));
    expect(result.current.status).toBe("missing");
  });

  test("live name updates after ready without bumping loadCount", () => {
    const mock = makeService();
    const { result } = renderHook(() =>
      useWorkspaceLoader({ workspaceId: "w1", service: mock.service }),
    );

    act(() => fireAll(mock, "w1", sampleDoc({ name: "Original" })));
    expect(result.current.loadCount).toBe(1);

    act(() => mock.fireMeta("w1", sampleDoc({ name: "Renamed" })));
    expect(result.current.name).toBe("Renamed");
    expect(result.current.loadCount).toBe(1);
  });

  test("switching workspaceId re-enters loading and increments loadCount on ready", () => {
    const mock = makeService();
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) =>
        useWorkspaceLoader({ workspaceId: id, service: mock.service }),
      { initialProps: { id: "w1" as string | null } },
    );

    act(() => fireAll(mock, "w1", sampleDoc({ name: "First" })));
    expect(result.current.loadCount).toBe(1);

    rerender({ id: "w2" });
    expect(result.current.status).toBe("loading");

    act(() => fireAll(mock, "w2", sampleDoc({ name: "Second" })));
    expect(result.current.status).toBe("ready");
    expect(result.current.name).toBe("Second");
    expect(result.current.loadCount).toBe(2);
  });
});
