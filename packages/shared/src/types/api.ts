import { z } from "zod";

// Date string schema that accepts both "YYYY-MM-DD" (from HTML date input) and full ISO datetime
const dateStringSchema = z.string().refine(
  (val) => {
    // Accept YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return !isNaN(Date.parse(val));
    }
    // Accept full ISO datetime format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      return !isNaN(Date.parse(val));
    }
    return false;
  },
  { message: "Invalid date format. Expected YYYY-MM-DD or ISO datetime string" }
);

const dateOnlyStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD");

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

// Task schemas
export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "archived",
]);

export const recurrenceTypeSchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "custom_days",
]);

export const prioritySchema = z.number().int().min(0).max(2);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  themeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  dueDate: dateStringSchema.optional(),
  isRecurring: z.boolean().optional(),
  recurrenceType: recurrenceTypeSchema.optional(),
  recurrenceInterval: z.number().int().positive().optional(),
  priority: prioritySchema.optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  description: z.string().max(5000).nullable().optional(),
  themeId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  dueDate: dateStringSchema.nullable().optional(),
  recurrenceType: recurrenceTypeSchema.nullable().optional(),
  recurrenceInterval: z.number().int().positive().nullable().optional(),
  status: taskStatusSchema.optional(),
});

export const taskFilterSchema = z.object({
  status: taskStatusSchema.optional(),
  themeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  dueBefore: dateStringSchema.optional(),
  dueAfter: dateStringSchema.optional(),
  isRecurring: z.boolean().optional(),
});

// Recipe schemas
export const ingredientSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.union([z.string(), z.number()]).optional(),
  unit: z.string().max(50).optional(),
  qualifiers: z.string().max(200).optional(),
});

export const recipeSourceSchema = z.enum([
  "photo",
  "link",
  "manual",
  "family",
]);

export const recipeAttachmentSchema = z.object({
  url: z.string().min(1),
  mediaType: z.string().min(1).max(255),
  filename: z.string().min(1).max(500).optional(),
});

export const createRecipeSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  ingredientsJson: z.array(ingredientSchema).optional(),
  instructionsJson: z.array(z.string().min(1).max(1000)).optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
  prepTimeMinutes: z.number().int().min(0).max(1440).optional(),
  cookTimeMinutes: z.number().int().min(0).max(1440).optional(),
  yieldServings: z.number().int().min(1).max(200).optional(),
  source: recipeSourceSchema.optional(),
  notes: z.string().max(5000).optional(),
  attachmentsJson: z.array(recipeAttachmentSchema).max(20).optional(),
});

export const updateRecipeSchema = createRecipeSchema.partial();

export const recipeFilterSchema = z.object({
  search: z.string().max(200).optional(),
  tag: z.string().max(100).optional(),
  tags: z.string().max(500).optional(),
});

// Meal planning schemas
export const mealSlotSchema = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
]);

export const mealPlanExternalLinkSchema = z.object({
  url: z.string().url(),
  title: z.string().max(300).optional(),
});

export const mealPlanEntrySchema = z.object({
  planDate: dateOnlyStringSchema,
  mealSlot: mealSlotSchema,
  recipeIdsJson: z.array(z.string().uuid()).max(20).optional(),
  externalLinksJson: z.array(mealPlanExternalLinkSchema).max(20).optional(),
  peopleCovered: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const updateMealPlanSchema = z.object({
  recipeIdsJson: z.array(z.string().uuid()).max(20).optional(),
  externalLinksJson: z.array(mealPlanExternalLinkSchema).max(20).optional(),
  peopleCovered: z.number().int().min(1).max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const bulkUpsertMealPlansSchema = z.object({
  entries: z.array(mealPlanEntrySchema).min(1).max(200),
});

export const mealPlanFilterSchema = z.object({
  startDate: dateOnlyStringSchema.optional(),
  endDate: dateOnlyStringSchema.optional(),
  mealSlot: mealSlotSchema.optional(),
});

export const updateMealPlanningPreferencesSchema = z.object({
  notes: z.string().max(20000).nullable().optional(),
});

// List schemas
export const createListSchema = z.object({
  name: z.string().min(1).max(200),
});

export const updateListSchema = createListSchema.partial();

export const listFilterSchema = z.object({
  search: z.string().max(200).optional(),
});

export const createListItemSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const updateListItemSchema = createListItemSchema
  .partial()
  .extend({
    markedOff: z.boolean().optional(),
  });

export const listIdItemIdParamSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const reorderPinsSchema = z.object({
  pinIds: z.array(z.string().uuid()),
});

export const updateListSharesSchema = z.object({
  userIds: z.array(z.string().uuid()),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  themeId: z.string().uuid().optional(),
  dueDate: dateStringSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  themeId: z.string().uuid().nullable().optional(),
  dueDate: dateStringSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

// Theme schemas
export const createThemeSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateThemeSchema = createThemeSchema.partial();

// Family member schemas
export const genderSchema = z.enum([
  "male",
  "female",
  "other",
  "prefer_not_to_say",
]);

export const createFamilyMemberSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  nickname: z.string().max(100).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: genderSchema.optional(),
  avatarUrl: z.string().url().optional(),
  profileData: z.record(z.unknown()).optional(),
});

export const updateFamilyMemberSchema = createFamilyMemberSchema.partial();

// Conversation schemas
export const aiProviderSchema = z.enum(["anthropic", "openai", "google"]);

export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
  provider: aiProviderSchema.default("anthropic"),
  model: z.string().default("claude-sonnet-4-20250514"),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const linkConversationSchema = z.object({
  entityType: z.enum(["theme", "project", "task", "family_member"]),
  entityId: z.string().uuid(),
});

// Deep research schemas
export const researchEffortSchema = z.enum(["quick", "standard", "deep"]);

export const researchPlanSchema = z.object({
  objective: z.string().min(1).max(500),
  subQuestions: z.array(z.string().min(1).max(500)).min(3).max(8),
  assumptions: z.array(z.string().min(1).max(500)).max(20).default([]),
  outputFormat: z.string().min(1).max(500),
  effortRationale: z.string().min(1).max(1500).optional(),
  stopCriteria: z.object({
    confidenceTarget: z.number().min(0).max(1).default(0.75),
    diminishingReturnsDelta: z.number().min(0).max(1).default(0.05),
    diminishingReturnsWindow: z.number().int().min(1).max(5).default(2),
  }),
});

export const researchBudgetSchema = z.object({
  maxSteps: z.number().int().positive(),
  maxRuntimeSeconds: z.number().int().positive(),
  minSources: z.number().int().positive(),
  maxRequeriesPerSubQuestion: z.number().int().min(0),
});

export const createResearchPlanSchema = z.object({
  query: z.string().min(1).max(4000),
  effort: researchEffortSchema.optional().default("standard"),
  recencyDays: z.number().int().min(1).max(3650).nullable().optional(),
});

export const researchPlannerStatusSchema = z.object({
  status: z.enum(["generated", "fallback"]),
  reason: z.string().nullable(),
});

export const createResearchPlanResponseSchema = z.object({
  runId: z.string().uuid(),
  plan: researchPlanSchema,
  budget: researchBudgetSchema,
  planner: researchPlannerStatusSchema,
});

export const runResearchSchema = z.object({
  plan: researchPlanSchema,
});

export const researchSourceSchema = z.object({
  id: z.string().uuid(),
  url: z.string().min(1),
  title: z.string().nullable(),
  domain: z.string().nullable(),
  snippet: z.string().nullable(),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string(),
  score: z.number().nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export const researchFindingSchema = z.object({
  id: z.string().uuid(),
  subQuestion: z.string(),
  claim: z.string(),
  confidence: z.number().min(0).max(1),
  supportingSourceIds: z.array(z.string().uuid()),
  evidence: z.array(
    z.object({
      sourceId: z.string().uuid(),
      excerpt: z.string().nullable(),
      relevanceScore: z.number().min(0).max(1),
      url: z.string().min(1),
      title: z.string().nullable(),
    }),
  ).default([]),
  status: z.enum(["partial", "sufficient", "conflicted", "unknown"]),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const researchActionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  relatedFindingIds: z.array(z.string().uuid()).optional(),
  createdTaskId: z.string().uuid().optional(),
});

// Presentation block schemas (for deep research output)
export const presentationProseBlockSchema = z.object({
  type: z.literal("prose"),
  markdown: z.string().min(1),
});

export const presentationComparisonTableBlockSchema = z.object({
  type: z.literal("comparison_table"),
  caption: z.string().optional(),
  columns: z.array(z.string().min(1)).min(2),
  rows: z.array(
    z.object({
      label: z.string().min(1),
      values: z.array(z.string()),
    }),
  ).min(1),
});

export const presentationRankedListBlockSchema = z.object({
  type: z.literal("ranked_list"),
  title: z.string().optional(),
  items: z.array(
    z.object({
      title: z.string().min(1),
      subtitle: z.string().optional(),
      detail: z.string().optional(),
      url: z.string().optional(),
    }),
  ).min(1),
});

export const presentationSourcesBlockSchema = z.object({
  type: z.literal("sources"),
  items: z.array(
    z.object({
      label: z.string().min(1),
      url: z.string().min(1),
    }),
  ),
});

export const presentationCalloutBlockSchema = z.object({
  type: z.literal("callout"),
  variant: z.enum(["info", "warning", "tip"]),
  content: z.string().min(1),
});

export const presentationActionItemsBlockSchema = z.object({
  type: z.literal("action_items"),
  title: z.string().optional(),
  items: z.array(
    z.object({
      text: z.string().min(1),
      detail: z.string().optional(),
    }),
  ).min(1),
});

export const presentationBlockSchema = z.discriminatedUnion("type", [
  presentationProseBlockSchema,
  presentationComparisonTableBlockSchema,
  presentationRankedListBlockSchema,
  presentationSourcesBlockSchema,
  presentationCalloutBlockSchema,
  presentationActionItemsBlockSchema,
]);

export const researchPresentationSchema = z.object({
  markdown: z.string().min(1),
  blocks: z.array(presentationBlockSchema).default([]),
});

export const researchReportSchema = z.object({
  id: z.string().uuid(),
  summary: z.string(),
  reportMarkdown: z.string(),
  actions: z.array(researchActionSchema),
  presentation: researchPresentationSchema.nullable().optional(),
  createdAt: z.string(),
});

export const researchRunResponseSchema = z.object({
  runId: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: z.enum(["planning", "running", "completed", "completed_with_warnings", "failed", "canceled"]),
  query: z.string(),
  effort: researchEffortSchema,
  recencyDays: z.number().int().nullable(),
  budget: researchBudgetSchema,
  plan: researchPlanSchema,
  metrics: z.record(z.unknown()),
  qualityScore: z.number().min(0).max(1).nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.string().nullable(),
});

export const researchRunEventSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  stage: z.string().min(1),
  status: z.enum(["started", "progress", "completed", "failed", "info"]),
  subQuestion: z.string().nullable(),
  message: z.string().nullable(),
  payload: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});

export const researchStatusResponseSchema = z.object({
  run: researchRunResponseSchema,
  sources: z.array(researchSourceSchema),
  findings: z.array(researchFindingSchema),
  report: researchReportSchema.nullable(),
  events: z.array(researchRunEventSchema).default([]),
});

export const createResearchTasksSchema = z.object({
  findingIds: z.array(z.string().uuid()).default([]),
  actionItems: z
    .array(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(5000).optional(),
        dueDate: dateStringSchema.optional(),
        assignedToId: z.string().uuid().optional(),
        priority: prioritySchema.optional(),
      }),
    )
    .default([]),
}).refine(
  (value) => value.findingIds.length > 0 || value.actionItems.length > 0,
  { message: "At least one finding or action item must be selected" },
);

// Push subscription schemas
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// API Response types
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// Inferred types
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskFilter = z.infer<typeof taskFilterSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type RecurrenceType = z.infer<typeof recurrenceTypeSchema>;

export type IngredientInput = z.infer<typeof ingredientSchema>;
export type RecipeAttachmentInput = z.infer<typeof recipeAttachmentSchema>;
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type RecipeFilter = z.infer<typeof recipeFilterSchema>;
export type RecipeSource = z.infer<typeof recipeSourceSchema>;
export type MealSlot = z.infer<typeof mealSlotSchema>;
export type MealPlanExternalLinkInput = z.infer<typeof mealPlanExternalLinkSchema>;
export type MealPlanEntryInput = z.infer<typeof mealPlanEntrySchema>;
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;
export type BulkUpsertMealPlansInput = z.infer<typeof bulkUpsertMealPlansSchema>;
export type MealPlanFilter = z.infer<typeof mealPlanFilterSchema>;
export type UpdateMealPlanningPreferencesInput = z.infer<
  typeof updateMealPlanningPreferencesSchema
>;

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type ListFilter = z.infer<typeof listFilterSchema>;
export type CreateListItemInput = z.infer<typeof createListItemSchema>;
export type UpdateListItemInput = z.infer<typeof updateListItemSchema>;
export type ReorderPinsInput = z.infer<typeof reorderPinsSchema>;
export type UpdateListSharesInput = z.infer<typeof updateListSharesSchema>;

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export type CreateThemeInput = z.infer<typeof createThemeSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;

export type CreateFamilyMemberInput = z.infer<typeof createFamilyMemberSchema>;
export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>;
export type Gender = z.infer<typeof genderSchema>;

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type LinkConversationInput = z.infer<typeof linkConversationSchema>;

export type ResearchEffort = z.infer<typeof researchEffortSchema>;
export type ResearchPlan = z.infer<typeof researchPlanSchema>;
export type ResearchBudget = z.infer<typeof researchBudgetSchema>;
export type CreateResearchPlanInput = z.infer<typeof createResearchPlanSchema>;
export type CreateResearchPlanResponse = z.infer<typeof createResearchPlanResponseSchema>;
export type ResearchPlannerStatus = z.infer<typeof researchPlannerStatusSchema>;
export type RunResearchInput = z.infer<typeof runResearchSchema>;
export type ResearchRunResponse = z.infer<typeof researchRunResponseSchema>;
export type ResearchRunEvent = z.infer<typeof researchRunEventSchema>;
export type ResearchStatusResponse = z.infer<typeof researchStatusResponseSchema>;
export type CreateResearchTasksInput = z.infer<typeof createResearchTasksSchema>;

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export type PresentationBlock = z.infer<typeof presentationBlockSchema>;
export type ResearchPresentation = z.infer<typeof researchPresentationSchema>;
