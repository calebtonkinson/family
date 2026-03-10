"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, format, startOfWeek } from "date-fns";
import { BookOpen, CalendarRange, ChefHat, Save, Sparkles } from "lucide-react";
import { MealPlanWorkspace } from "@/components/meals/meal-plan-workspace";
import { RecipesWorkspace } from "@/components/recipes/recipes-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMealPlans } from "@/hooks/use-meal-plans";
import {
  useMealPlanningPreferences,
  useUpdateMealPlanningPreferences,
} from "@/hooks/use-meal-planning-preferences";
import { useRecipes } from "@/hooks/use-recipes";
import { toast } from "@/hooks/use-toast";

type MealsTab = "plan" | "recipes";

const normalizeTab = (value: string | null): MealsTab =>
  value === "recipes" ? "recipes" : "plan";

export default function MealsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));
  const listBaseParams = useMemo(() => ({ tab: "recipes" }), []);

  const weekStart = useMemo(
    () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    [],
  );
  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: recipesData } = useRecipes({ limit: 100 });
  const { data: mealPlansData } = useMealPlans({ startDate, endDate });
  const { data: preferencesData } = useMealPlanningPreferences();
  const updatePreferences = useUpdateMealPlanningPreferences();

  const [mealPhilosophy, setMealPhilosophy] = useState("");

  useEffect(() => {
    setMealPhilosophy(preferencesData?.data?.notes ?? "");
  }, [preferencesData?.data?.notes]);

  const recipes = recipesData?.data ?? [];
  const mealPlans = mealPlansData?.data ?? [];
  const plannedCount = mealPlans.filter(
    (plan) =>
      Boolean(plan.notes?.trim()) ||
      (plan.recipeIdsJson?.length ?? 0) > 0 ||
      (plan.externalLinksJson?.length ?? 0) > 0,
  ).length;
  const dinnerCount = mealPlans.filter(
    (plan) =>
      plan.mealSlot === "dinner" &&
      (Boolean(plan.notes?.trim()) ||
        (plan.recipeIdsJson?.length ?? 0) > 0 ||
        (plan.externalLinksJson?.length ?? 0) > 0),
  ).length;
  const quickRecipeCount = recipes.filter((recipe) => {
    const totalMinutes = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
    return totalMinutes > 0 && totalMinutes <= 40;
  }).length;

  const handleTabChange = (value: string) => {
    const nextTab = normalizeTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleSaveMealPhilosophy = async () => {
    try {
      await updatePreferences.mutateAsync({
        notes: mealPhilosophy.trim() || null,
      });
      toast({ title: "Planning philosophy saved" });
    } catch (error) {
      console.error("Failed to save meal planning philosophy", error);
      toast({ title: "Failed to save planning philosophy", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.4rem] border border-border/60 bg-background/35 px-5 py-5 shadow-[inset_0_1px_0_hsl(var(--background)/0.88)] md:px-6 md:py-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Meals and cookbook
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl">Make weekly planning feel calm and deliberate.</h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Keep the plan, the cookbook, and the household’s planning philosophy together so meal planning feels like one flow instead of scattered screens.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/chat">
                <Sparkles className="mr-2 h-4 w-4" />
                Plan with AI
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/recipes">
                <BookOpen className="mr-2 h-4 w-4" />
                Open cookbook
              </Link>
            </Button>
            <Button asChild>
              <Link href={activeTab === "recipes" ? "#cookbook" : "#planner"}>
                <ChefHat className="mr-2 h-4 w-4" />
                {activeTab === "recipes" ? "Jump to recipes" : "Jump to planner"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Planned this week
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{plannedCount}</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Dinner anchors
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{dinnerCount}</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Cookbook size
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{recipes.length}</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Quick options
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{quickRecipeCount}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-[1.25rem] border border-border/75 bg-background/55 p-1.5">
              <TabsTrigger value="plan" className="rounded-[1rem] py-2.5">
                Planner
              </TabsTrigger>
              <TabsTrigger value="recipes" className="rounded-[1rem] py-2.5">
                Cookbook
              </TabsTrigger>
            </TabsList>

            <TabsContent value="plan" id="planner" className="space-y-4">
              <MealPlanWorkspace showHeader={false} />
            </TabsContent>

            <TabsContent value="recipes" id="cookbook" className="space-y-4">
              <RecipesWorkspace
                showHeader={false}
                showMealPlanShortcut={false}
                listBasePath="/meals"
                listBaseParams={listBaseParams}
              />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[1.5rem] border border-border/65 bg-background/35 p-4 shadow-[inset_0_1px_0_hsl(var(--background)/0.88)]">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-primary" />
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Planning philosophy
                </p>
              </div>
              <h2 className="text-xl">Keep the assistant on your wavelength</h2>
              <p className="text-sm text-muted-foreground">
                Save the recurring rules once so planning suggestions stay consistent with your household.
              </p>
            </div>

            <Textarea
              value={mealPhilosophy}
              onChange={(event) => setMealPhilosophy(event.target.value)}
              placeholder="Example: Weeknights should be kid-friendly and under 30 minutes. Fridays lean on leftovers or takeout. Sundays can take longer."
              rows={9}
              className="mt-4 bg-background/80"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void handleSaveMealPhilosophy()}
                disabled={updatePreferences.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save philosophy
              </Button>
              <Badge variant="secondary">
                {mealPhilosophy.trim() ? "Used by AI planning" : "Add guidance for better plans"}
              </Badge>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-border/65 bg-background/35 p-4 shadow-[inset_0_1px_0_hsl(var(--background)/0.88)]">
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                What good looks like
              </p>
              <h2 className="text-xl">A strong weekly plan has:</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>1. Dinner anchors for the busiest nights.</p>
              <p>2. A few repeatable breakfast and lunch defaults.</p>
              <p>3. Links or notes only where the saved cookbook is not enough.</p>
              <p>4. Enough flexibility to absorb leftovers without breaking the week.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
