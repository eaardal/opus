/**
 * SVG → PNG export pipeline for the task graph canvas.
 *
 * The fiddly part is that the SVG references CSS custom properties from an
 * external stylesheet, which won't be available when the SVG is rendered as
 * a standalone document via `<img src="data:...svg+xml">`. We therefore
 * inline the resolved values both as a `:root { ... }` style block AND by
 * substituting `var(...)` expressions in presentation attributes.
 */

/** CSS variables referenced by the canvas SVG. Kept as a constant so the */
/** style-inlining logic stays exhaustive without trawling the SVG itself. */
export const CANVAS_CSS_VAR_NAMES: readonly string[] = [
  "--bg-primary",
  "--bg-secondary",
  "--bg-tertiary",
  "--text-primary",
  "--text-secondary",
  "--node-fill",
  "--node-stroke",
  "--node-badge-fill",
  "--node-badge-stroke",
  "--tooltip-fill",
  "--tooltip-stroke",
  "--connector-color",
  "--connector-pending",
  "--selection-fill",
  "--selection-stroke",
  "--group-fill",
  "--group-stroke",
  "--group-stroke-hover",
  "--group-title-color",
];

/** Build a `:root { --foo: red; --bar: blue; }` declaration block. */
export function buildResolvedRootCssVars(getValue: (name: string) => string): string {
  return CANVAS_CSS_VAR_NAMES.map((name) => `${name}: ${getValue(name).trim()};`).join(" ");
}

/** Replace any `var(--x)` substring in a value with its resolved value. */
export function resolveCssVarsInString(value: string, getValue: (name: string) => string): string {
  return value.replace(/var\(([^)]+)\)/g, (_, name) => getValue(name.trim()).trim());
}

/** Walk an element tree and resolve `var(...)` in all attribute values. */
export function inlineCssVarsInAttributes(root: Element, getValue: (name: string) => string): void {
  for (const attr of Array.from(root.attributes)) {
    if (attr.value.includes("var(")) {
      attr.value = resolveCssVarsInString(attr.value, getValue);
    }
  }
  for (const child of Array.from(root.children)) {
    inlineCssVarsInAttributes(child, getValue);
  }
}

/** The static CSS rules embedded into the exported SVG. */
const EXPORT_STYLE_RULES = `
  .node { fill: var(--node-fill); stroke: var(--node-stroke); stroke-width: 2; }
  .node.highlighted { stroke-width: 3; }
  .node.selected { stroke: var(--selection-stroke); stroke-width: 3; }
  .node-text { fill: var(--text-primary); font-size: 10px; font-weight: 500; }
  .node-emoji { font-size: 18px; }
  .node-number-badge { fill: var(--node-badge-fill); stroke: var(--node-badge-stroke); stroke-width: 1; }
  .node-number { fill: var(--text-primary); font-size: 10px; font-weight: 600; }
  .tooltip rect { fill: var(--tooltip-fill); stroke: var(--tooltip-stroke); stroke-width: 1; }
  .tooltip text { fill: var(--text-primary); font-size: 12px; }
  .group-rect { fill: var(--group-fill); stroke: var(--group-stroke); stroke-width: 1.5; stroke-dasharray: 6, 3; }
  .group-rect.selected { stroke: var(--selection-stroke); stroke-width: 2; }
  .group-title { fill: var(--group-title-color); font-size: 13px; font-weight: 500; }
  .group-zoom-btn-bg { fill: var(--group-fill); stroke: var(--group-stroke); stroke-width: 1; }
  .group-zoom-btn-icon { fill: none; stroke: var(--group-title-color); stroke-width: 1.5; stroke-linecap: round; }
  .group-progress-track { fill: var(--bg-tertiary); }
  .group-progress-fill { transition: width 0.3s; }
  .group-resize-handle { display: none; }
`;

/** Build the full embedded `<style>` text for an exported SVG. */
export function buildEmbeddedStyleText(args: {
  rootCssVarsBlock: string;
  fontFamily: string;
}): string {
  return `
        :root { ${args.rootCssVarsBlock} }
        svg, text, tspan { font-family: ${args.fontFamily}; }
        ${EXPORT_STYLE_RULES}
      `;
}

/** Encode an XML string as a `data:image/svg+xml;base64,...` URL. */
export function svgXmlToDataUrl(xml: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
}

/**
 * Trigger a download of the given SVG element rendered as a PNG. Uses the
 * provided `getCssValue` to resolve CSS variables (typically passed
 * `(n) => getComputedStyle(document.documentElement).getPropertyValue(n)`).
 *
 * The rasterization step (Image + canvas + toBlob) requires a real browser
 * and is not unit-tested here — see the unit tests for the pure helpers.
 */
export async function exportSvgElementAsPng(args: {
  svg: SVGSVGElement;
  filename: string;
  getCssValue: (name: string) => string;
  fontFamily: string;
  backgroundColor: string;
}): Promise<void> {
  const { svg, filename, getCssValue, fontFamily, backgroundColor } = args;
  const rect = svg.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));

  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.textContent = buildEmbeddedStyleText({
    rootCssVarsBlock: buildResolvedRootCssVars(getCssValue),
    fontFamily,
  });
  clone.prepend(styleEl);

  inlineCssVarsInAttributes(clone, getCssValue);

  const xml = new XMLSerializer().serializeToString(clone);
  const svgDataUrl = svgXmlToDataUrl(xml);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load SVG image"));
    img.src = svgDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to encode canvas as PNG");

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
