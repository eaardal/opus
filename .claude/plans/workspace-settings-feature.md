# Workspace Settings Feature — Implementation Plan

**Created:** 2026-05-22  
**Status:** Paused — waiting for unmerged branch to land before starting  
**Branch context:** There is a major unmerged branch that would conflict with this feature. Resume after that branch is merged.

---

## Feature Summary

Add a new **Settings** tab to the top app bar (alongside Tasks and Teams). This is a workspace-level settings page for managing task categories and statuses, including:

- Full CRUD for categories (label, color, shape, project assignments)
- Full CRUD for statuses (label, emoji, color, project assignments)
- Project scoping: visibility-only (categories/statuses only appear in pickers for assigned projects)
- Export/import workspace settings as JSON
- Pre-paste mapping modal when pasting tasks with unknown categories/statuses

---

## Key Decisions (already answered)

| Question | Decision |
|----------|----------|
| `task.status` type | Change to `string` (built-in statuses become seeded defaults) |
| Project scoping semantics | Visibility-only — tasks in unassigned projects can still technically hold a value, it just won't appear in pickers |
| Copy/paste mapping UI timing | Pre-paste modal (blocks paste until user resolves unknown refs) |
| Category color | Add single `color: string` (hex) as property on `CategoryDefinition`; remove `CATEGORY_COLORS_DARK/LIGHT` from `theme.ts`; seed built-ins with existing dark-mode values |
| Status color | Add single `color: string` to `StatusDefinition`; built-ins keep existing palette behavior; new custom statuses use the stored color directly |

---

## Codebase Context

- Navigation is **not router-based** — `activeModule` state in `App.tsx` (currently `"tasks" | "teams"`)
- Categories are hardcoded in `src/domain/tasks/categoryConfig.ts` as `CATEGORY_DEFINITIONS: Record<string, CategoryDefinition>`
- Statuses are hardcoded in `src/domain/tasks/statusConfig.ts` as `STATUS_DEFINITIONS: Record<TaskStatus, StatusDefinition>`
- Category colors live in `src/features/tasks/theme.ts` as `CATEGORY_COLORS_DARK/LIGHT` (separate from the definition — needs consolidation)
- Status palette colors live in `src/features/tasks/theme.ts` as `STATUS_PALETTE_DARK/LIGHT`
- Workspace data is stored in Firestore; service implementation is at `src/services/firebase/`
- `WorkspaceService.saveContent(id, content)` persists `{ projects, people, teams }` — `settings` needs to be added here
- Copy/paste logic: `src/domain/tasks/clipboard.ts` — `applyPaste` is where paste happens; `TasksApp.tsx` calls it via `handlePaste`
- `WorkspaceDocument` is in `src/services/workspace.types.ts`

---

## Implementation Phases

### Phase 1 — Domain model changes

**`src/domain/tasks/types.ts`**
- Change `TaskStatus = "pending" | "in_progress" | "completed" | "archived"` to `type TaskStatus = string`

**`src/domain/tasks/categoryConfig.ts`**
- Add `id: string`, `color: string`, `projectIds?: string[]` to `CategoryDefinition`
- `projectIds: undefined` = available to all projects; non-empty array = only those projects
- Seed built-in entries with their existing dark-mode colors from `theme.ts`:
  - backend: `#f6b093`, frontend: `#a0c4f1`, ux: `#f0a6ce`, integration: `#ffffff`, qa: `#e8d97a`, external_dependency: `#b47fe0`
- `CATEGORY_IDS` stays as-is

**`src/domain/tasks/statusConfig.ts`**
- Add `id: string`, `color: string`, `projectIds?: string[]` to `StatusDefinition`
- Seed built-in entries with their existing dark-mode palette colors:
  - pending: `#3a3a5a`, in_progress: `#3737af`, completed: `#2ea058`, archived: `#5e5e5e`

**New `src/domain/workspace/settings.ts`**
```typescript
export interface WorkspaceSettings {
  categories: CategoryDefinition[];
  statuses: StatusDefinition[];
}

// Returns built-in defaults merged with any stored overrides.
// Used when loading workspaces that predate this feature.
export function mergeWithDefaults(stored?: Partial<WorkspaceSettings>): WorkspaceSettings

// Serialize to JSON for export
export function exportSettings(ws: WorkspaceSettings): string

// Parse + validate. Returns null on invalid input.
export function importSettings(json: string): WorkspaceSettings | null
```

**`src/services/workspace.types.ts`**
- Add `settings?: WorkspaceSettings` to `WorkspaceDocument`
- Add `settings?: WorkspaceSettings` to `WorkspaceContent` (the object passed to `saveContent`)

**Firestore implementation** (`src/services/firebase/`)
- Update the Firestore read/write to include `settings` field

---

### Phase 2 — Theme & rendering adapts to new model

**`src/features/tasks/theme.ts`**
- Remove `CATEGORY_COLORS_DARK` and `CATEGORY_COLORS_LIGHT`
- Add `getCategoryColor(def: CategoryDefinition): string` — returns `def.color`
- `STATUS_PALETTE_DARK/LIGHT` stays for built-in statuses
- Add `getStatusPalette(def: StatusDefinition, theme: "dark" | "light"): StatusPalette` — built-ins use the existing palettes, custom statuses use `def.color` directly with auto-derived font color

**New `src/context/WorkspaceSettingsContext.tsx`**
```typescript
interface WorkspaceSettingsContextValue {
  categories: CategoryDefinition[];
  statuses: StatusDefinition[];
  // Filtered by projectIds visibility
  projectCategories(projectId: string): CategoryDefinition[];
  projectStatuses(projectId: string): StatusDefinition[];
  updateSettings(next: WorkspaceSettings): void;
}
```
- App.tsx creates and provides this context
- All components currently importing `CATEGORY_DEFINITIONS` / `STATUS_DEFINITIONS` switch to `useWorkspaceSettings()` hook

---

### Phase 3 — Workspace Settings page

**New files under `src/features/workspace/settings/`:**

```
WorkspaceSettingsPage.tsx     — Container; two sections (Categories, Statuses) + Export/Import
WorkspaceSettingsPage.css
CategoriesSection.tsx         — Table: color swatch | label | shape | projects | edit | delete
StatusesSection.tsx           — Table: emoji | label | color | projects | edit | delete
CategoryEditor.tsx            — Modal form: label, color picker (hex), shape selector, project checklist
StatusEditor.tsx              — Modal form: label, emoji, color picker (hex), project checklist
ExportImportSection.tsx       — Export button (JSON download) + Import button (file picker → validate → preview diff → confirm)
```

**CategoryEditor fields:**
- Label (text)
- Color (hex input + color swatch preview)
- Shape: none / circle / diamond / triangle
- Projects: checklist of workspace projects (all checked by default on create)

**StatusEditor fields:**
- Label (text)
- Emoji (text input)
- Color (hex input + swatch)
- Projects: checklist of workspace projects

**Built-in entries** shown with a "Default" badge; they can be edited or deleted. Deleting a built-in removes it from the workspace's settings (not the source code). If `settings.categories` is empty, `mergeWithDefaults()` re-seeds them.

**ExportImportSection behavior:**
- Export: calls `exportSettings(ws)` → triggers `<a>` download of `workspace-settings.json`
- Import: file input → `importSettings()` → shows preview table (N categories, M statuses) → "Apply" merges into workspace settings → marks unsaved changes

---

### Phase 4 — App.tsx integration

- Add `"settings"` to `ActiveModule` type
- Add Settings tab button in app bar (only rendered when `workspaceId` is set and user role is owner/editor)
- Load `doc.settings` when workspace subscribes; call `mergeWithDefaults(doc.settings)` → store as `workspaceSettings` state
- Wrap module area with `<WorkspaceSettingsContext.Provider>`
- `updateSettings` callback: update state + mark `hasUnsavedChanges = true` (existing Save button persists via `saveContent`)
- Add `WorkspaceSettingsPage` wrapped in module-wrapper div, conditionally visible

```typescript
// App.tsx additions
type ActiveModule = "tasks" | "teams" | "settings";  // add "settings"

const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(
  mergeWithDefaults()
);

// In saveContent call — add settings:
await workspaceService.saveContent(workspaceId, {
  projects: getProjectsForSave(),
  people,
  teams,
  settings: workspaceSettings,
});
```

---

### Phase 5 — Copy/paste category/status mapping

**`src/domain/tasks/clipboard.ts`**

New function:
```typescript
export function detectUnknownRefs(
  clipboard: CanvasClipboard,
  knownCategories: CategoryDefinition[],
  knownStatuses: StatusDefinition[],
): { unknownCategories: string[]; unknownStatuses: string[] }
```
- Match by **label** (case-insensitive) — if label matches a known definition, treat as known
- Returns arrays of unknown IDs (category string values / status string values from pasted tasks)

**New `src/features/tasks/PasteMappingModal.tsx`**
- Pre-paste modal (blocks paste until resolved)
- For each unknown category: row showing "Source category: X" → dropdown of destination categories + "Skip (remove)" option
- Same for unknown statuses
- Returns `{ categoryMap: Record<string, string | null>; statusMap: Record<string, string | null> }` (null = skip/remove reference)
- Confirm button applies mappings; Cancel aborts the paste

**`src/features/tasks/TasksApp.tsx` — `handlePaste` update**
1. Deserialize clipboard (existing)
2. Get current project categories/statuses from context
3. Call `detectUnknownRefs(clipboard, categories, statuses)`
4. If unknowns found → show `PasteMappingModal`, await user input
5. Apply mapping to task `category` and `status` fields before calling `applyPaste`
6. If user cancels modal → abort paste

---

## File Count Summary

| Action | Files |
|--------|-------|
| New source files | ~12 |
| New test files | ~8 |
| Modified source files | ~10 |

---

## Files Modified (full list)

### New
- `src/domain/workspace/settings.ts`
- `src/domain/workspace/settings.test.ts`
- `src/context/WorkspaceSettingsContext.tsx`
- `src/features/workspace/settings/WorkspaceSettingsPage.tsx`
- `src/features/workspace/settings/WorkspaceSettingsPage.css`
- `src/features/workspace/settings/CategoriesSection.tsx`
- `src/features/workspace/settings/StatusesSection.tsx`
- `src/features/workspace/settings/CategoryEditor.tsx`
- `src/features/workspace/settings/StatusEditor.tsx`
- `src/features/workspace/settings/ExportImportSection.tsx`
- `src/features/tasks/PasteMappingModal.tsx`
- `src/features/tasks/PasteMappingModal.css`

### Modified
- `src/domain/tasks/types.ts` — `TaskStatus` union → string alias
- `src/domain/tasks/categoryConfig.ts` — add id, color, projectIds
- `src/domain/tasks/statusConfig.ts` — add id, color, projectIds
- `src/domain/tasks/clipboard.ts` — add `detectUnknownRefs`
- `src/features/tasks/theme.ts` — remove CATEGORY_COLORS maps, update getCategoryColor/getStatusPalette
- `src/services/workspace.types.ts` — add settings to WorkspaceDocument + WorkspaceContent
- `src/services/firebase/` — update Firestore read/write for settings field
- `src/App.tsx` — add Settings tab, workspaceSettings state, context provider
- `src/features/tasks/TasksApp.tsx` — consume context instead of hardcoded config, update handlePaste
- Any components importing `CATEGORY_DEFINITIONS` or `STATUS_DEFINITIONS` directly
