"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isValid } from "date-fns";
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  ListChecks,
  Loader2,
  NotebookPen,
  Sparkles,
  TriangleAlert,
  User2,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TOOL_RUNNING_STATES = new Set([
  "call",
  "partial-call",
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
]);

const TOOL_DONE_STATES = new Set(["output", "result", "output-available"]);
const TOOL_ERROR_STATES = new Set(["output-error", "output-denied"]);
const TOOLS_WITH_CUSTOM_RENDERING = new Set([
  "createTask",
  "listTasks",
  "createRecipe",
]);

type ToolCallState =
  | "call"
  | "partial-call"
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output"
  | "result"
  | "output-available"
  | "output-error"
  | "output-denied"
  | string;

export interface ChatToolInvocation {
  id: string;
  toolName: string;
  state?: ToolCallState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

interface ToolInvocationCardProps {
  tool: ChatToolInvocation;
  className?: string;
}

type TaskPriority = "normal" | "high" | "urgent";

interface TaskSummary {
  id: string;
  title: string;
  dueDate: string | null;
  priority: TaskPriority;
  assignedTo: string | null;
}

interface ListTasksOutput {
  count: number;
  tasks: TaskSummary[];
}

interface CreateTaskOutput {
  success: boolean;
  message?: string;
  task?: {
    id: string;
    title: string;
    dueDate: string | null;
  };
}

interface IngredientInput {
  name?: string;
  quantity?: string | number;
  unit?: string;
  qualifiers?: string;
}

interface CreateRecipeInput {
  title?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  yieldServings?: number;
  tags?: string[];
  ingredientsJson?: IngredientInput[];
  instructionsJson?: string[];
}

interface CreateRecipeOutput {
  success: boolean;
  message?: string;
  recipe?: {
    id: string;
    title: string;
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function formatToolName(name: string) {
  return name
    .replace(/^tool-/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatFieldName(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatValuePreview(value: unknown): string {
  if (value === null) return "None";
  if (value === undefined) return "Not set";
  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return "Empty";
    return clean.length > 80 ? `${clean.slice(0, 77)}...` : clean;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "No items";
    const primitiveValues = value.filter(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    );
    if (primitiveValues.length === value.length) {
      const preview = primitiveValues
        .slice(0, 3)
        .map((item) => String(item))
        .join(", ");
      return value.length > 3 ? `${preview} +${value.length - 3} more` : preview;
    }
    return `${value.length} items`;
  }
  const record = toRecord(value);
  if (record) {
    const keyCount = Object.keys(record).length;
    return keyCount === 0 ? "No fields" : `${keyCount} fields`;
  }
  return String(value);
}

function JsonPreview({ value, className }: { value: unknown; className?: string }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? String(value);
  return (
    <pre
      className={cn(
        "max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-[11px] [overflow-wrap:anywhere]",
        className,
      )}
    >
      {text}
    </pre>
  );
}

function KeyValueSummary({
  data,
  emptyLabel = "No fields provided",
  maxFields = 8,
}: {
  data: Record<string, unknown>;
  emptyLabel?: string;
  maxFields?: number;
}) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return <div className="text-xs text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.slice(0, maxFields).map(([key, value]) => (
        <div key={key} className="rounded-md border bg-background/80 px-2.5 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {formatFieldName(key)}
          </div>
          <div className="mt-1 text-[12px] font-medium leading-snug [overflow-wrap:anywhere]">
            {formatValuePreview(value)}
          </div>
        </div>
      ))}
      {entries.length > maxFields && (
        <div className="rounded-md border bg-background/80 px-2.5 py-2 text-[11px] text-muted-foreground sm:col-span-2">
          +{entries.length - maxFields} more fields
        </div>
      )}
    </div>
  );
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!isValid(parsed)) return null;
  return parsed;
}

function formatDueDate(value: string | null) {
  const parsed = parseDate(value);
  if (!parsed) return "No due date";
  return format(parsed, "EEE, MMM d");
}

function priorityBadge(priority: TaskPriority) {
  if (priority === "urgent") return <Badge variant="destructive">Urgent</Badge>;
  if (priority === "high") return <Badge variant="warning">High</Badge>;
  return <Badge variant="secondary">Normal</Badge>;
}

function getToolVisuals(toolName: string) {
  const clean = toolName.replace(/^tool-/, "").toLowerCase();
  if (clean.includes("recipe")) {
    return {
      icon: <ChefHat className="h-4 w-4" />,
      accent: "text-amber-600",
    };
  }
  if (clean.includes("task")) {
    return {
      icon: <ListChecks className="h-4 w-4" />,
      accent: "text-blue-600",
    };
  }
  return {
    icon: <Wrench className="h-4 w-4" />,
    accent: "text-muted-foreground",
  };
}

function RecipeSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-amber-600">
        <ChefHat className="h-4 w-4" />
        <span className="text-xs font-medium">Drafting recipe card...</span>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function TaskSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-blue-600">
        <ListChecks className="h-4 w-4" />
        <span className="text-xs font-medium">Building task card...</span>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function RunningPreview({
  toolName,
  input,
}: {
  toolName: string;
  input: unknown;
}) {
  const clean = toolName.replace(/^tool-/, "");
  if (clean === "createRecipe") {
    return <RecipeSkeleton />;
  }
  if (clean === "createTask" || clean === "listTasks") {
    return <TaskSkeleton />;
  }

  const inputRecord = toRecord(input);
  return (
    <div className="rounded-xl border border-info/30 bg-info/5 p-3 text-xs">
      <div className="mb-2 flex items-center gap-2 font-medium text-info">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>{formatToolName(clean)} is running</span>
      </div>
      {inputRecord ? (
        <KeyValueSummary data={inputRecord} emptyLabel="Waiting for tool input" />
      ) : (
        <div className="text-muted-foreground">Waiting for tool input</div>
      )}
    </div>
  );
}

function CreateTaskCard({
  output,
  input,
}: {
  output: CreateTaskOutput;
  input: unknown;
}) {
  const task = output.task;
  const inputRecord = toRecord(input);
  const inputTitle =
    typeof inputRecord?.title === "string" ? inputRecord.title : undefined;
  const title = task?.title || inputTitle || "New task";
  const dueDate =
    task?.dueDate ??
    (typeof inputRecord?.dueDate === "string" ? inputRecord.dueDate : null);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Task Created
        </span>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDueDate(dueDate)}
        </span>
      </div>
      {task?.id && (
        <Link
          href={`/tasks/${task.id}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open task <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function ListTasksCard({ output }: { output: ListTasksOutput }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Tasks ({output.count})
        </span>
        <BadgeCheck className="h-4 w-4 text-blue-600" />
      </div>
      {output.tasks.length === 0 ? (
        <div className="text-xs text-muted-foreground">No matching tasks.</div>
      ) : (
        <div className="space-y-2">
          {output.tasks.slice(0, 5).map((task) => (
            <div
              key={task.id}
              className="rounded-md border bg-background p-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/tasks/${task.id}`}
                  className="line-clamp-2 font-medium hover:text-primary hover:underline"
                >
                  {task.title}
                </Link>
                {priorityBadge(task.priority)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDueDate(task.dueDate)}
                </span>
                {task.assignedTo && (
                  <span className="inline-flex items-center gap-1">
                    <User2 className="h-3 w-3" />
                    {task.assignedTo}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatIngredient(ingredient: IngredientInput) {
  const quantity =
    ingredient.quantity === undefined ? "" : String(ingredient.quantity);
  const unit = ingredient.unit ?? "";
  const name = ingredient.name ?? "Ingredient";
  const qualifiers = ingredient.qualifiers ? ` (${ingredient.qualifiers})` : "";
  return `${quantity}${quantity && unit ? " " : ""}${unit}${quantity || unit ? " " : ""}${name}${qualifiers}`.trim();
}

function CreateRecipeCard({
  output,
  input,
}: {
  output: CreateRecipeOutput;
  input: unknown;
}) {
  const inputRecord = toRecord(input) as CreateRecipeInput | null;
  const recipeTitle = output.recipe?.title || inputRecord?.title || "New recipe";
  const prep = typeof inputRecord?.prepTimeMinutes === "number" ? inputRecord.prepTimeMinutes : null;
  const cook = typeof inputRecord?.cookTimeMinutes === "number" ? inputRecord.cookTimeMinutes : null;
  const total = prep !== null || cook !== null ? (prep || 0) + (cook || 0) : null;
  const servings =
    typeof inputRecord?.yieldServings === "number" ? inputRecord.yieldServings : null;
  const tags = Array.isArray(inputRecord?.tags) ? inputRecord.tags.filter((tag): tag is string => typeof tag === "string") : [];
  const ingredients = Array.isArray(inputRecord?.ingredientsJson)
    ? inputRecord.ingredientsJson
        .filter((item): item is IngredientInput => Boolean(item && typeof item === "object"))
        .slice(0, 4)
    : [];
  const stepCount = Array.isArray(inputRecord?.instructionsJson)
    ? inputRecord.instructionsJson.length
    : 0;

  return (
    <div className="rounded-lg border border-amber-200/60 bg-card p-3 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
          <ChefHat className="h-3.5 w-3.5" />
          Recipe Saved
        </span>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      </div>
      <div className="text-sm font-semibold">{recipeTitle}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {total !== null && (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {total} min
          </span>
        )}
        {servings !== null && (
          <span className="inline-flex items-center gap-1">
            <NotebookPen className="h-3.5 w-3.5" />
            {servings} servings
          </span>
        )}
        {stepCount > 0 && <Badge variant="secondary">{stepCount} steps</Badge>}
      </div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-100 bg-muted/30 p-2">
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">
            Ingredients
          </div>
          <ul className="space-y-0.5 text-xs">
            {ingredients.map((ingredient, idx) => (
              <li key={`${ingredient.name || "ingredient"}-${idx}`} className="line-clamp-1">
                • {formatIngredient(ingredient)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {output.recipe?.id && (
        <Link
          href={`/recipes/${output.recipe.id}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open recipe <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function SummaryCard({
  toolName,
  output,
}: {
  toolName: string;
  output: unknown;
}) {
  const outputRecord = toRecord(output);
  const message = typeof outputRecord?.message === "string" ? outputRecord.message : null;
  const success = outputRecord?.success;
  const statusText = success === false ? "Action failed" : "Action completed";
  const isFailure = success === false;
  const detailEntries = outputRecord
    ? Object.entries(outputRecord).filter(
      ([key]) => key !== "message" && key !== "success",
    )
    : [];
  const details = Object.fromEntries(detailEntries);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-xs",
        isFailure ? "border-destructive/50 bg-destructive/10" : "bg-card",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        {isFailure ? (
          <TriangleAlert className="h-4 w-4 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        )}
        <span className="font-medium">{statusText}</span>
      </div>
      {message && <div className="text-muted-foreground">{message}</div>}
      {!message && (
        <div className="text-muted-foreground">
          {formatToolName(toolName)} returned data.
        </div>
      )}
      {detailEntries.length > 0 && (
        <div className="mt-2">
          <KeyValueSummary data={details} />
        </div>
      )}
    </div>
  );
}

function OutputRenderer({
  toolName,
  input,
  output,
}: {
  toolName: string;
  input: unknown;
  output: unknown;
}) {
  const cleanToolName = toolName.replace(/^tool-/, "");
  const outputRecord = toRecord(output);
  if (!outputRecord) {
    return <JsonPreview value={output} />;
  }

  if (cleanToolName === "createTask") {
    return <CreateTaskCard output={outputRecord as unknown as CreateTaskOutput} input={input} />;
  }

  if (cleanToolName === "listTasks" && Array.isArray(outputRecord.tasks)) {
    return <ListTasksCard output={outputRecord as unknown as ListTasksOutput} />;
  }

  if (cleanToolName === "createRecipe") {
    return <CreateRecipeCard output={outputRecord as unknown as CreateRecipeOutput} input={input} />;
  }

  return <SummaryCard toolName={cleanToolName} output={output} />;
}

export function ToolInvocationCard({ tool, className }: ToolInvocationCardProps) {
  const cleanToolName = tool.toolName.replace(/^tool-/, "");
  const hasCustomRendering = TOOLS_WITH_CUSTOM_RENDERING.has(cleanToolName);
  const [isExpanded, setIsExpanded] = useState(() => hasCustomRendering);
  const isOutputAvailable = TOOL_DONE_STATES.has(tool.state || "");
  const isError = TOOL_ERROR_STATES.has(tool.state || "");
  const isRunning = TOOL_RUNNING_STATES.has(tool.state || "");
  const isComplete = isOutputAvailable || isError;
  const visuals = getToolVisuals(cleanToolName);
  const hasStructuredResult = isOutputAvailable || isError || isRunning;
  const statusLabel = isRunning ? "Running" : isError ? "Error" : isComplete ? "Done" : "Queued";
  const statusVariant = isError
    ? "destructive"
    : isRunning
      ? "info"
      : isComplete
        ? "success"
        : "secondary";
  const inputRecord = toRecord(tool.input);

  const detailPayload = useMemo(
    () =>
      ({
        tool: cleanToolName,
        state: tool.state,
        input: tool.input,
        output: tool.output,
        error: tool.errorText,
      }),
    [cleanToolName, tool.state, tool.input, tool.output, tool.errorText],
  );

  return (
    <Card
      className={cn(
        "w-full min-w-0 max-w-full overflow-hidden border",
        isError && "border-destructive/30 bg-destructive/5",
        isRunning && "border-info/30 bg-info/5",
        !isError && !isRunning && isComplete && "border-success/30 bg-success/5",
        !isError && !isRunning && !isComplete && "border-border/70 bg-card",
        className,
      )}
    >
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className={cn("shrink-0", visuals.accent)}>{visuals.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {formatToolName(cleanToolName || "Tool")}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {tool.state ? `State: ${tool.state}` : "Awaiting result"}
          </span>
        </span>
        <Badge variant={statusVariant} className="gap-1 text-[10px]">
          {isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isError ? (
            <TriangleAlert className="h-3 w-3" />
          ) : isComplete ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {statusLabel}
        </Badge>
      </button>

      {isExpanded && (
        <div className="min-w-0 space-y-3 border-t border-border/70 bg-background/40 px-3.5 py-3 text-xs">
          {isRunning && <RunningPreview toolName={cleanToolName} input={tool.input} />}

          {!isRunning && tool.input !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-info" />
                Input
              </div>
              {inputRecord ? (
                <KeyValueSummary data={inputRecord} />
              ) : (
                <JsonPreview value={tool.input} />
              )}
            </div>
          )}

          {isOutputAvailable && tool.output !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                Result
              </div>
              <OutputRenderer toolName={cleanToolName} input={tool.input} output={tool.output} />
            </div>
          )}

          {isError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <div className="mb-1 flex items-center gap-2 font-medium text-destructive">
                <TriangleAlert className="h-4 w-4" />
                Tool failed
              </div>
              {tool.errorText && (
                <JsonPreview value={tool.errorText} className="bg-background text-foreground" />
              )}
            </div>
          )}

          {!hasStructuredResult && (
            <JsonPreview value={detailPayload} />
          )}
        </div>
      )}
    </Card>
  );
}
