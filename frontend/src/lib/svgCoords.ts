/**
 * Convert client (viewport) coordinates to the SVG's user-space coordinates.
 * Returns the origin if the SVG has no current screen CTM (e.g. it isn't
 * attached to the DOM yet).
 */
export function toSvgCoords(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}
