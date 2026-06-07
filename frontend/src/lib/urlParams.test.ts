import { afterEach, describe, expect, test } from "vitest";
import {
  parseFocusFromSearch,
  parseProjectIdFromSearch,
  readFocusFromUrl,
  readProjectIdFromUrl,
  writeFocusToUrl,
  writeProjectIdToUrl,
} from "./urlParams";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("parseProjectIdFromSearch", () => {
  test("returns the project id when present", () => {
    expect(parseProjectIdFromSearch("?project=abc-123")).toBe("abc-123");
  });

  test("returns null when absent or empty", () => {
    expect(parseProjectIdFromSearch("?other=x")).toBeNull();
    expect(parseProjectIdFromSearch("?project=")).toBeNull();
    expect(parseProjectIdFromSearch("")).toBeNull();
  });
});

describe("parseFocusFromSearch", () => {
  test("returns a task focus when the task param is present", () => {
    expect(parseFocusFromSearch("?task=t1")).toEqual({ kind: "task", id: "t1" });
  });

  test("returns a group focus when only the group param is present", () => {
    expect(parseFocusFromSearch("?group=g1")).toEqual({ kind: "group", id: "g1" });
  });

  test("prefers the more granular task over group when both are present", () => {
    expect(parseFocusFromSearch("?group=g1&task=t1")).toEqual({ kind: "task", id: "t1" });
  });

  test("returns null when neither param is present", () => {
    expect(parseFocusFromSearch("?project=p1")).toBeNull();
    expect(parseFocusFromSearch("")).toBeNull();
  });
});

describe("writeProjectIdToUrl / readProjectIdFromUrl", () => {
  test("round-trips and preserves other params", () => {
    window.history.replaceState(null, "", "/?task=t1");
    writeProjectIdToUrl("proj-9");
    expect(readProjectIdFromUrl()).toBe("proj-9");
    expect(parseFocusFromSearch(window.location.search)).toEqual({ kind: "task", id: "t1" });
  });
});

describe("writeFocusToUrl / readFocusFromUrl", () => {
  test("writes a task focus, clearing any group param and keeping the project", () => {
    window.history.replaceState(null, "", "/?project=p1&group=g1");
    writeFocusToUrl({ kind: "task", id: "t2" });
    expect(readFocusFromUrl()).toEqual({ kind: "task", id: "t2" });
    expect(readProjectIdFromUrl()).toBe("p1");
    expect(new URLSearchParams(window.location.search).has("group")).toBe(false);
  });

  test("writes a group focus, clearing any task param", () => {
    window.history.replaceState(null, "", "/?task=t1");
    writeFocusToUrl({ kind: "group", id: "g2" });
    expect(readFocusFromUrl()).toEqual({ kind: "group", id: "g2" });
    expect(new URLSearchParams(window.location.search).has("task")).toBe(false);
  });

  test("clears both params when passed null", () => {
    window.history.replaceState(null, "", "/?project=p1&task=t1");
    writeFocusToUrl(null);
    expect(readFocusFromUrl()).toBeNull();
    expect(readProjectIdFromUrl()).toBe("p1");
  });
});
