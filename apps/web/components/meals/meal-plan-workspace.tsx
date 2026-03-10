"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addWeeks, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  useBulkUpsertMealPlans,
  useDeleteMealPlan,
  useMealPlans,
} from "@/hooks/use-meal-plans";
import { useRecipes } from "@/hooks/use-recipes";
import type { MealPlanExternalLink } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
type MealSlot = (typeof MEAL_SLOTS)[number];

type CellDraft = {
  id?: string;
  notes: string;
  recipeIds: string[];
  linksText: string;
};

type EditingCell = {
  planDate: string;
  mealSlot: MealSlot;
};

const emptyCellDraft = (): CellDraft => ({
  notes: "",
  recipeIds: [],
  linksText: "",
});

const MEAL_SLOT_COPY: Record<MealSlot, { label: string; helper: string }> = {
  breakfast: {
    label: "Breakfast",
    helper: "Start the day with something easy to repeat.",
  },
  lunch: {
    label: "Lunch",
    helper: "Use leftovers, sandwiches, or flexible grab-and-go meals.",
  },
  dinner: {
    label: "Dinner",
    helper: "Anchor the day with the meal everyone is planning around.",
  },
};

const keyFor = (planDate: string, mealSlot: MealSlot) => `${planDate}|${mealSlot}`;

const toLinksText = (links: MealPlanExternalLink[]) =>
  links
    .map((link) => (link.title ? `${link.title} | ${link.url}` : link.url))
    .join("\n");

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }
};

const parseLinksText = (value: string): MealPlanExternalLink[] => {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const links: MealPlanExternalLink[] = [];
  for (const line of lines) {
    if (line.includes("|")) {
      const [titlePart, ...urlParts] = line.split("|");
      const title = (titlePart ?? "").trim();
      const url = normalizeUrl(urlParts.join("|"));
      if (url) {
        links.push({ url, title: title || undefined });
      }
      continue;
    }

    const url = normalizeUrl(line);
    if (url) {
      links.push({ url });
    }
  }

  return links;
};

const firstLine = (value: string) => {
  const [line] = value.split("\n");
  return (line ?? "").trim();
};

const normalizeDraft = (draft?: CellDraft) => ({
  notes: draft?.notes.trim() ?? "",
  recipeIds: (draft?.recipeIds ?? []).filter(Boolean),
  linksText: toLinksText(parseLinksText(draft?.linksText ?? "")),
});

const draftSignature = (draft?: CellDraft) => JSON.stringify(normalizeDraft(draft));

const hasCellContent = (draft?: CellDraft) => {
  const normalized = normalizeDraft(draft);
  return (
    normalized.notes.length > 0 ||
    normalized.recipeIds.length > 0 ||
    normalized.linksText.length > 0
  );
};

const buildBaseDrafts = (
  days: Date[],
  mealPlans: Array<{
    id: string;
    planDate: string;
    mealSlot: string;
    notes: string | null;
    recipeIdsJson: string[];
    externalLinksJson: MealPlanExternalLink[];
  }>,
) => {
  const nextDrafts: Record<string, CellDraft> = {};

  for (const day of days) {
    const planDate = format(day, "yyyy-MM-dd");
    for (const mealSlot of MEAL_SLOTS) {
      nextDrafts[keyFor(planDate, mealSlot)] = emptyCellDraft();
    }
  }

  for (const plan of mealPlans) {
    if (!MEAL_SLOTS.includes(plan.mealSlot as MealSlot)) continue;
    const key = keyFor(plan.planDate, plan.mealSlot as MealSlot);
    nextDrafts[key] = {
      id: plan.id,
      notes: plan.notes ?? "",
      recipeIds: plan.recipeIdsJson ?? [],
      linksText: toLinksText(plan.externalLinksJson ?? []),
    };
  }

  return nextDrafts;
};

interface MealPlanWorkspaceProps {
  showHeader?: boolean;
}

export function MealPlanWorkspace({ showHeader = true }: MealPlanWorkspaceProps) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [drafts, setDrafts] = useState<Record<string, CellDraft>>({});
  const [selectedRecipeByCell, setSelectedRecipeByCell] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: mealPlansData, isLoading } = useMealPlans({
    startDate,
    endDate,
  });
  const { data: recipesData } = useRecipes({ limit: 100 });
  const upsertMealPlans = useBulkUpsertMealPlans();
  const deleteMealPlan = useDeleteMealPlan();

  const mealPlans = useMemo(() => mealPlansData?.data ?? [], [mealPlansData?.data]);
  const recipes = useMemo(() => recipesData?.data ?? [], [recipesData?.data]);
  const recipeTitleById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe.title])),
    [recipes],
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const baseDrafts = useMemo(() => buildBaseDrafts(days, mealPlans), [days, mealPlans]);

  useEffect(() => {
    setDrafts(baseDrafts);
    setSelectedRecipeByCell({});
  }, [baseDrafts]);

  useEffect(() => {
    const validDays = new Set(days.map((day) => format(day, "yyyy-MM-dd")));
    if (!validDays.has(selectedDay)) {
      setSelectedDay(format(days[0] ?? new Date(), "yyyy-MM-dd"));
    }
  }, [days, selectedDay]);

  const editingKey = editingCell
    ? keyFor(editingCell.planDate, editingCell.mealSlot)
    : null;
  const editingDraft = editingKey ? drafts[editingKey] : null;
  const isSaving = upsertMealPlans.isPending || deleteMealPlan.isPending;

  const changedKeys = useMemo(
    () =>
      Object.keys(baseDrafts).filter(
        (key) => draftSignature(drafts[key]) !== draftSignature(baseDrafts[key]),
      ),
    [baseDrafts, drafts],
  );

  const changedDayCount = useMemo(
    () => new Set(changedKeys.map((key) => key.split("|")[0])).size,
    [changedKeys],
  );

  const plannedSlotCount = useMemo(
    () =>
      Object.values(drafts).reduce(
        (count, draft) => count + (hasCellContent(draft) ? 1 : 0),
        0,
      ),
    [drafts],
  );

  const selectedDayDate =
    days.find((day) => format(day, "yyyy-MM-dd") === selectedDay) ?? parseISO(selectedDay);

  const weekSummary = useMemo(
    () =>
      days.map((day) => {
        const planDate = format(day, "yyyy-MM-dd");
        const plannedCount = MEAL_SLOTS.reduce((count, mealSlot) => {
          return count + (hasCellContent(drafts[keyFor(planDate, mealSlot)]) ? 1 : 0);
        }, 0);
        const changed = changedKeys.some((key) => key.startsWith(`${planDate}|`));
        const dinnerDraft = drafts[keyFor(planDate, "dinner")];
        const dinnerPreview = dinnerDraft?.recipeIds[0]
          ? recipeTitleById.get(dinnerDraft.recipeIds[0]) ?? "Dinner planned"
          : firstLine(dinnerDraft?.notes ?? "") || null;

        return {
          planDate,
          plannedCount,
          changed,
          dinnerPreview,
        };
      }),
    [changedKeys, days, drafts, recipeTitleById],
  );

  const setCellDraft = (key: string, updater: (current: CellDraft) => CellDraft) => {
    setDrafts((current) => ({
      ...current,
      [key]: updater(current[key] ?? emptyCellDraft()),
    }));
  };

  const openEditor = (planDate: string, mealSlot: MealSlot) => {
    setSelectedDay(planDate);
    setEditingCell({ planDate, mealSlot });
  };

  const clearCell = (key: string) => {
    setCellDraft(key, (current) => ({
      ...current,
      notes: "",
      recipeIds: [],
      linksText: "",
    }));
  };

  const addRecipeToCell = (key: string, recipeId: string) => {
    if (!recipeId) return;
    setCellDraft(key, (current) => ({
      ...current,
      recipeIds: current.recipeIds.includes(recipeId)
        ? current.recipeIds
        : [...current.recipeIds, recipeId],
    }));
    setSelectedRecipeByCell((current) => ({ ...current, [key]: "" }));
  };

  const removeRecipeFromCell = (key: string, recipeId: string) => {
    setCellDraft(key, (current) => ({
      ...current,
      recipeIds: current.recipeIds.filter((id) => id !== recipeId),
    }));
  };

  const savePlanDates = async (planDates: string[], scope: "day" | "week") => {
    const entriesToUpsert: Array<{
      planDate: string;
      mealSlot: MealSlot;
      notes?: string | null;
      recipeIdsJson?: string[];
      externalLinksJson?: MealPlanExternalLink[];
    }> = [];
    const idsToDelete: string[] = [];
    const planDateSet = new Set(planDates);

    for (const planDate of planDateSet) {
      for (const mealSlot of MEAL_SLOTS) {
        const key = keyFor(planDate, mealSlot);
        const cell = drafts[key] ?? emptyCellDraft();
        const notes = cell.notes.trim();
        const recipeIdsJson = cell.recipeIds.filter(Boolean);
        const externalLinksJson = parseLinksText(cell.linksText);
        const hasContent =
          notes.length > 0 || recipeIdsJson.length > 0 || externalLinksJson.length > 0;

        if (hasContent) {
          entriesToUpsert.push({
            planDate,
            mealSlot,
            notes: notes || null,
            recipeIdsJson,
            externalLinksJson,
          });
        } else if (cell.id) {
          idsToDelete.push(cell.id);
        }
      }
    }

    try {
      if (idsToDelete.length > 0) {
        await Promise.all(idsToDelete.map((id) => deleteMealPlan.mutateAsync(id)));
      }
      if (entriesToUpsert.length > 0) {
        await upsertMealPlans.mutateAsync({ entries: entriesToUpsert });
      }

      if (idsToDelete.length === 0 && entriesToUpsert.length === 0) {
        toast({ title: scope === "day" ? "No changes for this day" : "No changes to save" });
        return true;
      }

      toast({ title: scope === "day" ? "Day saved" : "Meal plan saved" });
      return true;
    } catch (error) {
      console.error("Failed to save meal plan", error);
      toast({ title: "Failed to save meal plan", variant: "destructive" });
      return false;
    }
  };

  const saveDay = async (planDate: string) => savePlanDates([planDate], "day");

  const saveWeek = async () =>
    savePlanDates(
      days.map((day) => format(day, "yyyy-MM-dd")),
      "week",
    );

  const renderMealPanel = (planDate: string, mealSlot: MealSlot) => {
    const key = keyFor(planDate, mealSlot);
    const draft = drafts[key];
    const links = parseLinksText(draft?.linksText ?? "");
    const notePreview = firstLine(draft?.notes ?? "");
    const recipeIds = draft?.recipeIds ?? [];
    const contentExists = hasCellContent(draft);

    return (
      <article
        key={key}
        className={cn(
          "rounded-[1.6rem] border p-4 shadow-[inset_0_1px_0_hsl(var(--background)/0.94)] transition-colors",
          contentExists
            ? "border-border/80 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--card)/0.9))]"
            : "empty-state-panel border-dashed",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold">{MEAL_SLOT_COPY[mealSlot].label}</p>
              <Badge variant={contentExists ? "default" : "outline"}>
                {contentExists ? "Planned" : "Open"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{MEAL_SLOT_COPY[mealSlot].helper}</p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => openEditor(planDate, mealSlot)}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit {MEAL_SLOT_COPY[mealSlot].label}</span>
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {recipeIds.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Saved recipes
              </p>
              <div className="flex flex-wrap gap-2">
                {recipeIds.map((id) => (
                  <Link key={id} href={`/recipes/${id}`} className="max-w-full">
                    <Badge
                      variant="secondary"
                      className="max-w-full truncate rounded-full px-3 py-1"
                    >
                      {recipeTitleById.get(id) ?? "Recipe"}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-border/70 bg-background/45 p-3 text-sm text-muted-foreground">
              No saved recipe linked yet.
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Plan notes
            </p>
            <p className="min-h-12 text-sm leading-6 text-foreground/90">
              {notePreview || "Use notes for leftovers, takeout, timing, or who is covered."}
            </p>
          </div>

          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <LinkIcon className="h-3.5 w-3.5" />
              External links
            </p>
            {links.length > 0 ? (
              <div className="space-y-2">
                {links.slice(0, 2).map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-primary underline-offset-2 hover:underline"
                  >
                    {link.title || link.url}
                  </a>
                ))}
                {links.length > 2 ? (
                  <p className="text-xs text-muted-foreground">
                    +{links.length - 2} more link{links.length - 2 > 1 ? "s" : ""}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add links to outside recipes, delivery menus, or inspiration.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => openEditor(planDate, mealSlot)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            {contentExists ? "Refine meal" : "Plan meal"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => clearCell(key)}
            disabled={!contentExists}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      {showHeader ? (
        <section className="rounded-[1.5rem] border border-border/65 bg-background/35 p-5 shadow-[inset_0_1px_0_hsl(var(--background)/0.88)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Meal planning
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl">Plan the week like a household rhythm.</h1>
                <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                  Keep a clear weekly view, then drop into each meal only when the details matter.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Planned
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  {plannedSlotCount}
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Recipes
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{recipes.length}</p>
              </div>
              <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Edited
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  {changedDayCount}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-border/65 bg-background/35 p-4 shadow-[inset_0_1px_0_hsl(var(--background)/0.88)] md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeekStart((current) => subWeeks(current, 1))}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <div className="inline-flex items-center rounded-full border border-border/80 bg-background/65 px-4 py-2 text-sm font-medium shadow-[inset_0_1px_0_hsl(var(--background)/0.92)]">
              <Calendar className="mr-2 h-4 w-4 text-primary" />
              {format(weekStart, "MMM d")} to {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeekStart((current) => addWeeks(current, 1))}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/recipes">
                <BookOpen className="mr-2 h-4 w-4" />
                Browse recipes
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/chat">
                <Sparkles className="mr-2 h-4 w-4" />
                Plan with AI
              </Link>
            </Button>
            <Button type="button" onClick={() => void saveWeek()} disabled={isSaving || isLoading}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save week
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Planned slots
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{plannedSlotCount}/21</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Days touched
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{changedDayCount}</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Saved recipes
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{recipes.length}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_22rem]">
        <section className="rounded-[1.5rem] border border-border/65 bg-background/30 p-4 shadow-[inset_0_1px_0_hsl(var(--background)/0.88)] md:p-5">
          <div className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Selected day
              </p>
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl">
                  {format(selectedDayDate, "EEEE, MMMM d")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Focus on one day at a time without losing the week.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={changedKeys.some((key) => key.startsWith(`${selectedDay}|`)) ? "warning" : "secondary"}>
                {changedKeys.some((key) => key.startsWith(`${selectedDay}|`))
                  ? "Unsaved edits"
                  : "All changes saved"}
              </Badge>
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveDay(selectedDay)}
                disabled={isSaving || isLoading}
              >
                <Save className="mr-2 h-4 w-4" />
                Save day
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {MEAL_SLOTS.map((mealSlot) => renderMealPanel(selectedDay, mealSlot))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[1.45rem] border border-border/65 bg-background/35 p-4 shadow-[inset_0_1px_0_hsl(var(--background)/0.88)]">
            <div className="space-y-1">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Week overview
              </p>
              <h3 className="text-xl">Scan the rhythm</h3>
              <p className="text-sm text-muted-foreground">
                Jump between days and see where the week still feels unfinished.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {weekSummary.map((day) => {
                const isActive = day.planDate === selectedDay;
                return (
                  <button
                    key={day.planDate}
                    type="button"
                    onClick={() => setSelectedDay(day.planDate)}
                    className={cn(
                      "w-full rounded-[1.25rem] border px-4 py-3 text-left transition",
                      isActive
                        ? "border-primary/45 bg-primary/10 shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.55)]"
                        : "border-border/75 bg-background/55 hover:border-primary/30 hover:bg-background/85",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{format(parseISO(day.planDate), "EEEE")}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(day.planDate), "MMM d")}
                        </p>
                      </div>
                      <Badge variant={day.plannedCount > 0 ? "default" : "outline"}>
                        {day.plannedCount}/3
                      </Badge>
                    </div>
                    <p className="mt-3 truncate text-sm text-muted-foreground">
                      {day.dinnerPreview || "No dinner anchor yet."}
                    </p>
                    {day.changed ? (
                      <p className="mt-2 text-xs font-medium text-warning">Unsaved edits</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[1.45rem] border border-border/65 bg-background/35 p-4 shadow-[inset_0_1px_0_hsl(var(--background)/0.88)]">
            <div className="space-y-1">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Planning flow
              </p>
              <h3 className="text-xl">Work from broad to specific</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>1. Pick the day that still feels fuzzy.</p>
              <p>2. Drop in a saved recipe or a simple note.</p>
              <p>3. Add links for outside recipes only when needed.</p>
              <p>4. Save the day, then sweep the whole week once the rhythm feels right.</p>
            </div>
          </section>
        </aside>
      </div>

      <Sheet open={Boolean(editingCell)} onOpenChange={(open) => !open && setEditingCell(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-l border-border/75 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--card)/0.92))] sm:max-w-2xl"
        >
          <SheetHeader>
            <div className="space-y-2 pr-8">
              <Badge variant="secondary" className="w-fit">
                {editingCell ? MEAL_SLOT_COPY[editingCell.mealSlot].label : "Meal"}
              </Badge>
              <SheetTitle className="text-2xl">
                {editingCell ? format(parseISO(editingCell.planDate), "EEEE, MMM d") : "Edit meal"}
              </SheetTitle>
              <SheetDescription>
                Keep this specific and lightweight. Notes, a recipe, or a link is often enough.
              </SheetDescription>
            </div>
          </SheetHeader>

          {editingCell && editingDraft && editingKey ? (
            <div className="mt-6 space-y-5">
              <section className="rounded-[1.5rem] border border-border/75 bg-background/55 p-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Notes</p>
                  <p className="text-sm text-muted-foreground">
                    Use this for leftovers, timing, side dishes, or a no-recipe plan.
                  </p>
                </div>
                <Textarea
                  rows={5}
                  value={editingDraft.notes}
                  onChange={(event) =>
                    setCellDraft(editingKey, (current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder={`What's the plan for ${editingCell.mealSlot}?`}
                  className="mt-4 bg-background/80"
                />
              </section>

              <section className="rounded-[1.5rem] border border-border/75 bg-background/55 p-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Saved recipes</p>
                  <p className="text-sm text-muted-foreground">
                    Attach one or more recipes from the household cookbook.
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Select
                    value={selectedRecipeByCell[editingKey] ?? ""}
                    onValueChange={(value) =>
                      setSelectedRecipeByCell((current) => ({ ...current, [editingKey]: value }))
                    }
                  >
                    <SelectTrigger className="bg-background/80">
                      <SelectValue placeholder="Select a saved recipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {recipes.map((recipe) => (
                        <SelectItem key={recipe.id} value={recipe.id}>
                          {recipe.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addRecipeToCell(editingKey, selectedRecipeByCell[editingKey] || "")}
                    disabled={!selectedRecipeByCell[editingKey]}
                  >
                    Add recipe
                  </Button>
                </div>

                {editingDraft.recipeIds.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {editingDraft.recipeIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removeRecipeFromCell(editingKey, id)}
                        className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/85 px-3 py-1.5 text-sm transition hover:border-primary/35 hover:bg-primary/8"
                      >
                        {recipeTitleById.get(id) ?? "Recipe"}
                        <span aria-hidden="true" className="text-muted-foreground">
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-dashed border-border bg-background/45 p-4 text-sm text-muted-foreground">
                    Nothing linked yet. Notes-only meals work fine too.
                  </div>
                )}
              </section>

              <section className="rounded-[1.5rem] border border-border/75 bg-background/55 p-4">
                <label className="inline-flex items-center gap-2 text-sm font-semibold">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  External links
                </label>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add recipe URLs, delivery menus, or inspiration links. Use `Title | URL` if you want a cleaner label.
                </p>
                <Textarea
                  rows={5}
                  value={editingDraft.linksText}
                  onChange={(event) =>
                    setCellDraft(editingKey, (current) => ({
                      ...current,
                      linksText: event.target.value,
                    }))
                  }
                  placeholder={"https://example.com/recipe\nDinner idea | https://..."}
                  className="mt-4 bg-background/80"
                />
              </section>

              <div className="flex flex-wrap gap-2 border-t border-border/70 pt-2">
                <Button
                  type="button"
                  onClick={async () => {
                    const saved = await saveDay(editingCell.planDate);
                    if (saved) setEditingCell(null);
                  }}
                  disabled={isSaving || isLoading}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save day
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => clearCell(editingKey)}
                  disabled={!hasCellContent(editingDraft)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear meal
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
