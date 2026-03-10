# Visual Principles

This document captures the current UI direction for the Home Management app. It is intentionally practical: use it to guide changes to tokens, layouts, components, and page composition.

## Core Direction

- Favor warm-neutral surfaces with a single blue accent family.
- Prefer stronger hierarchy over extra decoration.
- Keep the product feeling domestic and intentional, not like a generic B2B admin template.

## Principles

### 1. Hierarchy Before Ornament

- Solve visual problems first with spacing, contrast, grouping, and scale.
- Decorative gradients and glows should support hierarchy, not replace it.
- If a screen feels weak, reduce ambiguity in surface levels before adding more visual effects.

### 2. One Accent Family

- The shell and primary actions should stay within one blue accent family.
- Avoid mixing orange-to-blue decorative gradients across major surfaces.
- Warmth should come mainly from neutrals and material tone, not from competing accent colors.

### 3. Flatter Dashboard, Richer Inner Screens

- The dashboard home page should avoid double-layered framed cards.
- If the page already has a strong outer surface, do not immediately nest another equally strong shell inside it.
- Inner screens such as tasks, chat, and theme detail can carry more structure because they are destination views.

### 4. Empty States Must Still Feel Designed

- Empty screens should not collapse into blank gray space.
- Use purposeful framing, starter copy, and lightweight supporting structure so the page still feels complete with zero data.
- The goal is to reduce dead space without turning empty states into marketing panels.

### 5. System-Level Consistency

- When refreshing aesthetics, change shared layers first:
  - `apps/web/app/globals.css`
  - `apps/web/components/layout/*`
  - `apps/web/components/ui/*`
- Page-specific styling should build on the system, not fight it.

### 6. Themes Can Be More Expressive

- Theme surfaces can use stronger color presence than the global shell.
- Keep that expressiveness scoped to the theme object or detail surface; do not let it redefine the whole app shell.

## Review Process

- Validate aesthetic changes in-browser on both desktop and mobile.
- Use screenshots before and after significant visual changes.
- When a screen feels too heavy, check for redundant framing layers first.
- When a screen feels too flat, check for missing hierarchy first.

## Current Anti-Patterns

- Double-layered “card inside page-card inside shell-card” compositions on the dashboard.
- Split-brand decorative gradients that blend warm accent hues directly into blue shell accents.
- Large empty areas with only a title and one button.

