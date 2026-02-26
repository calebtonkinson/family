"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import {
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
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

const keyFor = (planDate: string, mealSlot: MealSlot) => `${planDate}|${mealSlot}`;

const formatMealSlot = (slot: MealSlot) =>
  slot.charAt(0).toUpperCase() + slot.slice(1);

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

  useEffect(() => {
    const nextDrafts: Record<string, CellDraft> = {};

    for (const day of days) {
      const planDate = format(day, "yyyy-MM-dd");
      for (const mealSlot of MEAL_SLOTS) {
        nextDrafts[keyFor(planDate, mealSlot)] = {
          notes: "",
          recipeIds: [],
          linksText: "",
        };
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

    setDrafts(nextDrafts);
    setSelectedRecipeByCell({});
  }, [days, mealPlans]);

  useEffect(() => {
    const validDays = new Set(days.map((day) => format(day, "yyyy-MM-dd")));
    if (!validDays.has(selectedDay)) {
      setSelectedDay(format(days[0] ?? new Date(), "yyyy-MM-dd"));
    }
  }, [days, selectedDay]);

  const isSaving = upsertMealPlans.isPending || deleteMealPlan.isPending;

  const editingKey = editingCell
    ? keyFor(editingCell.planDate, editingCell.mealSlot)
    : null;
  const editingDraft = editingKey ? drafts[editingKey] : null;

  const setCellDraft = (key: string, updater: (current: CellDraft) => CellDraft) => {
    setDrafts((current) => {
      const existing = current[key] ?? { notes: "", recipeIds: [], linksText: "" };
      return {
        ...current,
        [key]: updater(existing),
      };
    });
  };

  const openEditor = (planDate: string, mealSlot: MealSlot) => {
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

  const hasCellContent = (draft?: CellDraft) => {
    if (!draft) return false;
    return (
      draft.notes.trim().length > 0 ||
      draft.recipeIds.length > 0 ||
      parseLinksText(draft.linksText).length > 0
    );
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
        const cell = drafts[key] ?? { notes: "", recipeIds: [], linksText: "" };
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

  const saveDay = async (planDate: string) => {
    return savePlanDates([planDate], "day");
  };

  const saveWeek = async () => {
    return savePlanDates(
      days.map((day) => format(day, "yyyy-MM-dd")),
      "week",
    );
  };

  const renderMealCard = (planDate: string, mealSlot: MealSlot) => {
    const key = keyFor(planDate, mealSlot);
    const draft = drafts[key];
    const links = parseLinksText(draft?.linksText ?? "");
    const notePreview = firstLine(draft?.notes ?? "");
    const hasContent = hasCellContent(draft);

    return (
      <Card key={key} className={!hasContent ? "border-dashed" : undefined}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">{formatMealSlot(mealSlot)}</CardTitle>
            <div className="flex items-center gap-1">
              {hasContent ? <Badge variant="secondary">Planned</Badge> : <Badge variant="outline">Empty</Badge>}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditor(planDate, mealSlot)}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">Edit {formatMealSlot(mealSlot)}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {notePreview ? (
            <p className="line-clamp-2 text-sm">{notePreview}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}

          {draft?.recipeIds?.length ? (
            <div className="flex flex-wrap gap-1">
              {draft.recipeIds.slice(0, 3).map((id) => (
                <Link key={id} href={`/recipes/${id}`} className="max-w-full">
                  <Badge variant="outline" className="max-w-full truncate hover:bg-muted">
                    {recipeTitleById.get(id) ?? "Recipe"}
                  </Badge>
                </Link>
              ))}
              {draft.recipeIds.length > 3 ? (
                <Badge variant="outline">+{draft.recipeIds.length - 3} more</Badge>
              ) : null}
            </div>
          ) : null}

          {links.length > 0 ? (
            <div className="space-y-1">
              {links.slice(0, 2).map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-primary underline-offset-2 hover:underline"
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
          ) : null}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => clearCell(key)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showHeader ? (
          <div>
            <h2 className="text-xl font-semibold">Meal Plan</h2>
            <p className="text-sm text-muted-foreground">
              Read-friendly plan cards with quick edit when you need it.
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setWeekStart((current) => subWeeks(current, 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <div className="inline-flex items-center rounded-md border bg-card px-3 py-2 text-sm">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setWeekStart((current) => addWeeks(current, 1))}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button asChild variant="outline">
            <Link href="/chat">
              <Sparkles className="mr-2 h-4 w-4" />
              Plan with AI
            </Link>
          </Button>
        </div>
      </div>

      <div className="md:hidden">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const value = format(day, "yyyy-MM-dd");
            const isActive = selectedDay === value;
            return (
              <Button
                key={value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDay(value)}
              >
                {format(day, "EEE d")}
              </Button>
            );
          })}
        </div>
        <div className="mb-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void saveDay(selectedDay)}
            disabled={isSaving || isLoading}
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            Save Day
          </Button>
        </div>
        <div className="space-y-3">
          {MEAL_SLOTS.map((mealSlot) => renderMealCard(selectedDay, mealSlot))}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[180px_repeat(3,minmax(0,1fr))] border-b bg-muted/30">
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground">Day</div>
              {MEAL_SLOTS.map((mealSlot) => (
                <div key={mealSlot} className="border-l px-3 py-2 text-sm font-medium text-muted-foreground">
                  {formatMealSlot(mealSlot)}
                </div>
              ))}
            </div>

            <div className="divide-y">
              {days.map((day) => {
                const planDate = format(day, "yyyy-MM-dd");
                return (
                  <div
                    key={planDate}
                    className="grid grid-cols-[180px_repeat(3,minmax(0,1fr))] gap-3 p-3"
                  >
                    <div className="space-y-3 rounded-md border bg-background px-3 py-3">
                      <p className="text-sm font-semibold">{format(day, "EEEE")}</p>
                      <p className="text-sm text-muted-foreground">{format(day, "MMM d")}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => void saveDay(planDate)}
                        disabled={isSaving || isLoading}
                      >
                        <Save className="mr-2 h-3.5 w-3.5" />
                        Save Day
                      </Button>
                    </div>
                    {MEAL_SLOTS.map((mealSlot) => renderMealCard(planDate, mealSlot))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-[calc(var(--mobile-nav-offset)+8px)] z-10 rounded-lg border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex justify-end gap-2">
          <Button asChild type="button" variant="outline" className="md:hidden">
            <Link href="/chat">
              <Sparkles className="mr-2 h-4 w-4" />
              Plan with AI
            </Link>
          </Button>
          <Button type="button" onClick={() => void saveWeek()} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Week
          </Button>
        </div>
      </div>

      <Sheet open={Boolean(editingCell)} onOpenChange={(open) => !open && setEditingCell(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              Edit {editingCell ? formatMealSlot(editingCell.mealSlot) : "Meal"}
            </SheetTitle>
            <SheetDescription>
              {editingCell ? format(new Date(editingCell.planDate), "EEEE, MMM d") : ""}
            </SheetDescription>
          </SheetHeader>

          {editingCell && editingDraft ? (
            <div className="mt-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  rows={4}
                  value={editingDraft.notes}
                  onChange={(event) =>
                    setCellDraft(editingKey!, (current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder={`What's for ${editingCell.mealSlot}?`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Saved Recipes</label>
                <div className="flex gap-2">
                  <select
                    value={selectedRecipeByCell[editingKey ?? ""] ?? ""}
                    onChange={(event) =>
                      setSelectedRecipeByCell((current) => ({
                        ...current,
                        [editingKey ?? ""]: event.target.value,
                      }))
                    }
                    className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">Select recipe</option>
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      addRecipeToCell(
                        editingKey!,
                        selectedRecipeByCell[editingKey ?? ""] || "",
                      )
                    }
                    disabled={!selectedRecipeByCell[editingKey ?? ""]}
                  >
                    Add
                  </Button>
                </div>

                {editingDraft.recipeIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {editingDraft.recipeIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removeRecipeFromCell(editingKey!, id)}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {recipeTitleById.get(id) ?? "Recipe"}
                        <span aria-hidden="true">x</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No saved recipes selected.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="inline-flex items-center gap-1 text-sm font-medium">
                  <LinkIcon className="h-3.5 w-3.5" />
                  External Links
                </label>
                <Textarea
                  rows={4}
                  value={editingDraft.linksText}
                  onChange={(event) =>
                    setCellDraft(editingKey!, (current) => ({
                      ...current,
                      linksText: event.target.value,
                    }))
                  }
                  placeholder={"https://example.com/recipe\nTitle | https://..."}
                />
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => clearCell(editingKey!)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear entry
                </Button>
                <Button
                  type="button"
                  disabled={isSaving || isLoading}
                  onClick={async () => {
                    const saved = await saveDay(editingCell!.planDate);
                    if (saved) {
                      setEditingCell(null);
                    }
                  }}
                >
                  Save & Done
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
