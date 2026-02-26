# Home Management AI System — Application UX Document

## Purpose

Define the user experience, layout, and interaction patterns for the household management app. This document is the source of truth for screen structure, navigation, and UI behavior.

## UX Principles

- Mobile-first, one-handed use, fast to scan.
- Always show "what needs attention now" first.
- Reduce cognitive load with sensible defaults and quick actions.
- Keep AI assistance close to task workflows, not separate.
- Shared visibility: make ownership, due dates, and status obvious.

## Information Architecture

Primary entities:

- Tasks (with optional project/theme, assignee, due date, recurring)
- Projects (group tasks, optional theme)
- Themes (top-level categories)
- Family Members (people profiles)
- Conversations (AI chat threads linked to entities)

Primary views:

- Dashboard (today + urgent items)
- Tasks (list, filters, detail)
- Projects (list, detail)
- Themes (list, detail)
- Family (members, profiles)
- Chat (AI assistant)
- Settings (account + notifications)

## Navigation Model

Mobile (default):

- Bottom tab bar with 5 tabs:
  - Home
  - Tasks
  - Projects
  - Family
  - Chat
- Persistent Floating Action Button (FAB) for "New" with a quick action sheet:
  - New Task
  - New Project
  - New Theme
  - Add Family Member
- Settings accessible from avatar in top-right of all main screens.

Desktop / tablet:

- Left sidebar with the same 5 tabs.
- Main content area with right-side contextual panel (details, filters, or chat).

## Global UI Elements

### Top App Bar

- Left: Screen title.
- Right: Avatar + notifications badge.
- Optional: contextual actions (filter, sort, search).

### Quick Add (FAB)

- Primary CTA for speed.
- On tap: bottom sheet with entity shortcuts.
- Pre-fill defaults:
  - Task: status = "todo", due date = today if added from Home.
  - Assignee = current user if not set.

### Search

- Available in Tasks and Projects screens.
- Search field uses a dedicated input row beneath the app bar.
- Typeahead for tasks, projects, family members.

### Filters

- Tasks: status, due date, theme, project, assignee, priority.
- Projects: status (active/archived), theme.

## Screen Layouts

### 1) Login

- Centered card with Google Sign-In button.
- Short tagline: "Keep the household in sync."
- Error states: unauthorized email shows clear copy with retry.

### 2) Home (Dashboard)

Goal: Show the immediate work and reminders.

Layout:

- Section: "Today" (due today or overdue).
  - Cards list with task title, assignee chip, due time/date, priority badge.
  - Swipe actions: complete, snooze, reassign.
- Section: "Upcoming" (next 7 days).
  - Collapsible list, grouped by day.
- Section: "Recurring coming up" (next due).
  - Small list with recurrence label.
- Section: "Projects in progress"
  - Horizontal cards with progress (completed / total tasks).
- Empty state: prompts to add first task and theme.

### 3) Tasks List

Goal: Fast scan of all tasks with filtering.

Layout:

- Search + filter row.
- Segmented control: All / To Do / In Progress / Done.
- List items show:
  - Title (primary)
  - Secondary: due date, theme pill, project name
  - Right: assignee avatar + priority icon
- Batch actions:
  - Multi-select for complete, assign, move, archive.
- Pull to refresh on mobile.

### 4) Task Detail

Goal: See context and take action.

Layout:

- Header: title + status dropdown.
- Meta row: due date, assignee, theme, project.
- Description (editable).
- Recurrence card (if recurring).
- Comments timeline (if enabled).
- Action row:
  - Complete
  - Reassign
  - Set due date
  - Add to project
- AI suggestions panel:
  - "Ask AI about this task" entry point.
  - Quick prompts: "break into steps", "estimate time", "suggest schedule".

### 5) Projects List

Layout:

- Search + filter row.
- Card list:
  - Project name, theme pill, due date
  - Progress bar (completed / total tasks)
  - Status: Active / Archived
- Empty state with CTA to create project.

### 6) Project Detail

Layout:

- Header: project name + status toggle.
- Description.
- Linked theme.
- Task list scoped to project.
- Quick add task (inline).
- Optional: AI "plan this project" shortcut.

### 7) Themes

Layout:

- Grid of theme cards with icon + color.
- Tap to open theme detail:
  - Theme header
  - Projects list
  - Tasks list filtered by theme
- Empty state suggests creating a theme to organize tasks.

### 8) Family

Layout:

- Member list with avatars, names, roles.
- Each member profile:
  - Basic info (name, birthday, notes)
  - Assigned tasks list
  - Optional preferences (allergies, notes)
- Add member flow:
  - Name, nickname, birthday, avatar.

### 9) Chat (AI Assistant)

Goal: Conversational help with direct task actions.

Layout:

- Conversation list on left (desktop) or in header dropdown (mobile).
- Main chat area with message stream and typing indicator.
- Composer with:
  - Text input
  - Quick action buttons: "Create task", "List tasks", "Plan week".
- AI responses can include:
  - Task cards with confirm buttons.
  - Inline "Add task" or "Mark complete" actions.
- When linked to an entity, show a small context banner:
  - "Working on: Kitchen Filter Replacement (Task)"

### 10) Settings

Layout:

- Profile settings (name, avatar).
- Household settings (household name, theme defaults).
- Notifications:
  - Push enable toggle
  - Reminder time preferences
  - Daily digest toggle
- Integrations (future): Google Calendar, etc.

## Interaction Patterns

- Swipe actions on list items (complete / snooze / assign).
- Long-press or multi-select on list items for batch actions.
- Inline editing for titles and descriptions.
- Fast creation:
  - From Home or Tasks, new task opens as bottom sheet.
  - Only title required; other fields optional.
- Confirmations:
  - "Complete task" uses undo toast (5 seconds).
  - Destructive actions require confirmation modal.

## Visual System

- Typography: Clear hierarchy; H1 for screen title, H2 for sections.
- Color:
  - Use theme color for chips and highlights.
  - Priority: normal (neutral), high (amber), urgent (red).
- Components:
  - Cards for task/project preview.
  - Chips for theme, project, assignee.
  - Badges for status.
- Spacing:
  - 16px standard padding on mobile.
  - 24px on tablet/desktop.

## Accessibility

- Minimum tap target size 44px.
- High contrast for text and status badges.
- Screen reader labels for icons and actions.
- Keyboard navigation on desktop (tab + enter/space).

## Empty States and Errors

- Friendly empty states with a single CTA.
- Inline error banners for network failures.
- Retry action shown on failed mutations.

## Notifications UX

- Push notifications link directly to relevant task or project.
- Quiet hours configurable in settings.
- Daily digest summary card in Home screen.

## PWA Considerations

- Offline view shows cached tasks and a banner that syncing is paused.
- Install prompt appears after second successful login.
- App icon and splash screen follow manifest defaults.
