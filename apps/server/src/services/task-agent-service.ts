import { generateText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@home/db";
import {
  tasks,
  comments,
  conversations,
  conversationMessages,
  conversationLinks,
  toolCalls,
  toolResults,
  familyMembers,
  themes,
  projects,
} from "@home/db/schema";
import { getTools } from "@home/ai";
import { eq, and, desc } from "drizzle-orm";

interface TaskAgentContext {
  taskId: string;
  commentId: string;
  userMessage: string;
  householdId: string;
  userId: string;
}

// Post an AI comment to the task
async function postAiComment(
  taskId: string,
  content: string,
  conversationId?: string
): Promise<string> {
  const [comment] = await db
    .insert(comments)
    .values({
      taskId,
      userId: null, // AI comments don't have a user
      content,
      isAiGenerated: true,
      conversationId,
    })
    .returning();

  return comment?.id || "";
}

// Gather full task context for the AI
async function getTaskContext(taskId: string, householdId: string) {
  // Get task with relations
  const [taskResult] = await db
    .select({
      task: tasks,
      assignedTo: {
        id: familyMembers.id,
        firstName: familyMembers.firstName,
        lastName: familyMembers.lastName,
      },
      theme: {
        id: themes.id,
        name: themes.name,
      },
      project: {
        id: projects.id,
        name: projects.name,
        description: projects.description,
      },
    })
    .from(tasks)
    .leftJoin(familyMembers, eq(tasks.assignedToId, familyMembers.id))
    .leftJoin(themes, eq(tasks.themeId, themes.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, taskId), eq(tasks.householdId, householdId)))
    .limit(1);

  if (!taskResult) {
    throw new Error("Task not found");
  }

  // Get recent comments for context (excluding the triggering comment)
  const recentComments = await db
    .select({
      comment: comments,
      user: {
        firstName: familyMembers.firstName,
        lastName: familyMembers.lastName,
      },
    })
    .from(comments)
    .leftJoin(familyMembers, eq(comments.userId, familyMembers.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(desc(comments.createdAt))
    .limit(20);

  return {
    task: taskResult.task,
    assignedTo: taskResult.assignedTo,
    theme: taskResult.theme,
    project: taskResult.project,
    recentComments: recentComments.reverse(), // Chronological order
  };
}

// Build system prompt for task agent
function buildTaskAgentPrompt(context: Awaited<ReturnType<typeof getTaskContext>>) {
  const { task, assignedTo, theme, project, recentComments } = context;

  let prompt = `You are an AI assistant helping with a household task. You are responding to a comment on this task.

## Task Details
- **Title**: ${task.title}
- **Status**: ${task.status}
- **Priority**: ${task.priority === 2 ? "Urgent" : task.priority === 1 ? "High" : "Normal"}
${task.description ? `- **Description**: ${task.description}` : ""}
${task.dueDate ? `- **Due Date**: ${task.dueDate}` : ""}
${assignedTo ? `- **Assigned To**: ${assignedTo.firstName} ${assignedTo.lastName || ""}` : ""}
${theme ? `- **Theme**: ${theme.name}` : ""}
${project ? `- **Project**: ${project.name}${project.description ? ` - ${project.description}` : ""}` : ""}
${task.isRecurring ? `- **Recurring**: Every ${task.recurrenceInterval} ${task.recurrenceType}` : ""}
`;

  if (recentComments.length > 0) {
    prompt += `\n## Recent Comments\n`;
    for (const { comment, user } of recentComments) {
      const author = comment.isAiGenerated
        ? "AI Assistant"
        : user?.firstName || "Unknown";
      prompt += `- **${author}**: ${comment.content}\n`;
    }
  }

  prompt += `
## Instructions
- You are responding to a user's comment/question about this task
- Be helpful, concise, and actionable
- If asked to research something, use the webSearch tool
- If asked to update the task, use the updateTask tool
- If asked to break down the task, you can create subtasks using createTask
- Always provide a clear, helpful response
- Format your response for readability (use markdown if helpful)

Today's date is ${new Date().toISOString().split("T")[0]}.`;

  return prompt;
}

// Main function to process an @ai mention
export async function processAiMention(context: TaskAgentContext): Promise<void> {
  const { taskId, userMessage, householdId, userId } = context;

  console.log(`[TaskAgent] Processing @ai mention for task ${taskId}`);

  try {
    // Step 1: Post "On it!" acknowledgment immediately
    const ackCommentId = await postAiComment(
      taskId,
      "On it! Let me look into that..."
    );
    console.log(`[TaskAgent] Posted acknowledgment comment ${ackCommentId}`);

    // Step 2: Create a conversation to track the agent's work
    const [conversation] = await db
      .insert(conversations)
      .values({
        householdId,
        startedById: userId,
        title: `Task Agent: ${userMessage.slice(0, 50)}`,
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      })
      .returning();

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    // Link conversation to the task
    await db.insert(conversationLinks).values({
      conversationId: conversation.id,
      entityType: "task",
      entityId: taskId,
    });

    // Step 3: Gather task context
    const taskContext = await getTaskContext(taskId, householdId);

    // Step 4: Build the system prompt
    const systemPrompt = buildTaskAgentPrompt(taskContext);

    // Step 5: Save user message to conversation
    await db.insert(conversationMessages).values({
      conversationId: conversation.id,
      role: "user",
      content: userMessage,
      sequence: 1,
    });

    // Step 6: Get tools (household tools + Anthropic's native web search)
    const householdTools = getTools({
      householdId,
      userId,
      db,
    });

    // Step 7: Run the AI with native web search
    console.log(`[TaskAgent] Running AI with ${Object.keys(householdTools).length} household tools + web search`);

    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: {
        ...householdTools,
        // Anthropic's native web search tool
        webSearch: anthropic.tools.webSearch_20250305(),
      },
      stopWhen: stepCountIs(5), // Allow up to 5 steps/tool calls
    });

    console.log(`[TaskAgent] AI finished. Text length: ${result.text?.length || 0}, Steps: ${result.steps?.length || 0}`);

    // Step 8: Save assistant message and tool calls
    const [assistantMessage] = await db
      .insert(conversationMessages)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: result.text,
        sequence: 2,
      })
      .returning();

    if (assistantMessage && result.steps) {
      // Save all tool calls and results from all steps
      let toolSequence = 0;
      for (const step of result.steps) {
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const tc of step.toolCalls) {
            // Handle both regular tools (with args) and server tools (like webSearch which may not have args)
            const toolInput = (tc as { args?: Record<string, unknown> }).args || {};
            await db.insert(toolCalls).values({
              messageId: assistantMessage.id,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              toolInput,
              sequence: toolSequence++,
            });
          }
        }

        if (step.toolResults && step.toolResults.length > 0) {
          for (const tr of step.toolResults) {
            // Handle server tools (like webSearch) that may have different result structures
            const resultValue = tr.output;
            await db.insert(toolResults).values({
              conversationId: conversation.id,
              toolCallId: tr.toolCallId,
              messageId: assistantMessage.id,
              result: resultValue,
              isError: false,
            });
          }
        }
      }
    }

    // Step 9: Delete the "On it!" message and post the real response
    await db.delete(comments).where(eq(comments.id, ackCommentId));

    await postAiComment(taskId, result.text || "I couldn't generate a response.", conversation.id);

    console.log(`[TaskAgent] Successfully posted AI response for task ${taskId}`);
  } catch (error) {
    console.error(`[TaskAgent] Error processing @ai mention:`, error);

    // Post an error comment
    await postAiComment(
      taskId,
      "Sorry, I encountered an error while processing your request. Please try again."
    );
  }
}
