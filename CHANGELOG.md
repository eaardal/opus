# Changelog

## [0.6.0] - 2026-05-31

### Added

- Timeline panel showing a task's status duration as a timeline. Use via top-left actionbar on the canvas.
  - Separate timeline segments for each person assigned to the task, with richer segment tooltips
- Presentation Mode that shows each person's assigned work one-by-one by moving around the canvas
  - Status selector in the presentation bar
- Magnifying glass: hold Option/Alt and hover a task to view an enlarged copy of it
- Copy & paste options in the canvas context menus
  - "Copy X items" option in the multi-select context menu
- "Edit title" option in a task's right-click context menu
- "Canvas locked" border and indicator around the canvas when it's locked

### Fixed

- Zoom no longer "jumps" when zooming quickly with an external mouse's scrollwheel. Smoother zoom overall.
- No longer losing edit mode when a task node lost hover state while editing its title
- How group titles are displayed in the magnifying glass panel
- Timeline kickstart logic
- Width allocation for the project selector dropdown

### Changed

- New tasks and new groups now start in edit mode so you can set a title right away
  - Double-clicking a task's node on the canvas enters edit mode even if it has no title yet
  - Larger input field when editing a task's title on the canvas
- Larger hitbox for removing a connection between nodes, making it easier to click

## [0.5.0] - 2026-05-25

### Added

- Viewer-only indicator around canvas so it's easier to understand why you can't edit or move things
- Owner info shown in workspaces that are shared with you

### Fixed

- Undo/redo and Firestore sync issues
- Bugs around duplicating tasks and groups
- Copy & paste and duplicate logic
- Creating a new workspace now also creates an initial project

### Changed

#### Real-time editing

- The storage layer has been totally re-written to better leverage Firestore as a real-time database:
  - Changes, movements and edits on the canvas and tasks should be instantly visible to all users seeing the canvas
  - Save functionality has been removed since all changes are automatically saved immediately
  - Undo/redo and Duplicate Task functionality in particular has some minor bugs yet
  - Might be other issues due to this major change - please report!

#### Other changes

- Button colors updated
- Dark mode theme removed (light mode only going forward)

## [0.4.0] - 2026-05-22

### Added

- Lock/unlock button (top right in canvas) to prevent all canvas elements from being moved
- Pan canvas with scroll gesture (two fingers on laptop touchpad, scrollwheel on external mouse), with option to disable in Settings
- Moving a group also moves its content; hold Shift to move the group independently
- New right-click context menu when multiple canvas nodes are selected
- Duplicate tasks or groups with Cmd+D
- Duplicate option in the task right-click context menu
- Help button in the bottom right corner of the canvas with a keyboard shortcuts reference
- Copy and paste tasks and groups (Cmd+C / Cmd+V). Can be copied in the same canvas or across projects or workspaces.
  - Pasted elements are automatically selected after pasting so they can be moved into place
- Select multiple elements by choosing each by Cmd+clicking them
- Select all elements on the canvas with Cmd+A

### Fixed

- Permission denied errors now show an error screen with actionable options instead of an infinite loader
- Last active project is now selected by defeault when re-opening the app

## [0.3.0] - 2026-04-17

### Added

- Workspace roles: Owner, Editor, Viewer
- User avatar and account info in the top bar
