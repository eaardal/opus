import { describe, expect, test } from "vitest";
import {
  CANVAS_CSS_VAR_NAMES,
  buildEmbeddedStyleText,
  buildResolvedRootCssVars,
  inlineCssVarsInAttributes,
  resolveCssVarsInString,
  svgXmlToDataUrl,
} from "./exportCanvasAsPng";

describe("buildResolvedRootCssVars", () => {
  test("emits a declaration for every known canvas variable", () => {
    const block = buildResolvedRootCssVars((name) => `value-for-${name}`);
    for (const name of CANVAS_CSS_VAR_NAMES) {
      expect(block).toContain(`${name}: value-for-${name};`);
    }
  });

  test("trims whitespace from resolved values", () => {
    const block = buildResolvedRootCssVars((name) =>
      name === "--bg-primary" ? "  #ff0000  " : "x",
    );
    expect(block).toContain("--bg-primary: #ff0000;");
    expect(block).not.toContain("  #ff0000");
  });
});

describe("resolveCssVarsInString", () => {
  test("replaces a single var() with its resolved value", () => {
    const result = resolveCssVarsInString("var(--accent)", () => "#bada55");
    expect(result).toBe("#bada55");
  });

  test("replaces multiple var() expressions in a single attribute", () => {
    const result = resolveCssVarsInString("var(--a) solid var(--b)", (name) =>
      name === "--a" ? "1px" : "blue",
    );
    expect(result).toBe("1px solid blue");
  });

  test("leaves strings without var() untouched", () => {
    expect(resolveCssVarsInString("#ffffff", () => "x")).toBe("#ffffff");
  });

  test("trims the variable name before lookup so `var( --a )` works", () => {
    const seen: string[] = [];
    resolveCssVarsInString("var( --a )", (name) => {
      seen.push(name);
      return "z";
    });
    expect(seen).toEqual(["--a"]);
  });
});

describe("inlineCssVarsInAttributes", () => {
  test("rewrites attribute values containing var() across the whole subtree", () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<root xmlns="http://example.com">
        <a fill="var(--c1)"/>
        <wrap><b stroke="solid var(--c2)"/></wrap>
      </root>`,
      "text/xml",
    );
    const root = doc.documentElement;

    inlineCssVarsInAttributes(root, (name) => (name === "--c1" ? "red" : "blue"));

    expect(root.querySelector("a")?.getAttribute("fill")).toBe("red");
    expect(root.querySelector("b")?.getAttribute("stroke")).toBe("solid blue");
  });

  test("does not modify attributes that don't reference a var", () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<a fill="#fff" stroke="none"/>`, "text/xml");
    const el = doc.documentElement;
    inlineCssVarsInAttributes(el, () => "should-not-be-used");
    expect(el.getAttribute("fill")).toBe("#fff");
    expect(el.getAttribute("stroke")).toBe("none");
  });
});

describe("buildEmbeddedStyleText", () => {
  test("includes the :root block, font-family declaration, and node rules", () => {
    const text = buildEmbeddedStyleText({
      rootCssVarsBlock: "--bg-primary: #000;",
      fontFamily: "Helvetica, sans-serif",
    });
    expect(text).toContain(":root { --bg-primary: #000; }");
    expect(text).toContain("font-family: Helvetica, sans-serif;");
    expect(text).toContain(".node {");
    expect(text).toContain(".group-rect {");
  });
});

describe("svgXmlToDataUrl", () => {
  test("base64-encodes the XML inside a data URL", () => {
    const url = svgXmlToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg"/>`);
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = atob(url.slice("data:image/svg+xml;base64,".length));
    expect(decoded).toBe(`<svg xmlns="http://www.w3.org/2000/svg"/>`);
  });

  test("handles non-ASCII characters via UTF-8 encoding", () => {
    const xml = `<text>café</text>`;
    const url = svgXmlToDataUrl(xml);
    // decode base64 → percent-encoded UTF-8 bytes → original
    const decoded = decodeURIComponent(escape(atob(url.slice(26))));
    expect(decoded).toBe(xml);
  });
});
