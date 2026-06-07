import { afterEach, describe, expect, test } from "vitest";
import {
  parseProjectIdFromSearch,
  readProjectIdFromUrl,
  writeProjectIdToUrl,
} from "./projectUrlParam";

describe("parseProjectIdFromSearch", () => {
  test("returns the project id when the param is present", () => {
    expect(parseProjectIdFromSearch("?project=abc-123")).toBe("abc-123");
  });

  test("returns null when the param is absent or the search is empty", () => {
    expect(parseProjectIdFromSearch("?other=x")).toBeNull();
    expect(parseProjectIdFromSearch("")).toBeNull();
  });

  test("returns null for an empty project value", () => {
    expect(parseProjectIdFromSearch("?project=")).toBeNull();
  });

  test("picks the project param out from among others", () => {
    expect(parseProjectIdFromSearch("?a=1&project=p2&b=2")).toBe("p2");
  });
});

describe("writeProjectIdToUrl / readProjectIdFromUrl", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  test("write then read round-trips the id", () => {
    writeProjectIdToUrl("proj-9");
    expect(readProjectIdFromUrl()).toBe("proj-9");
  });

  test("preserves other existing query params", () => {
    window.history.replaceState(null, "", "/?keep=1");
    writeProjectIdToUrl("proj-9");
    expect(new URLSearchParams(window.location.search).get("keep")).toBe("1");
    expect(readProjectIdFromUrl()).toBe("proj-9");
  });
});
