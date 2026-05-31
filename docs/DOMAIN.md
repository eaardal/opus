# Domain Knowledge

This document captures the business domain of the application in plain language.
It is the shared reference for what the core concepts mean and how they relate —
independent of how the code is written.

---

## Ubiquitous Language

| Term | Meaning |
| --- | --- |
| **Workspace** | The top-level container an organisation works within. Owns the people, teams, and projects. |
| **Project** | A board inside a workspace. Each project has its own canvas, its own set of categories and statuses, and its own theme. |
| **Canvas** | The visual board for a project where work is laid out spatially. Tasks and groups are positioned freely and can be connected. |
| **Task** | A single unit of work shown on the canvas as a node (a shape with a number badge). A task has a title, a position, a status, an optional category, and zero or more assigned people. |
| **Sequence number** | The number badge shown on each task node. It reflects the task's position in the project's task order, starting at 1. It is the canonical ordering of tasks (e.g. the order presentation mode steps through them). |
| **Status** | Where a task is in its lifecycle: *pending*, *in progress*, *completed*, or *archived*. |
| **Category** | An optional classification for a task (e.g. an area of work). A category carries a colour and a node shape (circle, diamond, triangle). |
| **Group** | A labelled rectangular region drawn on the canvas that visually gathers related tasks. A group has a title, can be locked, and shows a small progress bar for the tasks inside it. Membership is spatial — a task belongs to a group when it sits within the group's bounds. |
| **Connection** | A directed link drawn from one task to another, expressing a relationship or flow between them. |
| **Person** | A member of the workspace who can be assigned to tasks. A person has a name and an optional avatar picture. |
| **Team** | A named collection of people within the workspace. |
| **Assignment** | The relationship between a person and a task they are responsible for. A task may be assigned to several people; a person may be assigned many tasks. A person's avatars are shown on the tasks they are assigned to. Each assignment records *when* the person was assigned, used for per-person time tracking. |
| **In Progress interval** | A single span of time a task spent in the *in progress* status — from when it entered to when it left. A task accumulates one interval each time it is moved into *in progress*, so a task that goes in and out several times has several intervals. The newest interval stays open while the task is currently in progress. Each interval also remembers the status the task moved to when it ended (e.g. completed, pending). |
| **Timeline Panel** | An overlay (like the Task Queue) that lists every task that has ever been in progress, showing how long each has spent in that status — overall and per assigned person — and draws a zoomable/pannable graphical timeline of every In Progress interval. See below. |
| **Viewport** | The visible window onto the canvas — what the user currently sees after panning and zooming. |
| **Presentation mode** | A guided tour of one person's tasks. The user picks a person, then steps the viewport from one of that person's tasks to the next, in sequence-number order, looping back to the start after the last. See below. |
| **Canvas lock** | A toggle that freezes the canvas so elements cannot be moved or edited. While locked, the canvas shows a coloured border. |
| **Viewer** | A read-only participant in a workspace. A viewer sees a "Viewer only" border and cannot edit. |

---

## Presentation mode

Presentation mode is a way to walk an audience through everything a single
person is working on, one task at a time, without manually panning around the
canvas.

- The canvas lists every **person assigned at least one task** in the current
  project, shown by their avatar.
- The user **selects a person** to present. Selecting immediately moves the
  viewport to that person's **first task** (by sequence number).
- A **play button** advances to that person's **next task** on each click. After
  the last task it loops back to the first.
- Moving between tasks uses a **smooth animated glide** rather than an instant
  jump, so the audience stays oriented. Touching the canvas (panning or zooming)
  during a glide hands control straight back to the user.
- A **status filter** decides which of the person's tasks the carousel includes.
  It defaults to **In Progress** (so a presentation starts on what the person is
  actively working on) and offers each status plus an **All** option (which
  includes every status). Changing the filter restarts the carousel at the first
  matching task. The people list itself is unaffected — it always shows everyone
  with at least one assigned task, even if they have none in the chosen status.
- A small **position label** (e.g. `1/5`) shows which task in the sequence is
  currently in view and how many tasks the carousel contains. It reads `0/0` when
  the selected person has no tasks in the chosen status.
- The focus zoom is **semi-close**: the task is comfortably visible with
  surrounding context, rather than filling the whole viewport.

This is a read-only, navigational concept — it never changes tasks, only what
the viewport is looking at.

---

## In Progress time tracking & the Timeline Panel

The app records how long work actually spends in progress, so a team can see
where time is going.

- Every time a task **enters** the *in progress* status, a new **In Progress
  interval** begins; when it **leaves**, that interval ends. A task that bounces
  between *in progress* and *pending* therefore has several intervals. This
  history is stored and kept up to date live.
- The **overall** in-progress time of a task is the sum of all its intervals
  (the current open interval counts up to "now").
- The **per-person** in-progress time is the overlap between the task's
  intervals and the window since that person was **assigned** — i.e. the time
  the task was in progress *while they were on it*. (This is why each assignment
  records when the person was assigned.) A person assigned after all the work
  was done shows zero; a person assigned partway through is credited only from
  that point.
- **Backfill:** tasks that were already in progress, or already assigned, before
  this tracking existed have no history. They simply **start counting from now**
  the first time the project is opened after the feature ships.

The **Timeline Panel** presents this:

- It lists **every task that has ever been in progress** — including ones now
  completed or moved back to pending — not only those in progress right now.
- Each task shows its overall in-progress duration and a per-person breakdown,
  using a compact `7d 3h 2m` format that ticks live.
- A **graphical timeline** plots time along the X axis and draws each task's
  In Progress intervals as boxes (an open, ongoing interval is drawn striped up
  to "now", marked by a live "now" line). The time axis can be **zoomed and
  panned** to inspect any period.
- At every point a task **entered or left** In Progress, a **marker line** shows
  the emoji of the status it changed to — so the sequence reads at a glance
  (e.g. *In Progress → Completed → In Progress*).
- Beneath each task bar, a thin **per-person sub-segment** shows the slice of
  that In Progress time each assigned person was on the task (the same overlap
  used for their per-person total). Hovering any segment shows its exact
  start/end timestamps (an open, ongoing segment shows `<now>` as its end).

Durations are measured from stored timestamps, so they reflect real elapsed
time and continue counting while no one is looking.
