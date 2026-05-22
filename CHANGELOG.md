# Changelog

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
