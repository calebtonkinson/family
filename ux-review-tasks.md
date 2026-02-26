# Task Management UX Improvements

## High-Impact (Most Click Reduction)
1. Add a one-click “Complete” affordance on each task row.
- Current: status change requires opening the actions menu.
- Improvement: add a leading checkbox or status pill on `TaskCard` to toggle done/in-progress quickly.
- File: `apps/web/components/tasks/task-card.tsx`

2. Add a “Quick Add” input at the top of the Tasks list.
- Current: creating a task always requires navigating to `/tasks/new`.
- Improvement: simple inline input that creates a task with optional due date and assignee dropdown.
- File: `apps/web/app/(dashboard)/tasks/page.tsx`

3. Add bulk actions in the list.
- Current: no multi-select, so changing status or deleting many tasks is slow.
- Improvement: checkbox select + bulk toolbar for `Complete`, `Assign`, `Move theme/project`, `Delete`.
- File: `apps/web/components/tasks/task-list.tsx`, `apps/web/components/tasks/task-card.tsx`

4. Make status and priority directly editable in the list.
- Current: status change is buried in a dropdown.
- Improvement: show status pill and priority badge as clickable controls on each row.
- File: `apps/web/components/tasks/task-card.tsx`

5. Keep “New Task” persistently accessible on mobile.
- Current: only in top-right of `/tasks` page.
- Improvement: add a floating action button or sticky bottom CTA.
- Files: `apps/web/app/(dashboard)/tasks/page.tsx`, `apps/web/components/layout/fab.tsx`

## Medium-Impact
6. Add sorting and filter chips beyond theme.
- Current: search + theme + status only.
- Improvement: add filters for `Assignee`, `Priority`, `Due date (overdue/today/this week)`, `Recurring`, `Has description`.
- File: `apps/web/app/(dashboard)/tasks/page.tsx`

7. Add status counts on tabs.
- Current: tabs are labels only.
- Improvement: display counts for `To Do`, `In Progress`, `Done`.
- File: `apps/web/app/(dashboard)/tasks/page.tsx`

8. Provide inline “edit” and “delete” on hover (or always visible on mobile).
- Current: actions are in a menu, which slows down rapid work.
- Improvement: add icon buttons at row end; keep menu for secondary actions.
- File: `apps/web/components/tasks/task-card.tsx`

9. Add “Snooze / Reschedule” quick actions.
- Current: due date requires edit flow.
- Improvement: row-level quick options: Today/Tomorrow/Next week.
- File: `apps/web/components/tasks/task-card.tsx`

10. Reduce form overhead with progressive disclosure.
- Current: New and Edit forms show all fields.
- Improvement: show only `Title`, `Due date`, `Assignee` by default; hide `Theme/Project/Recurring` under “More”.
- Files: `apps/web/app/(dashboard)/tasks/new/new-task-client.tsx`, `apps/web/components/tasks/task-edit-sheet.tsx`, `apps/web/app/(dashboard)/tasks/[id]/page.tsx`

## Lower-Impact / Nice Wins
11. Add “Empty state” CTA for filters.
- Current: empty state is plain text.
- Improvement: show “Create your first task” button and sample tasks.
- File: `apps/web/components/tasks/task-list.tsx`

12. Add quick templates or suggested tasks.
- Current: user must enter full text.
- Improvement: allow selecting common tasks (e.g. “Take out trash”) to auto-create.
- File: `apps/web/app/(dashboard)/tasks/new/new-task-client.tsx`

13. Improve comments UX on task detail.
- Current: AI trigger requires typing `@ai`.
- Improvement: add a “Ask AI” button that inserts `@ai` and opens prompt.
- File: `apps/web/app/(dashboard)/tasks/[id]/page.tsx`

14. Make comments actions visible on touch.
- Current: delete action is hover-only.
- Improvement: show always visible for own comments or on long-press.
- File: `apps/web/app/(dashboard)/tasks/[id]/page.tsx`

15. Add “Back to list with same filters.”
- Current: detail page doesn’t preserve list state.
- Improvement: encode filters in query params and return to same list state.
- Files: `apps/web/app/(dashboard)/tasks/page.tsx`, `apps/web/app/(dashboard)/tasks/[id]/page.tsx`
