# Chat UX Improvements

## Top Friction (Highest Impact)
1. Actions are hidden behind hover-only UI in the conversation list.
- Current: the “More” menu is only visible on hover (`opacity-0 group-hover:opacity-100`), which is invisible on touch devices and easy to miss on desktop.
- Improvement: make key actions always visible or reveal them on focus/selection; add swipe/long-press on mobile for delete/rename.
- Files: `apps/web/components/chat/chat-sidebar.tsx`

2. Creating a new chat on mobile takes extra steps.
- Current: user must open sheet (menu button), then click “New”.
- Improvement: add a top-level “New chat” button in the header (or floating action button) that’s visible regardless of sidebar state.
- Files: `apps/web/components/chat/chat-sidebar.tsx`, `apps/web/app/(dashboard)/chat/[id]/chat-client.tsx`

3. Quick actions require two steps (click + send).
- Current: quick action buttons only populate input; user must press Send.
- Improvement: add a “Send immediately” behavior, or add “Shift+Click to send” and a small “Send” affordance on the chip.
- Files: `apps/web/components/chat/chat.tsx`

4. No global search or filter for conversations.
- Current: only list + scroll, which becomes slow at scale.
- Improvement: add a search input in the sidebar header and filter by title/date; include shortcut `Ctrl+K` to focus.
- Files: `apps/web/components/chat/chat-sidebar.tsx`

## Medium Friction
5. Tool invocation cards bury results behind a click, and each click is a full expand.
- Current: output hidden until you click into each tool card.
- Improvement: show a one-line preview and add “Copy output” button; keep expanded state sticky per tool.
- Files: `apps/web/components/chat/chat.tsx`

6. Input area has no contextual action affordances.
- Current: only text input + send. Quick actions are above but generic.
- Improvement: add compact action bar next to the input: `Add task`, `Add recipe`, `Add grocery`, `Upload photo`.
- Files: `apps/web/components/chat/chat.tsx`

7. No “jump to bottom” when user scrolls up.
- Current: auto-scroll always happens, but no affordance to resume if user has scrolled.
- Improvement: show a “New messages” pill + “Jump to latest” button when not at bottom.
- Files: `apps/web/components/chat/chat.tsx`

## Low Friction / Nice Wins
8. Notification prompt may obstruct key actions on mobile.
- Current: fixed bottom card can cover input or quick actions.
- Improvement: offset above input or only show on empty screens; allow “Not now” with a smaller footprint.
- Files: `apps/web/components/pwa/notification-prompt.tsx`

9. Sidebar “New” action is only in header and has no keyboard shortcut.
- Improvement: add `Cmd+N`/`Ctrl+N` to start a new conversation and auto-focus input.
- Files: `apps/web/components/chat/chat-sidebar.tsx`, `apps/web/components/chat/chat.tsx`

10. Conversation list lacks key context and inline actions.
- Improvement: add a 1-line preview of last user message, and inline “rename” action (not only delete).
- Files: `apps/web/components/chat/chat-sidebar.tsx`
