import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  type UIMessage,
} from "ai";
import { db } from "@home/db";
import { recipes } from "@home/db/schema";
import { getTools } from "@home/ai";
import {
  createRecipeSchema,
  updateRecipeSchema,
  recipeFilterSchema,
  idParamSchema,
  paginationSchema,
} from "@home/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export const recipesRouter = new OpenAPIHono();

const ingredientResponseSchema = z.object({
  name: z.string(),
  quantity: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  qualifiers: z.string().optional(),
});

const recipeAttachmentResponseSchema = z.object({
  url: z.string(),
  mediaType: z.string(),
  filename: z.string().optional(),
});

const recipeResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  ingredientsJson: z.array(ingredientResponseSchema),
  instructionsJson: z.array(z.string()),
  tags: z.array(z.string()),
  prepTimeMinutes: z.number().nullable(),
  cookTimeMinutes: z.number().nullable(),
  yieldServings: z.number().nullable(),
  source: z.enum(["photo", "link", "manual", "family"]),
  notes: z.string().nullable(),
  attachmentsJson: z.array(recipeAttachmentResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const parseTags = (queryTags?: string, queryTag?: string) => {
  const tags = new Set<string>();
  if (queryTag) {
    tags.add(queryTag.trim());
  }
  if (queryTags) {
    queryTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .forEach((tag) => tags.add(tag));
  }
  return Array.from(tags);
};

const importRecipeFileSchema = z.object({
  url: z.string().min(1),
  mediaType: z.string().min(1),
  filename: z.string().min(1).optional(),
});

const importRecipeFromFilesSchema = z.object({
  files: z.array(importRecipeFileSchema).min(1).max(10),
  prompt: z.string().trim().min(1).max(2000).optional(),
});

const importRecipeResponseSchema = z.object({
  recipe: z.object({
    id: z.string().uuid(),
    title: z.string(),
  }),
  message: z.string().nullable(),
});

// List recipes
const listRecipesRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: recipeFilterSchema.merge(paginationSchema),
  },
  responses: {
    200: {
      description: "List of recipes",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(recipeResponseSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
});

recipesRouter.openapi(listRecipesRoute, async (c) => {
  const auth = c.get("auth");
  const query = c.req.valid("query");

  const conditions = [eq(recipes.householdId, auth.householdId)];

  if (query.search) {
    const term = `%${query.search}%`;
    const searchCondition = or(ilike(recipes.title, term), ilike(recipes.description, term));
    if (searchCondition) conditions.push(searchCondition);
  }

  const tags = parseTags(query.tags, query.tag);
  if (tags.length > 0) {
    const tagConditions = tags.map(
      (tag) => sql<boolean>`${recipes.tags} ? ${tag}`,
    );
    const tagCondition = or(...tagConditions);
    if (tagCondition) conditions.push(tagCondition);
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const offset = (page - 1) * limit;

  const [recipesList, countResult] = await Promise.all([
    db
      .select()
      .from(recipes)
      .where(and(...conditions))
      .orderBy(desc(recipes.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(recipes)
      .where(and(...conditions)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  const data = recipesList.map((recipe) => ({
    ...recipe,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  }));

  return c.json({
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Get single recipe
const getRecipeRoute = createRoute({
  method: "get",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Recipe details",
      content: {
        "application/json": {
          schema: z.object({ data: recipeResponseSchema }),
        },
      },
    },
    404: {
      description: "Recipe not found",
    },
  },
});

recipesRouter.openapi(getRecipeRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.householdId, auth.householdId)))
    .limit(1);

  if (!recipe) {
    return c.json({ error: "Recipe not found" }, 404);
  }

  return c.json({
    data: {
      ...recipe,
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    },
  });
});

// Create recipe
const createRecipeRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createRecipeSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Recipe created",
      content: {
        "application/json": {
          schema: z.object({ data: recipeResponseSchema }),
        },
      },
    },
  },
});

recipesRouter.openapi(createRecipeRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  const [recipe] = await db
    .insert(recipes)
    .values({
      householdId: auth.householdId,
      title: body.title,
      description: body.description,
      ingredientsJson: body.ingredientsJson ?? [],
      instructionsJson: body.instructionsJson ?? [],
      tags: body.tags ?? [],
      prepTimeMinutes: body.prepTimeMinutes,
      cookTimeMinutes: body.cookTimeMinutes,
      yieldServings: body.yieldServings,
      source: body.source ?? "manual",
      notes: body.notes,
      attachmentsJson: body.attachmentsJson ?? [],
    })
    .returning();

  if (!recipe) {
    throw new Error("Failed to create recipe");
  }

  return c.json(
    {
      data: {
        ...recipe,
        createdAt: recipe.createdAt.toISOString(),
        updatedAt: recipe.updatedAt.toISOString(),
      },
    },
    201,
  );
});

// Import recipe from files using AI without creating a conversation
const importRecipeFromFilesRoute = createRoute({
  method: "post",
  path: "/import-from-files",
  request: {
    body: {
      content: {
        "application/json": {
          schema: importRecipeFromFilesSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Recipe created from file import",
      content: {
        "application/json": {
          schema: z.object({ data: importRecipeResponseSchema }),
        },
      },
    },
    422: {
      description: "Could not extract a recipe",
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
    },
  },
});

recipesRouter.openapi(importRecipeFromFilesRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");
  const attachmentsToPersist = body.files
    .map((file) => ({
      url: file.url,
      mediaType: file.mediaType,
      filename: file.filename,
    }))
    .filter((file) => file.url.trim().length > 0 && file.mediaType.trim().length > 0);

  const normalizeFileUrl = (url: string) => {
    const match = url.match(/^data:(.+?);base64,(.*)$/);
    if (match) {
      return { mediaType: match[1], data: match[2] };
    }
    return { data: url };
  };

  const fileParts: Array<{
    type: "file";
    url: string;
    mediaType: string;
    filename?: string;
  }> = [];

  for (const file of body.files) {
    const normalized = normalizeFileUrl(file.url);
    if (!normalized.data) continue;

    const part: {
      type: "file";
      url: string;
      mediaType: string;
      filename?: string;
    } = {
      type: "file",
      url: normalized.data,
      mediaType: normalized.mediaType ?? file.mediaType,
    };

    if (file.filename) {
      part.filename = file.filename;
    }

    fileParts.push(part);
  }

  if (fileParts.length === 0) {
    return c.json({ error: "At least one valid file is required" }, 422);
  }

  const tools = getTools({
    householdId: auth.householdId,
    userId: auth.userId,
    db,
  });

  const userPrompt =
    body.prompt ??
    "Create one recipe from the attached file(s). Extract ingredients and instructions into separate ordered lists.";

  const messages: Array<Omit<UIMessage, "id">> = [
    {
      role: "user",
      parts: [
        { type: "text", text: userPrompt },
        ...fileParts,
      ],
    },
  ];

  const modelMessages = await convertToModelMessages(messages, { tools });

  const result = await generateText({
    model: openai.chat("gpt-5.1"),
    system: `You extract recipes from uploaded files.
- Always call createRecipe exactly once when there is enough information.
- Store ingredients as structured items and instructions as an ordered list.
- Set source to "photo" for this import.
- If details are missing, make conservative assumptions and put uncertainty in notes.`,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
  });

  let createdRecipe: { id: string; title: string } | null = null;

  for (const step of result.steps ?? []) {
    const toolNameByCallId = new Map<string, string>();
    for (const call of step.toolCalls ?? []) {
      toolNameByCallId.set(call.toolCallId, call.toolName);
    }

    for (const toolResult of step.toolResults ?? []) {
      const toolName = toolNameByCallId.get(toolResult.toolCallId);
      if (toolName !== "createRecipe") continue;

      const output = toolResult.output as
        | {
            success?: boolean;
            recipe?: { id?: string; title?: string };
          }
        | undefined;

      if (!output?.success) continue;
      if (
        output.recipe?.id &&
        output.recipe?.title &&
        typeof output.recipe.id === "string" &&
        typeof output.recipe.title === "string"
      ) {
        createdRecipe = {
          id: output.recipe.id,
          title: output.recipe.title,
        };
      }
    }
  }

  if (!createdRecipe) {
    return c.json(
      {
        error:
          "I couldn't create a recipe from those files. Try clearer files or add a short prompt.",
      },
      422,
    );
  }

  if (attachmentsToPersist.length > 0) {
    await db
      .update(recipes)
      .set({
        attachmentsJson: attachmentsToPersist,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(recipes.id, createdRecipe.id),
          eq(recipes.householdId, auth.householdId),
        ),
      );
  }

  return c.json(
    {
      data: {
        recipe: createdRecipe,
        message: result.text || null,
      },
    },
    201,
  );
});

// Update recipe
const updateRecipeRoute = createRoute({
  method: "patch",
  path: "/:id",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateRecipeSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Recipe updated",
      content: {
        "application/json": {
          schema: z.object({ data: recipeResponseSchema }),
        },
      },
    },
    404: {
      description: "Recipe not found",
    },
  },
});

recipesRouter.openapi(updateRecipeRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.ingredientsJson !== undefined)
    updateData.ingredientsJson = body.ingredientsJson;
  if (body.instructionsJson !== undefined)
    updateData.instructionsJson = body.instructionsJson;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.prepTimeMinutes !== undefined)
    updateData.prepTimeMinutes = body.prepTimeMinutes;
  if (body.cookTimeMinutes !== undefined)
    updateData.cookTimeMinutes = body.cookTimeMinutes;
  if (body.yieldServings !== undefined)
    updateData.yieldServings = body.yieldServings;
  if (body.source !== undefined) updateData.source = body.source;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.attachmentsJson !== undefined)
    updateData.attachmentsJson = body.attachmentsJson;

  const [recipe] = await db
    .update(recipes)
    .set(updateData)
    .where(and(eq(recipes.id, id), eq(recipes.householdId, auth.householdId)))
    .returning();

  if (!recipe) {
    return c.json({ error: "Recipe not found" }, 404);
  }

  return c.json({
    data: {
      ...recipe,
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    },
  });
});

// Delete recipe
const deleteRecipeRoute = createRoute({
  method: "delete",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Recipe deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: {
      description: "Recipe not found",
    },
  },
});

recipesRouter.openapi(deleteRecipeRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [deleted] = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.householdId, auth.householdId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Recipe not found" }, 404);
  }

  return c.json({ success: true });
});
