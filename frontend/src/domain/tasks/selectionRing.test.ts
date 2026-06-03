import { describe, expect, test } from "vitest";
import { nodeSelectionRing } from "./selectionRing";

describe("nodeSelectionRing", () => {
  test("circle ring is the node radius plus the gap", () => {
    expect(nodeSelectionRing("circle", 5)).toEqual({ kind: "circle", r: 30 });
  });

  test("diamond ring pushes each vertex outward from the centre by the gap", () => {
    // The diamond is centred at the origin, so a gap of 5 moves the ±30 vertices to ±35.
    expect(nodeSelectionRing("diamond", 5)).toEqual({
      kind: "polygon",
      points: "0,-35 35,0 0,35 -35,0",
    });
  });

  test("triangle ring keeps three vertices and pushes the apex further out", () => {
    const ring = nodeSelectionRing("triangle", 5);
    expect(ring.kind).toBe("polygon");
    if (ring.kind !== "polygon") throw new Error("expected polygon ring");

    const points = ring.points.split(" ");
    expect(points).toHaveLength(3);
    // The apex started at (0,-30); expanding away from the centroid lifts it higher.
    const apexY = Number(points[0].split(",")[1]);
    expect(apexY).toBeLessThan(-30);
  });
});
