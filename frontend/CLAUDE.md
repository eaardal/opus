# Frontend project guidelines

This is a React + TypeScript work tool that runs both as a web app (Firebase Hosting)
and as a Wails-wrapped desktop app. It is **not** a routed website — there is no
React Router, no URL-based navigation, no SEO concerns. UI is organised by
**feature**, not by page.

Global engineering rules in `~/.claude/CLAUDE.md` (testing, design patterns,
TypeScript style) apply on top of everything below.

---

## Directory structure

```
src/
  main.tsx                 entry point
  App.tsx, App.css         root app shell (post-auth, post-workspace selection)
  style.css                global element/body resets
  styles/                  design tokens — CSS custom properties only
                           (colours, accents). Imported once from main.tsx.

  ui/                      reusable, presentational components.
                           No domain knowledge, no I/O, no feature imports.
                           Examples: ConfirmModal, IconButton, Dropdown.

  hooks/                   reusable React hooks. Domain-agnostic glue
                           between React and pure logic.
                           Examples: useHistory, useClickOutside.

  lib/                     pure utilities. No React, no DOM, no I/O.
                           Trivially unit-testable.
                           Examples: avatar.ts, geometry.ts, time.ts.

  domain/                  pure types and pure logic per business concept.
                           No React, no Firebase. Each operation is a plain
                           function on plain types — these files are the
                           primary unit-test target.
                           Examples:
                             domain/workspace/types.ts
                             domain/workspace/parseWorkspaceFile.ts (+ test)
                             domain/tasks/operations.ts (+ test)
                             domain/tasks/svgCoords.ts (+ test)

  services/                I/O boundaries. Interfaces here, concrete impls
                           in subfolders. The rest of the app depends on
                           interfaces only.
                             services/types.ts        AuthService, WorkspaceService
                             services/container.ts    chooses an impl at boot
                             services/firebase/       Firebase impl
                             services/platform.ts     desktop/web detection

  features/                view code for each business area.
                             features/auth/
                             features/workspace/
                             features/tasks/
                             features/teams/
                           Feature views consume domain/, hooks/, ui/,
                           and services/ — never each other.
```

---

## Layering rules

The dependency direction is strict. A layer may depend on layers below it,
never above:

```
features/          (views, feature-local hooks, feature-local components)
   │ depends on
   ▼
ui/  +  hooks/  +  services/  +  domain/  +  lib/  +  styles/
```

- `domain/` and `lib/` import nothing from React, Firebase, or anything in
  `features/` / `ui/` / `services/`. They are pure TypeScript.
- `services/` may import `domain/` types but never `features/` or `ui/`.
- `ui/` components may import `lib/` and `hooks/`, never `domain/` (they
  shouldn't know about workspaces, tasks, or teams).
- `features/` may import everything below it but **never each other**. If
  two features need to share something, it belongs in `domain/`, `hooks/`,
  `ui/`, or `lib/`.

If you find yourself wanting to import from one feature into another, that's
a sign the shared piece needs to move down a layer.

---

## File-size and shape conventions

- **One primary export per file.** A file named `Canvas.tsx` exports one
  `Canvas` component. Co-locate small private helpers in the same file only
  if they are used exclusively by that component and stay short.
- **~200 lines is the soft ceiling for a view file.** When a `.tsx` file
  passes that, look for what is *not* inherently view-coupled — pure math,
  state-shape transformations, parsing, formatting — and push it down to
  `lib/`, `domain/`, or a hook.
- **~30 lines is the soft ceiling for a function.** Extract before that.
- **Co-locate tests** next to source: `parseWorkspaceFile.ts` and
  `parseWorkspaceFile.test.ts` live in the same folder.
- **Component folders** are appropriate when a component has tightly-coupled
  siblings (`Canvas.tsx` + `Canvas.css` + `TaskNode.tsx` only used by Canvas).
  Group as `Canvas/` with all of those inside. The folder name matches the
  primary component.
- **No barrel files** (`index.ts` re-exports). They obscure where imports
  come from and hurt tree-shaking.

---

## What goes where — heuristics

When you write something new, ask:

1. *Does it import React?*
   - No → `lib/` (if generic) or `domain/<concept>/` (if business-specific).
   - Yes, and it's a hook → `hooks/` (if reusable) or alongside the component
     that uses it (if feature-specific).
   - Yes, and it's a component → `ui/` (if it has no domain knowledge) or
     `features/<feature>/` (if it does).

2. *Does it touch Firebase / network / storage?*
   - The interface goes in `services/types.ts`.
   - The implementation goes in `services/firebase/` (or another impl folder).

3. *Does it transform domain state (tasks, workspaces, teams)?*
   - It belongs in `domain/<concept>/` as a pure function with a unit test.
   - View components should call into it, not contain it.

4. *Does it just render UI from props?*
   - `ui/` if the props are primitive/generic.
   - `features/<feature>/` if the props mention domain types.

---

## Testing

Full testing philosophy is in `~/.claude/rules/testing.md`. Project-specific
notes:

- **Mock library: Vitest built-ins (`vi.fn`, `vi.mocked`).** No additional
  mocking dependencies. The repo uses Vitest + React Testing Library + jsdom.
- **TDD applies to `domain/`, `lib/`, and `hooks/`** — write the failing test
  first, see the right failure, write minimum code to pass, refactor.
- **Snapshot/UI tests are appropriate for `ui/` primitives** and small
  presentational components in `features/` whose visual output matters
  (e.g. small dialogs, item cards). Avoid snapshot-testing large feature
  views — they churn too much and the failures are noise.
- **Don't snapshot-test the Canvas, the QueuePanel, or anything with lots
  of interaction state.** Test the underlying domain functions instead.
- **Co-locate test files** next to source (`Foo.tsx` → `Foo.test.tsx`).

---

## Specific notes for this codebase

- **Theme is per-project**, stored in `ProjectData.theme` and applied via
  `data-theme` on `<html>`. Sign-in screen forces light mode.
- **`workspaceService` is the only persistence path** — no localStorage for
  workspace state. (The legacy "Open" button reads JSON files on disk for
  one-time migration only, then saves into Firestore on the next save.)
- **Email allow-list is enforced both client-side
  (`services/firebase/authService.ts`) and in `firestore.rules`.** Both must
  stay in sync. If you change the list, change it in both places.
- **Wails desktop integration**: `services/platform.ts` detects desktop;
  `wailsjs/` contains generated bindings (do not edit). Auth uses a Go-side
  OAuth flow on desktop.

---

## When in doubt

The structure exists to keep things testable and movable. Follow the layering
rules; if something is hard to place, that usually means it has more than one
responsibility — split it before placing it.
