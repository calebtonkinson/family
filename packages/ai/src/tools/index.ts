import {
  createTaskTool,
  listTasksTool,
  completeTaskTool,
  updateTaskTool,
} from "./task-tools.js";
import { createProjectTool, listProjectsTool } from "./project-tools.js";
import { listFamilyMembersTool, getFamilyMemberTool } from "./family-tools.js";
import { listThemesTool, createThemeTool } from "./theme-tools.js";
import {
  createRecipeTool,
  listRecipesTool,
  searchRecipesTool,
} from "./recipe-tools.js";
import {
  bulkUpsertMealPlansTool,
  getMealPlanningPreferencesTool,
  listMealPlansTool,
  setMealPlanningPreferencesTool,
} from "./meal-planning-tools.js";
import type { ToolContext } from "../types.js";
export * from "./research-tools.js";

export function getTools(context: ToolContext) {
  const tools = {
    createTask: createTaskTool(context),
    listTasks: listTasksTool(context),
    completeTask: completeTaskTool(context),
    updateTask: updateTaskTool(context),
    createProject: createProjectTool(context),
    listProjects: listProjectsTool(context),
    listFamilyMembers: listFamilyMembersTool(context),
    getFamilyMember: getFamilyMemberTool(context),
    listThemes: listThemesTool(context),
    createTheme: createThemeTool(context),
    createRecipe: createRecipeTool(context),
    listRecipes: listRecipesTool(context),
    searchRecipes: searchRecipesTool(context),
    listMealPlans: listMealPlansTool(context),
    bulkUpsertMealPlans: bulkUpsertMealPlansTool(context),
    getMealPlanningPreferences: getMealPlanningPreferencesTool(context),
    setMealPlanningPreferences: setMealPlanningPreferencesTool(context),
  };

  // Debug: log the tool schema
  console.log(
    "[Tools] createTask tool:",
    JSON.stringify(tools.createTask, null, 2)
  );

  return tools;
}

export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  const tools = getTools(context);
  const tool = tools[toolName as keyof typeof tools];

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Tools created with the AI SDK tool() function have an execute method
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executableTool = tool as unknown as {
    execute: (
      input: Record<string, unknown>,
      options?: unknown
    ) => Promise<unknown>;
  };
  return executableTool.execute(input);
}
