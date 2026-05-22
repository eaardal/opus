---
name: update-changelog
description: Draft a new changelog entry from recent git commits, prompt the user to confirm or edit it, then prepend it to CHANGELOG.md and regenerate the TypeScript file.
argument-hint: "Optional version number to use (e.g. 0.6.0). If omitted, one will be suggested."
---

## Step 1 — Find the baseline

Read `CHANGELOG.md` from the project root and extract the most recent version entry — the first line matching `## [X.Y.Z]`.

- Record the version string (e.g. `0.5.0`) and the date (e.g. `2026-05-22`).
- Check whether a git tag for that version exists: `git tag --list "v{version}" "vX.Y.Z" "{version}"`.
- If a matching tag exists, set `SINCE=<tag>` (e.g. `v0.5.0`).
- If no tag exists, set `SINCE=` the ISO date from the changelog entry (e.g. `--after="2026-05-21"` — one day before to avoid off-by-one).

## Step 2 — Collect commits

Run:
```
git log {SINCE}..HEAD --no-merges --pretty=format:"%s"
```

If SINCE was a date rather than a tag, run:
```
git log --after="{date}" --no-merges --pretty=format:"%s"
```

Collect the subject lines. Discard lines that look like:
- Version bumps (`bump version`, `release v`, `prepare vX.Y.Z`)
- CI/tooling noise (`trigger build`, `ci:`, `chore: bump`, `format code`)
- Empty lines

## Step 3 — Classify commits into sections

Map each remaining subject line to one of three sections. Use the first matching rule:

| Section     | Match when subject starts with or contains                              |
|-------------|-------------------------------------------------------------------------|
| **Added**   | `feat:`, `add `, `added `, `new `, `implement`, `introduce`, `support`  |
| **Fixed**   | `fix:`, `fix `, `fixed `, `bug`, `resolve`, `correct`, `patch`, `revert`|
| **Changed** | `refactor:`, `update`, `change`, `improve`, `rename`, `move`, `remove`, `delete`, `adjust`, `tweak`, `simplify`, `extract`, `migrate`, `upgrade`, `duplicate` |

For each subject line, strip conventional commit prefixes (`feat:`, `fix:`, `chore:` etc.) before writing the bullet. Capitalise the first word. Do **not** end bullets with a period.

Omit a section entirely if it has no entries.

## Step 4 — Suggest a version number

If the user passed a version argument, use that. Otherwise:

- If there are any **Added** entries → increment the **minor** version (e.g. `0.5.0` → `0.6.0`).
- If there are only **Fixed** or **Changed** entries → increment the **patch** version (e.g. `0.5.0` → `0.5.1`).
- Use today's date (ISO 8601) for the entry date.

## Step 5 — Present the draft and ask for confirmation

Show the user the complete draft entry in Keep a Changelog format:

```
## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Fixed
- ...

### Changed
- ...
```

Then ask:
> "Does this look right? Reply **yes** to write it, or give me your edits (add/remove/reword bullets, change the version) and I'll revise before writing."

Wait for the user's response. If they provide changes, apply them and show the revised draft again before proceeding. Repeat until the user confirms with "yes" or equivalent.

## Step 6 — Prepend the entry to CHANGELOG.md

Once confirmed:

1. Read the current contents of `CHANGELOG.md`.
2. Find the line `# Changelog` (the first line).
3. Insert the confirmed entry as a new block immediately after that header line, separated by a blank line. Preserve all existing content below.
4. Write the updated file.

The result should look like:
```
# Changelog

## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

## [previous version] - ...
...
```

## Step 7 — Regenerate the TypeScript file

Run:
```
mise run generate:changelog
```

Confirm the command exited successfully. Report the new version that was added and note that `frontend/src/generated/changelog.ts` has been updated.
