import { describe, expect, test } from "vitest";
import { parseWorkspaceFile } from "./parseWorkspaceFile";

describe("parseWorkspaceFile", () => {
  describe("current v2 format", () => {
    test("passes through a well-formed v2 file unchanged", () => {
      const file = {
        version: 2,
        projects: [
          {
            id: "p1",
            name: "Sample",
            tasks: [],
            connections: [],
            groups: [],
            viewBox: { x: 0, y: 0, width: 800, height: 600 },
            theme: "dark",
            taskQueues: [],
          },
        ],
        people: [{ id: "u1", name: "Alice" }],
        teams: [],
      };
      expect(parseWorkspaceFile(file)).toEqual(file);
    });

    test("does not treat a wrong version number as v2", () => {
      // version 1 with a 'projects' array is not the v2 shape — fall through.
      const result = parseWorkspaceFile({ version: 1, projects: [] });
      expect(result.version).toBe(2);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe("My Project");
    });
  });

  describe("legacy task-only format", () => {
    test("migrates a task-only save into a single Imported Project", () => {
      const result = parseWorkspaceFile({
        tasks: [{ id: "t1", text: "Old task", x: 1, y: 2, status: "pending" }],
        connections: [{ from: "t1", to: "t1" }],
        groups: [{ id: "g1", title: "G", x: 0, y: 0, width: 50, height: 50 }],
        viewBox: { x: -100, y: -50, width: 1000, height: 800 },
        theme: "dark",
      });
      expect(result.version).toBe(2);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe("Imported Project");
      expect(result.projects[0].tasks).toHaveLength(1);
      expect(result.projects[0].connections).toHaveLength(1);
      expect(result.projects[0].groups).toHaveLength(1);
      expect(result.projects[0].viewBox).toEqual({ x: -100, y: -50, width: 1000, height: 800 });
      expect(result.projects[0].theme).toBe("dark");
      expect(result.projects[0].taskQueues).toEqual([]);
      expect(result.people).toEqual([]);
      expect(result.teams).toEqual([]);
    });

    test("supplies safe defaults for missing optional fields", () => {
      const result = parseWorkspaceFile({ tasks: [] });
      const project = result.projects[0];
      expect(project.connections).toEqual([]);
      expect(project.groups).toEqual([]);
      expect(project.viewBox).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      expect(project.theme).toBe("light");
    });

    test("normalises an unknown theme value to light", () => {
      const result = parseWorkspaceFile({ tasks: [], theme: "neon" });
      expect(result.projects[0].theme).toBe("light");
    });

    test("preserves theme: 'dark' verbatim", () => {
      const result = parseWorkspaceFile({ tasks: [], theme: "dark" });
      expect(result.projects[0].theme).toBe("dark");
    });
  });

  describe("legacy teams-only format", () => {
    test("migrates a teams-only save into people/teams alongside an empty default project", () => {
      const result = parseWorkspaceFile({
        people: [{ id: "u1", name: "Alice" }],
        teams: [{ id: "team-a", name: "A", memberIds: ["u1"] }],
      });
      expect(result.version).toBe(2);
      expect(result.people).toHaveLength(1);
      expect(result.teams).toHaveLength(1);
      expect(result.projects).toHaveLength(1);
      // Default project name is the standard "My Project".
      expect(result.projects[0].name).toBe("My Project");
      expect(result.projects[0].tasks).toEqual([]);
    });

    test("supplies an empty teams array when teams field is missing", () => {
      const result = parseWorkspaceFile({ people: [{ id: "u1", name: "A" }] });
      expect(result.teams).toEqual([]);
    });
  });

  describe("unknown shape", () => {
    test("empty object → empty default workspace", () => {
      const result = parseWorkspaceFile({});
      expect(result.version).toBe(2);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].tasks).toEqual([]);
      expect(result.people).toEqual([]);
      expect(result.teams).toEqual([]);
    });

    test("totally unrecognised shape → empty default workspace", () => {
      const result = parseWorkspaceFile({ foo: "bar", baz: 42 });
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe("My Project");
    });
  });

  describe("ambiguous shape priority", () => {
    test("a save with both tasks and people is treated as task-only (the older format)", () => {
      // Ordering test: the parser should match the task-only branch before the
      // teams-only branch, so saves that happen to have both arrays end up
      // with the tasks intact.
      const result = parseWorkspaceFile({
        tasks: [{ id: "t1", text: "x", x: 0, y: 0, status: "pending" }],
        people: [{ id: "u1", name: "A" }],
      });
      expect(result.projects[0].tasks).toHaveLength(1);
      // people from the input are NOT carried over in the task-only branch —
      // documenting this as the historical behaviour.
      expect(result.people).toEqual([]);
    });
  });
});
