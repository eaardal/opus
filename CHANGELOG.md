# Changelog

## [0.9.0] - 2026-06-07

### Added

- Link tasks — a task can now link to another task, group, or project in the workspace
  - A "Link to…" menu option opens a picker to choose the destination
  - "Go to link destination" navigates there, switching the active project first when needed
  - Linked tasks show a link icon on their label; "Remove link" reverts them to a standard task
- New task status: "Blocked"
- New task category: "Business"
- The active project is now stored in the URL (`?project=…`) and reopened on load
- The selected task or group is stored in the URL and zoomed to on load
- A new setting in the Settings dialog to choose whether the Presentation Bar starts expanded (off/collapsed by default)
- Shift+click to add tasks and groups to a multi-selection
- Explanations of the three category shapes (circle, triangle, diamond) in the "How to Use" panel
- Favicon

### Fixed

- Assigning or unassigning a person in the Task Queue no longer reshuffles the swimlanes — they stay sorted alphabetically by assignee name
- Magnifying glass keeps itself inside the viewport when used on nodes near an edge
- Can now click outside a task title being edited when the click lands on a group

### Changed

- Renamed the "Integration Point" task category to "Milestone"
- Sidebar task list: replaced the sequence number with a category-coloured square that shows the status emoji
- Unified task and group selection into a single highlight model, with refined selected-state styling (dark blue border for all selected/highlight styling)
- "How to Use" table now shows the description first, then the keyboard shortcut
- Presentation bar now shows a "Presentation mode" heading
- Updated the page title

## [0.8.0] - 2026-06-03

### Added

- Close button on the Task Queue and Timeline panels. They can also be closed by pressing Escape
- "Add Task" button on each group in the sidebar's task list, for creating a task directly in that group
- Can use CMD+Scroll to zoom the canvas, in addition to the existing CTRL+Scroll
- Magnifying glass feature is now listed in the "How to Use" table
- Click a task's sequence number in the sidebar to zoom the canvas to that task
- Click a group's header in the sidebar to zoom the canvas to that group
- Added a new "Ungrouped" group on the top of the sidebar for tasks placed directly on the canvas

### Fixed

- Context menus can now be dismissed by clicking outside them over a group background
- Assigned people's avatars now show on tasks with no title (a "<No title>" placeholder keeps the title and its avatars visible)

## [0.7.0] - 2026-06-02

### Added

- Progress bars now animate, with celebratory flourishes:
  - Smooth animated movement as task statuses inside a group change
  - A large progress percentage shown over the group when the progress percentage number change up or down
  - Confetti from a group's progress bar when it reaches 100%
  - Confetti rains down the canvas when the overall progress bar reaches 100%
- The canvas background tints green when every task in the project is completed
- Legend for task categories and statuses in the "How to Use" dialog
- The current project name now appears next to the workspace name in the app bar
- Environment badge for development and staging backends

### Fixed

- Camera zoom no longer takes several clicks to settle when starting a person's presentation
- Canvas action bar tooltips no longer disappear behind the presentation bar

### Changed

- Presentation bar reworked: Now has one Play button per person to hopefully make it more intuitive
- Presentation bar can now be collapsed when not in use
- People assigned to a task are listed above unassigned people in the assign menu
- The task-title editor on the canvas grows to fit its content as you type
- Magnifying glass overlay panel now follows the cursor
- Removed the sequence number from task nodes on the canvas
- Opening a project for the first time snaps the viewport to fit its content

## [0.6.0] - 2026-05-31

### Added

- Experimenal: Timeline panel showing a task's status duration as a timeline. Use via top-right actionbar on the canvas.
  - Separate timeline segments for each person assigned to the task, with richer segment tooltips
- Experimenal: Presentation Mode that shows each person's assigned work one-by-one by moving around the canvas
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
