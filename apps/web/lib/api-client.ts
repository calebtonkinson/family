import { getSession } from "next-auth/react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/api`
  : "/api/v1";

interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

class ApiClient {
  private async getAuthHeader(): Promise<HeadersInit> {
    const session = await getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const accessToken = (session as unknown as { accessToken?: string }).accessToken;
    if (!accessToken) {
      throw new Error("No access token available");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeader();

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: "Unknown error",
        message: response.statusText,
        statusCode: response.status,
      }));
      throw new Error(error.message || "API request failed");
    }

    return response.json();
  }

  // Tasks
  async getTasks(params?: {
    status?: string;
    themeId?: string;
    projectId?: string;
    assignedToId?: string;
    dueBefore?: string;
    dueAfter?: string;
    isRecurring?: boolean;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request<{ data: Task[]; meta: PaginationMeta }>(
      `/tasks${query ? `?${query}` : ""}`
    );
  }

  async getTask(id: string) {
    return this.request<{ data: Task }>(`/tasks/${id}`);
  }

  async createTask(data: CreateTaskInput) {
    return this.request<{ data: Task }>("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: UpdateTaskInput) {
    return this.request<{ data: Task }>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async completeTask(id: string) {
    return this.request<{ data: Task }>(`/tasks/${id}/complete`, {
      method: "POST",
    });
  }

  async deleteTask(id: string) {
    return this.request<{ success: boolean }>(`/tasks/${id}`, {
      method: "DELETE",
    });
  }

  // Recipes
  async getRecipes(params?: {
    search?: string;
    tag?: string;
    tags?: string;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request<{ data: Recipe[]; meta: PaginationMeta }>(
      `/recipes${query ? `?${query}` : ""}`
    );
  }

  async getRecipe(id: string) {
    return this.request<{ data: Recipe }>(`/recipes/${id}`);
  }

  async createRecipe(data: CreateRecipeInput) {
    return this.request<{ data: Recipe }>("/recipes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async importRecipeFromFiles(data: ImportRecipeFromFilesInput) {
    return this.request<{
      data: {
        recipe: { id: string; title: string };
        message: string | null;
      };
    }>("/recipes/import-from-files", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateRecipe(id: string, data: UpdateRecipeInput) {
    return this.request<{ data: Recipe }>(`/recipes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteRecipe(id: string) {
    return this.request<{ success: boolean }>(`/recipes/${id}`, {
      method: "DELETE",
    });
  }

  // Meal Plans
  async getMealPlans(params?: {
    startDate?: string;
    endDate?: string;
    mealSlot?: MealSlot;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request<{ data: MealPlan[] }>(
      `/meal-plans${query ? `?${query}` : ""}`
    );
  }

  async bulkUpsertMealPlans(data: BulkUpsertMealPlansInput) {
    return this.request<{ data: { created: number; updated: number; total: number } }>(
      "/meal-plans/bulk",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  }

  async updateMealPlan(id: string, data: UpdateMealPlanInput) {
    return this.request<{ data: MealPlan }>(`/meal-plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteMealPlan(id: string) {
    return this.request<{ success: boolean }>(`/meal-plans/${id}`, {
      method: "DELETE",
    });
  }

  // Meal Planning Preferences
  async getMealPlanningPreferences() {
    return this.request<{ data: MealPlanningPreference | null }>(
      "/meal-planning-preferences",
    );
  }

  async updateMealPlanningPreferences(data: UpdateMealPlanningPreferencesInput) {
    return this.request<{ data: MealPlanningPreference }>(
      "/meal-planning-preferences",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  }

  // Lists
  async getLists(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request<{ data: List[]; meta: PaginationMeta }>(
      `/lists${query ? `?${query}` : ""}`
    );
  }

  async getList(id: string, includeMarkedOff?: boolean) {
    const params = includeMarkedOff ? "?includeMarkedOff=true" : "";
    return this.request<{ data: ListWithItems }>(`/lists/${id}${params}`);
  }

  async createList(data: CreateListInput) {
    return this.request<{ data: List }>("/lists", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateList(id: string, data: UpdateListInput) {
    return this.request<{ data: List }>(`/lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteList(id: string) {
    return this.request<{ success: boolean }>(`/lists/${id}`, {
      method: "DELETE",
    });
  }

  async getPinnedLists() {
    return this.request<{ data: PinnedList[] }>("/lists/pinned");
  }

  async pinList(id: string) {
    return this.request<{ data: { pinId: string; listId: string; position: number } }>(
      `/lists/${id}/pin`,
      { method: "POST" }
    );
  }

  async unpinList(id: string) {
    return this.request<{ success: boolean }>(`/lists/${id}/pin`, {
      method: "DELETE",
    });
  }

  async reorderPins(pinIds: string[]) {
    return this.request<{ success: boolean }>("/lists/pins/reorder", {
      method: "PATCH",
      body: JSON.stringify({ pinIds }),
    });
  }

  async addListItem(listId: string, content: string) {
    return this.request<{ data: ListItem }>(`/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  async getHouseholdUsers() {
    return this.request<{ data: { id: string; name: string | null; email: string }[] }>(
      "/household/users"
    );
  }

  async updateListShares(listId: string, userIds: string[]) {
    return this.request<{ data: { sharedUserIds: string[] } }>(
      `/lists/${listId}/shares`,
      {
        method: "PATCH",
        body: JSON.stringify({ userIds }),
      }
    );
  }

  async updateListItem(
    listId: string,
    itemId: string,
    data: { content?: string; markedOff?: boolean }
  ) {
    return this.request<{ data: ListItem }>(`/lists/${listId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteListItem(listId: string, itemId: string) {
    return this.request<{ success: boolean }>(`/lists/${listId}/items/${itemId}`, {
      method: "DELETE",
    });
  }

  // Comments
  async getComments(taskId: string) {
    return this.request<{ data: Comment[] }>(`/tasks/${taskId}/comments`);
  }

  async createComment(
    taskId: string,
    data: { content: string; mentionedFamilyMemberIds?: string[] },
  ) {
    return this.request<{ data: Comment }>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteComment(taskId: string, commentId: string) {
    return this.request<{ success: boolean }>(`/tasks/${taskId}/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  // Projects
  async getProjects(params?: {
    themeId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request<{ data: Project[]; meta: PaginationMeta }>(
      `/projects${query ? `?${query}` : ""}`
    );
  }

  async getProject(id: string) {
    return this.request<{ data: Project }>(`/projects/${id}`);
  }

  async createProject(data: CreateProjectInput) {
    return this.request<{ data: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: UpdateProjectInput) {
    return this.request<{ data: Project }>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.request<{ success: boolean }>(`/projects/${id}`, {
      method: "DELETE",
    });
  }

  // Themes
  async getThemes() {
    return this.request<{ data: Theme[] }>("/themes");
  }

  async getTheme(id: string) {
    return this.request<{ data: Theme }>(`/themes/${id}`);
  }

  async createTheme(data: CreateThemeInput) {
    return this.request<{ data: Theme }>("/themes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTheme(id: string, data: UpdateThemeInput) {
    return this.request<{ data: Theme }>(`/themes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTheme(id: string) {
    return this.request<{ success: boolean }>(`/themes/${id}`, {
      method: "DELETE",
    });
  }

  // Family Members
  async getFamilyMembers() {
    return this.request<{ data: FamilyMember[] }>("/family-members");
  }

  async getFamilyMember(id: string) {
    return this.request<{ data: FamilyMember }>(`/family-members/${id}`);
  }

  async createFamilyMember(data: CreateFamilyMemberInput) {
    return this.request<{ data: FamilyMember }>("/family-members", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateFamilyMember(id: string, data: UpdateFamilyMemberInput) {
    return this.request<{ data: FamilyMember }>(`/family-members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteFamilyMember(id: string) {
    return this.request<{ success: boolean }>(`/family-members/${id}`, {
      method: "DELETE",
    });
  }

  // Conversations
  async getConversations(params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request<{ data: Conversation[]; meta: PaginationMeta }>(
      `/conversations${query ? `?${query}` : ""}`
    );
  }

  async getConversation(id: string) {
    return this.request<{ data: ConversationWithMessages }>(`/conversations/${id}`);
  }

  async createConversation(data: CreateConversationInput) {
    return this.request<{ data: Conversation }>("/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteConversation(id: string) {
    return this.request<{ success: boolean }>(`/conversations/${id}`, {
      method: "DELETE",
    });
  }

  async listResearchRuns(conversationId: string) {
    return this.request<{ data: ResearchRunListItem[] }>(
      `/conversations/${conversationId}/research`,
    );
  }

  async createResearchPlan(
    conversationId: string,
    data: CreateResearchPlanInput,
  ) {
    return this.request<CreateResearchPlanResponse>(
      `/conversations/${conversationId}/research/plan`,
      {
      method: "POST",
      body: JSON.stringify(data),
      },
    );
  }

  async startResearchRun(
    conversationId: string,
    runId: string,
    data: StartResearchRunInput,
  ) {
    return this.request<{ status: "running" }>(
      `/conversations/${conversationId}/research/${runId}/start`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async getResearchRun(conversationId: string, runId: string) {
    return this.request<ResearchRunStatusResponse>(
      `/conversations/${conversationId}/research/${runId}`,
    );
  }

  async createTasksFromResearchRun(
    conversationId: string,
    runId: string,
    data: CreateResearchTasksInput,
  ) {
    return this.request<{ createdTaskIds: string[] }>(
      `/conversations/${conversationId}/research/${runId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  // Push Notifications
  async subscribeToPush(subscription: PushSubscriptionJSON) {
    return this.request<{ success: boolean }>("/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    });
  }

  async unsubscribeFromPush(endpoint: string) {
    return this.request<{ success: boolean }>("/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    });
  }

  async sendTestNotification() {
    return this.request<{ sent: number; total: number }>("/push/test", {
      method: "POST",
    });
  }
}

export const apiClient = new ApiClient();

// Types
export interface Task {
  id: string;
  householdId: string;
  themeId: string | null;
  projectId: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "archived";
  assignedToId: string | null;
  createdById: string;
  dueDate: string | null;
  isRecurring: boolean;
  recurrenceType: "daily" | "weekly" | "monthly" | "yearly" | "custom_days" | null;
  recurrenceInterval: number | null;
  nextDueDate: string | null;
  lastCompletedAt: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { id: string; firstName: string; lastName: string | null } | null;
  theme?: { id: string; name: string; color: string | null } | null;
  project?: { id: string; name: string } | null;
}

export interface Ingredient {
  name: string;
  quantity?: string | number;
  unit?: string;
  qualifiers?: string;
}

export interface RecipeAttachment {
  url: string;
  mediaType: string;
  filename?: string;
}

export interface Recipe {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  ingredientsJson: Ingredient[];
  instructionsJson: string[];
  tags: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  yieldServings: number | null;
  source: "photo" | "link" | "manual" | "family";
  notes: string | null;
  attachmentsJson: RecipeAttachment[];
  createdAt: string;
  updatedAt: string;
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks";

export interface MealPlanExternalLink {
  url: string;
  title?: string;
}

export interface MealPlan {
  id: string;
  householdId: string;
  planDate: string;
  mealSlot: MealSlot;
  recipeId: string | null;
  recipeIdsJson: string[];
  externalLinksJson: MealPlanExternalLink[];
  peopleCovered: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  recipes: Array<{ id: string; title: string }>;
}

export interface MealPlanningPreference {
  id: string;
  householdId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListPreviewItem {
  id: string;
  listId: string;
  content: string;
  addedAt: string;
}

export interface List {
  id: string;
  householdId: string;
  createdById: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  sharedUserIds?: string[];
  previewItems?: ListPreviewItem[];
}

export interface ListItem {
  id: string;
  listId: string;
  content: string;
  addedAt: string;
  markedOffAt: string | null;
}

export interface ListWithItems extends List {
  items: ListItem[];
}

export interface PinnedList extends ListWithItems {
  pinId: string;
  position: number;
}

export interface Project {
  id: string;
  householdId: string;
  themeId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  dueDate: string | null;
  createdAt: string;
  theme?: { id: string; name: string; color: string | null } | null;
  taskCount?: number;
  completedTaskCount?: number;
}

export interface Theme {
  id: string;
  householdId: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  projectCount?: number;
  taskCount?: number;
}

export interface FamilyMember {
  id: string;
  householdId: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  birthday: string | null;
  gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
  avatarUrl: string | null;
  profileData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  assignedTaskCount?: number;
}

export interface Conversation {
  id: string;
  householdId: string;
  startedById: string;
  title: string | null;
  summary: string | null;
  provider: "anthropic" | "openai" | "google";
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ToolCall {
  id: string;
  toolCallId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  sequence: number;
  createdAt: string;
}

export interface ToolResult {
  id: string;
  result: unknown;
  isError: boolean | null;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  toolCallId: string | null;
  sequence: number;
  createdAt: string;
  rawMessage?: Record<string, unknown> | null;
  toolCalls?: ToolCall[];
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
  links: Array<{
    id: string;
    entityType: "theme" | "project" | "task" | "family_member";
    entityId: string;
    createdAt: string;
  }>;
  toolResults?: Record<string, ToolResult>;
}

export type ResearchEffort = "quick" | "standard" | "deep";

export interface ResearchBudget {
  maxSteps: number;
  maxRuntimeSeconds: number;
  minSources: number;
  maxRequeriesPerSubQuestion: number;
}

export interface ResearchPlan {
  objective: string;
  subQuestions: string[];
  assumptions: string[];
  outputFormat: string;
  effortRationale?: string;
  stopCriteria: {
    confidenceTarget: number;
    diminishingReturnsDelta: number;
    diminishingReturnsWindow: number;
  };
}

export interface ResearchRunListItem {
  id: string;
  status: "planning" | "running" | "completed" | "completed_with_warnings" | "failed" | "canceled";
  effort: ResearchEffort;
  query: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchPlannerStatus {
  status: "generated" | "fallback";
  reason: string | null;
}

export interface CreateResearchPlanResponse {
  runId: string;
  plan: ResearchPlan;
  budget: ResearchBudget;
  planner: ResearchPlannerStatus;
}

export interface ResearchSource {
  id: string;
  url: string;
  title: string | null;
  domain: string | null;
  snippet: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  score: number | null;
  metadata: Record<string, unknown> | null;
}

export interface ResearchFinding {
  id: string;
  subQuestion: string;
  claim: string;
  confidence: number;
  supportingSourceIds: string[];
  evidence: Array<{
    sourceId: string;
    excerpt: string | null;
    relevanceScore: number;
    url: string;
    title: string | null;
  }>;
  status: "partial" | "sufficient" | "conflicted" | "unknown";
  notes: string | null;
  createdAt: string;
}

export interface ResearchAction {
  title: string;
  description?: string;
  relatedFindingIds?: string[];
  createdTaskId?: string;
}

export interface ResearchReport {
  id: string;
  summary: string;
  reportMarkdown: string;
  actions: ResearchAction[];
  createdAt: string;
}

export interface ResearchRunData {
  runId: string;
  conversationId: string;
  status: "planning" | "running" | "completed" | "completed_with_warnings" | "failed" | "canceled";
  query: string;
  effort: ResearchEffort;
  recencyDays: number | null;
  budget: ResearchBudget;
  plan: ResearchPlan;
  metrics: Record<string, unknown>;
  qualityScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
}

export interface ResearchRunEvent {
  id: string;
  runId: string;
  stage: string;
  status: "started" | "progress" | "completed" | "failed" | "info";
  subQuestion: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface ResearchRunStatusResponse {
  run: ResearchRunData;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  report: ResearchReport | null;
  events: ResearchRunEvent[];
  presentation?: ResearchPresentationData | null;
}

export interface ResearchPresentationData {
  markdown: string;
  blocks: Array<Record<string, unknown>>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  themeId?: string;
  projectId?: string;
  assignedToId?: string;
  dueDate?: string;
  isRecurring?: boolean;
  recurrenceType?: "daily" | "weekly" | "monthly" | "yearly" | "custom_days";
  recurrenceInterval?: number;
  priority?: number;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: "todo" | "in_progress" | "done" | "archived";
}

export interface CreateRecipeInput {
  title: string;
  description?: string;
  ingredientsJson?: Ingredient[];
  instructionsJson?: string[];
  tags?: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  yieldServings?: number;
  source?: "photo" | "link" | "manual" | "family";
  notes?: string;
  attachmentsJson?: RecipeAttachment[];
}

export type UpdateRecipeInput = Partial<CreateRecipeInput>;

export interface MealPlanEntryInput {
  planDate: string;
  mealSlot: MealSlot;
  recipeIdsJson?: string[];
  externalLinksJson?: MealPlanExternalLink[];
  peopleCovered?: number;
  notes?: string | null;
}

export interface BulkUpsertMealPlansInput {
  entries: MealPlanEntryInput[];
}

export interface UpdateMealPlanInput {
  recipeIdsJson?: string[];
  externalLinksJson?: MealPlanExternalLink[];
  peopleCovered?: number | null;
  notes?: string | null;
}

export interface UpdateMealPlanningPreferencesInput {
  notes?: string | null;
}

export interface ImportRecipeFileInput {
  url: string;
  mediaType: string;
  filename?: string;
}

export interface ImportRecipeFromFilesInput {
  files: ImportRecipeFileInput[];
  prompt?: string;
}

export interface CreateListInput {
  name: string;
}

export type UpdateListInput = Partial<CreateListInput>;

export interface CreateProjectInput {
  name: string;
  description?: string;
  themeId?: string;
  dueDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  themeId?: string | null;
  dueDate?: string | null;
  isActive?: boolean;
}

export interface CreateThemeInput {
  name: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export type UpdateThemeInput = Partial<CreateThemeInput>;

export interface CreateFamilyMemberInput {
  firstName: string;
  lastName?: string;
  nickname?: string;
  birthday?: string;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  avatarUrl?: string;
  profileData?: Record<string, unknown>;
}

export type UpdateFamilyMemberInput = Partial<CreateFamilyMemberInput>;

export interface CreateConversationInput {
  title?: string;
  provider?: "anthropic" | "openai" | "google";
  model?: string;
}

export interface CreateResearchPlanInput {
  query: string;
  effort?: ResearchEffort;
  recencyDays?: number | null;
}

export interface StartResearchRunInput {
  plan: ResearchPlan;
}

export interface CreateResearchTasksInput {
  findingIds: string[];
  actionItems: Array<{
    title: string;
    description?: string;
    dueDate?: string;
    assignedToId?: string;
    priority?: number;
  }>;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string | null;
  content: string;
  isAiGenerated: boolean;
  conversationId?: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string | null } | null;
}
