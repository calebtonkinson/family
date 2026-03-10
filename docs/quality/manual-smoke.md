# Manual Smoke Matrix

Use this checklist when verifying broad changes locally. The goal is a stable, repeatable baseline that complements automated tests.

## Login

1. Open `http://localhost:3000/login`.
2. Sign in with Google or use the dev login flow when enabled.
3. Confirm redirect to the authenticated app shell.

## Tasks And Projects

1. Create a task from the dashboard or tasks screen.
2. Edit task details and assignment.
3. Mark a task complete.
4. Create or view a project and confirm associated task data renders.

## Lists And Meals

1. Open the lists UI and verify household-scoped data loads.
2. Open recipes and create or edit a recipe, including a URL import or image attachment when relevant.
3. Open meal planning and verify plan data loads for the household.

## Chat

1. Open an existing conversation or create a new one.
2. Send a basic message and confirm the assistant responds.
3. Trigger at least one household tool call and verify the tool result renders in the conversation.

## Deep Research

1. Start a research run from chat.
2. Confirm planning and running states are visible.
3. Wait for completion or failure and confirm status, report content, and source counts render.

## Task Agent

1. Mention `@ai` on a task comment.
2. Confirm the assistant posts a response and creates a linked conversation.

## Notifications

1. Open push notification settings.
2. Confirm permission and subscription UI renders without errors.
