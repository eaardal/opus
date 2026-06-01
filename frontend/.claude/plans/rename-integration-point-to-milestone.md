# Plan: Rename "Integration Point" category → "Milestone"

**Status:** Planned, not started.
**Created:** 2026-06-01
**Scope decision:** **Option B — full rename including the stored Firestore value** (chosen over the label-only option).
**Open decision (resolve at implementation):** stored-data migration mechanism — one-time **admin script** vs **lazy self-heal** (both documented below).

---

## Key finding (why this is two jobs, not one)

The category **key** and its **display label** are decoupled:

- `src/domain/tasks/categoryConfig.ts:15` —
  `integration: { label: "Integration Point", shape: "diamond" }`
  The object **key** `integration` is the stable id; `"Integration Point"` is only the display string.
- Each task persists `category: "integration"` (the **key**) at
  `workspaces/{wsId}/projects/{projId}/tasks/{taskId}.category`.
  `toTask()` in `src/services/firebase/workspaceService.ts:171` reads it verbatim. Nothing stores the label.
- All consumers (`TaskNode`, `Sidebar/TaskItem`, `TaskContextMenu`) look the label up by key at render time.

So a **visual** rename is a one-liner (just change `label`). Renaming the **stored** value (`integration` → `milestone`) is the real work and needs a data migration. Option B does both.

### Every place the key/label currently appears
- `src/domain/tasks/categoryConfig.ts:15` — definition (key `integration`, label, `shape: "diamond"`).
- `src/features/tasks/theme.ts:38` — `CATEGORY_COLORS.integration = "#f5f5f5"`.
- `src/domain/tasks/categoryConfig.test.ts:10,16-17` — id list + diamond assertion.
- Firestore: every `tasks/{id}` doc with `category: "integration"`.
- No CSS, export, or `firestore.rules` references the key (styling is dynamic by color; rules don't validate category).

---

## PR 1 — code change, fully back-compatible (safe to ship anytime)

1. **`src/domain/tasks/categoryConfig.ts:15`** — rename the key *in place* (keep it 4th so menu order is unchanged):
   ```ts
   milestone: { label: "Milestone", shape: "diamond" },
   ```
2. **`src/features/tasks/theme.ts:38`** — `CATEGORY_COLORS`: `integration` → `milestone` (keep `#f5f5f5` unless a new color is wanted).
3. **`src/domain/tasks/categoryConfig.test.ts`** — update the id list (line 10) and the diamond assertion (line 17) to `milestone`.
4. **Read-time alias** in `src/services/firebase/workspaceService.ts` (`toTask`, ~line 171) — the single choke point for *all* Firestore reads (snapshot at ~416 and `getDocs` at ~465):
   ```ts
   if (data.category != null && data.category !== "") {
     task.category = data.category === "integration" ? "milestone" : data.category;
   }
   ```
   → every existing `integration` task renders as Milestone immediately, before any doc is rewritten. This is the safety net for the whole migration.
5. **Legacy JSON import** (`src/domain/tasks/parseWorkspaceFile.ts`): apply the same `integration → milestone` mapping in the parse path so an old exported JSON can't reintroduce the dead key (the Firestore alias doesn't cover this path).
6. **CHANGELOG** entry (use the `update-changelog` skill).
7. No other code changes — `TaskNode`, `TaskItem`, `TaskContextMenu`, export, CSS all resolve by key dynamically.

**After PR 1:** new writes store `milestone`; old `integration` docs display correctly but are still stored as `integration`.

**Verify PR 1:** `npm run typecheck` / `lint` / `format` / `test:once` (only `categoryConfig.test.ts` is affected). Manually confirm the canvas + context menu show "Milestone", and an existing `integration` task still renders as a grey diamond.

---

## Migrate the stored values (pick one — the read alias from PR 1 covers the gap either way)

### Option B-script — one-time admin script (recommended for a definitive flush)
- Firebase Admin SDK script (net-new; the repo has **no** admin/migration tooling today — needs a service-account key). Add under `scripts/`, document the run command.
- Iterate `workspaces/*/projects/*/tasks/*` (or a `collectionGroup("tasks")` scan), batch-update `category: "integration"` → `"milestone"`.
- Idempotent (re-running matches nothing). Run once; verify the count of remaining `integration` docs is 0.

### Option B-lazy — self-heal on read (no credentials/script)
- Detection must happen where the **raw** doc is visible (the `subscribeProjectContent` handler — `toTask` can't; it lacks the ids). When raw `category === "integration"`, fire `updateDoc(taskDoc(...), { category: "milestone" })`.
- Converges automatically (a rewritten doc no longer matches). Guard with an in-memory `Set` of migrated taskIds to avoid redundant writes, mirroring the existing `backfilledIdsRef` backfill pattern in `TasksApp.tsx`.
- Slower — only converts projects that get opened.

---

## Edge cases / safety
- **Mixed-client window:** an old tab can still write `integration`; the read alias absorbs it. **Do not** remove the alias until all clients are on the new build.
- **`firestore.rules`** (lives in the *parent* repo `opus/`, not `frontend/`): confirm it doesn't whitelist/validate `category` values so the new key isn't rejected (almost certainly not validated — verify).
- Export PNG + CSS: no change (category styling is dynamic by color).

---

## PR 2 — cleanup (only after migration confirmed complete)
- Once a query confirms **zero** remaining `integration` docs, remove:
  - the read-time alias in `toTask`,
  - the `parseWorkspaceFile` mapping,
  - the lazy self-heal (if used).
- Ship this **separately** from PR 1 — classic expand-and-contract; never bundle the contract with the expand.

---

## Quick checklist
- [ ] PR 1: key rename (`categoryConfig.ts`, `theme.ts`), label "Milestone"
- [ ] PR 1: `toTask` read alias + `parseWorkspaceFile` mapping
- [ ] PR 1: update `categoryConfig.test.ts`
- [ ] PR 1: CHANGELOG entry; typecheck/lint/format/test green
- [ ] Decide migration mechanism (admin script vs lazy self-heal)
- [ ] Run migration; verify 0 remaining `integration` docs
- [ ] PR 2: remove alias + mapping (+ lazy self-heal) after verification
