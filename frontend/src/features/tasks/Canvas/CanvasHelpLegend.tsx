import "./CanvasHelpLegend.css";
import type { NodeShape, TaskStatus } from "../../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "../theme";

interface CanvasHelpLegendProps {
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
}

/**
 * A swatch mirroring how a category is drawn on the canvas: a circle, diamond, or
 * triangle filled with the category colour (shape defaults to circle).
 */
function CategoryShape({ color, shape }: { color: string; shape: NodeShape | undefined }) {
  return (
    <svg className="legend-shape" width={22} height={22} viewBox="0 0 22 22" aria-hidden="true">
      {shape === "diamond" ? (
        <polygon points="11,2 20,11 11,20 2,11" style={{ fill: color }} />
      ) : shape === "triangle" ? (
        <polygon points="11,3 20,19 2,19" style={{ fill: color }} />
      ) : (
        <circle cx="11" cy="11" r="9" style={{ fill: color }} />
      )}
    </svg>
  );
}

/**
 * The legend shown in the "How to Use" dialog: explains what each task category
 * shape/colour and each status emoji/colour means, using the same visual
 * vocabulary the canvas draws nodes with.
 */
export function CanvasHelpLegend({ categories, statuses }: CanvasHelpLegendProps) {
  return (
    <div className="legend">
      <section className="legend-section">
        <h4 className="legend-heading">Categories</h4>
        <ul className="legend-grid">
          {Object.entries(categories).map(([key, { label, color, shape }]) => (
            <li key={key} className="legend-row">
              <CategoryShape color={color} shape={shape} />
              <span className="legend-label">{label}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="legend-section">
        <h4 className="legend-heading">Statuses</h4>
        <ul className="legend-grid">
          {(Object.entries(statuses) as [TaskStatus, StatusConfig][]).map(
            ([key, { label, color, emoji }]) => (
              <li key={key} className="legend-row">
                <span className="legend-status" style={{ background: color }} aria-hidden="true">
                  {emoji}
                </span>
                <span className="legend-label">{label}</span>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
