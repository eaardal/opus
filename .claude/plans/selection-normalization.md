# Selection normalization

Status: Phases 1–5 implemented 2026-06-03 (uncommitted). Verified: typecheck, lint,
build, full test suite (384 tests). Pending: visual tuning of colours/widths/offsets
in the running app, and an optional commit.

Goal: unify the two parallel "highlight" and "selection" visual systems into a
single **selection** model, restyled to a deep saturated blue, with full
canvas↔sidebar↔panel parity. A separate lightweight **peek** echo preserves the
"hover here, see it there" feedback that today's highlight quietly provided.

## Background (current state)

Two independent systems are layered on the same elements:

- **Highlight** (`--highlight-border` `#85b0f6` light blue), state `highlightedTaskId: string | null`.
  Set by: single canvas click, sidebar row hover/focus, Timeline & Task Queue
  panel clicks, zoom-to-task navigation. Decorates the node **shape + title**.
  It is really doing two jobs: click-focus AND a transient cross-surface echo.
- **Selection** (`--selection-stroke` `#e0609a` pink / `--selection-fill`), state
  `selectedNodes`/`selectedGroups` in `useDragSelection`. Set by single-click,
  modifier-toggle, marquee. Decorates the node **shape only**; groups only.

Inconsistencies: different colours, widths (resting 3 / highlight 4 + title 2 /
selected 3 / group-selected 2 / sidebar-highlight outline 2 / marquee 1),
mechanisms (SVG `stroke` vs CSS `outline`), dual source of truth in `TaskNode`
(inline `nodeStyle` vs `.node.*` CSS), and missing states (groups have no
highlight; sidebar has no selection).

## Decisions

1. **Unify into `selection`**; keep a distinct, lighter **`peek`** for the
   transient cross-surface hover echo (hover a row → the node lights up). Peek is
   NOT selection and must not mutate the selection set.
2. **Colour:** deep, saturated, Figma-like blue, darker than today's `#85b0f6`.
   Starting value `--selection-border: #2f6fe0` (tunable). Peek reuses the old
   light blue as `--peek-border: #85b0f6`.
3. **Task = shape + title as one unit.** Both decorated together or not at all.
4. **Full parity.** Canvas selection reflects in the sidebar (task rows) and in
   the Timeline/Task Queue panels. Groups reflect as a ring around the **group
   header only** in the sidebar (not the contained subtasks).
5. **Border widths:** same across the canvas (start 3), sidebar may differ
   (start 2). Tunable.
6. **Offset:** keep the small offset but reduce ~1px (today 3px → 2px), and apply
   an offset to the node **shape** ring too (not just title/sidebar).
7. **Groups gain single-click selection** like tasks; clicking outside dismisses.

Confirmed scope refinements:

- **Sidebar is reflect-only** — selection is initiated on the canvas (the main
  workspace), the sidebar mirrors it.
- **Timeline & Task Queue panels are in scope**: clicking a row selects that
  single task (reflected everywhere) and **centers the canvas** on it; they do
  not get marquee/multi-select.
- **Navigation selects + centers**: sidebar sequence-number click and group-header
  click select the target and center/zoom the canvas to it.
- Peek stays as a subtle, distinct treatment (lighter colour / thinner), not the
  full selection ring.

## Target tokens (`src/style.css`)

| Token | Value (starting, tunable) | Meaning |
|---|---|---|
| `--selection-border` | `#2f6fe0` | selection ring everywhere (was pink `--selection-stroke`) |
| `--selection-fill` | `rgba(47, 111, 224, 0.14)` | marquee fill (recoloured from pink) |
| `--peek-border` | `#85b0f6` | transient hover echo on tasks (was the task use of `--highlight-border`) |
| `--highlight-border` | `#85b0f6` (retained) | generic accent blue still used by SettingsDialog / GroupProgressBar |

`--highlight-bg` is currently dead (defined, unused) — left as-is for now.

## Per-surface target treatment

- **Canvas `TaskNode`**: status-colour resting border preserved; selection becomes
  an **outer offset ring** drawn as separate SVG outline shapes (one per
  circle/diamond/triangle) + the title tooltip ring, both blue, width 3, offset
  2px, shown together. Peek = same shapes in `--peek-border`, width 2, when not
  selected. Remove the inline-vs-CSS stroke overlap. A pure
  `selectionOutline(shape, offset)` geometry helper (unit-tested) feeds the shapes.
- **Canvas `GroupRect`**: single-click select (movement threshold vs drag-move);
  selected = blue offset ring width 3, offset 2px.
- **Canvas marquee**: recolour to `--selection-fill` / `--selection-border`.
- **Sidebar `TaskItem`/`TaskList`** (reflect-only): `.selected` outline 2px
  `--selection-border` offset 2px (from `selectedNodes`); hover/focus → peek
  (`--peek-border`); group header `.selected` ring (from `selectedGroups`);
  editing implies selected (single outline, not two competing borders).
- **Timeline & Task Queue panels**: replace `highlightedTaskId`/`onHighlightTask`
  with select-single + center; selected rows use the selection treatment.

## State / code changes

- `useDragSelection` stays the single source of truth for selection (already has
  single-click, modifier-toggle, marquee, click-empty-clear, Escape-clear). Add
  `selectSingleTask(id)` / `selectSingleGroup(id)` for navigation/panel-driven select.
- New transient `peekedTaskId` state (in `TasksApp`), set by sidebar (and panel)
  row hover; consumed by canvas + sidebar + panels. Separate from selection and
  from the canvas-local `hoveredNode`.
- Remove `highlightedTaskId`/`setHighlightedTaskId`/`onHighlightTask`; repoint
  consumers to `isSelected` + `isPeeked`.
- Token + CSS edits across `style.css`, `TaskNode.css/.tsx`, `GroupRect.css/.tsx`,
  `Canvas.css`, `TaskItem.css`, `TaskList.css`, `exportCanvasAsPng.ts`.

## Phasing (each independently shippable)

1. **Tokens + rename** — introduce `--selection-border`/`--peek-border`, recolour
   marquee, swap selection pink→blue, peek stays light blue. No behaviour change.
2. **State unification** — remove `highlightedTaskId`, add `peekedTaskId`, repoint
   canvas + sidebar (selection reflect-only + peek).
3. **Canvas rings** — geometry helper (TDD) + shape/title offset rings for
   selection & peek; drop inline-stroke overlap.
4. **Groups** — click-to-select with threshold + group selection ring.
5. **Panels** — Timeline/Queue → single-select + center; sidebar group-header selection.

## Knobs to tune during build

Selection blue (`#2f6fe0`?), peek blue, widths (canvas 3 / sidebar 2), offset
(2px), resting node border width.

## Phase 1 changelog

- `--selection-stroke` (pink) → renamed `--selection-border` and recoloured to
  `#2f6fe0`; `--selection-fill` recoloured to a blue tint.
- Added `--peek-border` (`#85b0f6`); task-highlight usages repointed to it.
- `--highlight-border` retained for generic accents (SettingsDialog, GroupProgressBar).
- Repointed: `TaskNode.css/.tsx`, `GroupRect.css`, `Canvas.css` (marquee +
  help-pin), `TaskItem.css`, `TaskQueuePanel.css`, `exportCanvasAsPng.ts`.
- No behaviour change — selection is now blue instead of pink; highlight/peek
  unchanged in appearance.

## Phases 2–5 changelog

- Removed `highlightedTaskId`/`onHighlightTask`; added transient `peekedTaskId`
  (set by sidebar row hover/focus, cleared on a canvas-background click via the
  renamed `useDragSelection` `onClearPeek`).
- `TaskNode`: `isHighlighted` → `isPeeked`; status-colour border kept; selection
  and peek now drawn as offset rings around both the shape and the title, via the
  new pure `nodeSelectionRing` helper (TDD'd). Removed the inline-vs-CSS stroke
  overlap and the `.node.selected`/`.node.highlighted` rules.
- Sidebar reflect-only: `TaskItem` gains `.selected` (from `selectedNodes`) and
  `.peeked` (hover); group headers gain `.selected` (from `selectedGroups`).
  Sequence-number and group-header clicks now select + centre.
- `GroupRect`: plain click selects the group (movement threshold distinguishes a
  click from a drag); Cmd/Ctrl-click toggles multi-selection.
- Timeline & Task Queue panels: clicking a row selects that single task + centres
  the canvas; rows reflect selection (recoloured to the selection blue). Leaf
  `TaskCard`/`BlockerCard` keep their `isHighlighted` prop/class (now fed by
  selection) to avoid snapshot churn — a contained naming wart.
- Deviation from the plan: panel/navigation clicks select + centre with no
  toggle-off on re-click (deselect via Escape or empty-canvas click), chosen for
  predictability. Easy to revert to toggle if desired.
