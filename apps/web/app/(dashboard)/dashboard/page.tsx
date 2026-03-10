"use client";

import { useMemo } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { usePinnedLists } from "@/hooks/use-lists";
import { useMealPlans } from "@/hooks/use-meal-plans";
import { TaskList } from "@/components/tasks/task-list";
import { PinnedListCard } from "@/components/lists";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, List, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { MealPlan, MealSlot, Task } from "@/lib/api-client";

const MEAL_SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snacks"];

const formatMealSlot = (slot: MealSlot) => slot.charAt(0).toUpperCase() + slot.slice(1);

const toTimestamp = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const mealPlanSummary = (plan: MealPlan) => {
  const recipeTitles = plan.recipes.map((recipe) => recipe.title).filter(Boolean);
  if (recipeTitles.length > 0) return recipeTitles.join(", ");
  if (plan.notes?.trim()) return plan.notes.trim();
  if (plan.externalLinksJson.length > 0) {
    return plan.externalLinksJson[0]?.title?.trim() || plan.externalLinksJson[0]?.url;
  }
  return "Meal planned";
};

const isVisibleTask = (task: Task) => task.status !== "archived";

export default function DashboardPage() {
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const { data: tasksData, isLoading: tasksLoading } = useTasks({
    limit: 100,
  });
  const { data: pinnedData, isLoading: pinnedLoading } = usePinnedLists();
  const { data: mealsData, isLoading: mealsLoading } = useMealPlans({
    startDate: todayKey,
    endDate: todayKey,
  });

  const pinnedLists = pinnedData?.data ?? [];

  const recentTasks = useMemo(
    () =>
      [...(tasksData?.data ?? [])]
        .filter(isVisibleTask)
        .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
        .slice(0, 5),
    [tasksData?.data],
  );

  const mealsBySlot = useMemo(() => {
    const grouped = new Map<MealSlot, MealPlan[]>();
    for (const slot of MEAL_SLOT_ORDER) {
      grouped.set(slot, []);
    }
    for (const plan of mealsData?.data ?? []) {
      const slotMeals = grouped.get(plan.mealSlot);
      if (!slotMeals) continue;
      slotMeals.push(plan);
    }
    return MEAL_SLOT_ORDER.map((slot) => ({
      slot,
      meals: grouped.get(slot) ?? [],
    }));
  }, [mealsData?.data]);

  if (tasksLoading || pinnedLoading || mealsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <section className="feature-panel overflow-hidden rounded-[1.75rem] p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Household Hub
            </p>
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl">Today at home</h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                A quick view of what needs attention, what is planned, and what is still open.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--card)/0.72))] px-4 py-3 text-sm shadow-[inset_0_1px_0_hsl(var(--background)/0.9)]">
            <p className="font-semibold">{format(new Date(), "EEEE")}</p>
            <p className="text-muted-foreground">{format(new Date(), "MMMM d, yyyy")}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <List className="h-4 w-4 text-primary" />
            <h2 className="dashboard-section-title">Lists</h2>
          </div>
          <Button variant="ghost" size="xs" asChild>
            <Link href="/lists">
              View all <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {pinnedLists.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedLists.map((list) => (
              <PinnedListCard key={list.id} list={list} compact />
            ))}
          </div>
        ) : (
          <Card className="empty-state-panel">
            <CardContent className="py-8 text-center text-muted-foreground">
              Pin a list to keep it on your home page.
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4 text-primary" />
            <h2 className="dashboard-section-title">Today&apos;s Meals</h2>
          </div>
          <Button variant="ghost" size="xs" asChild>
            <Link href="/meals?tab=plan">
              Open plan <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <Card className="feature-panel overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y">
              {mealsBySlot.map(({ slot, meals }) => (
                <div
                  key={slot}
                  className="flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-[hsl(var(--foreground)/0.02)]"
                >
                  <p className="text-sm font-semibold">{formatMealSlot(slot)}</p>
                  <div className="max-w-[70%] space-y-1 text-right text-sm text-muted-foreground">
                    {meals.length > 0 ? (
                      meals.map((meal) => (
                        <p key={meal.id} className="truncate text-foreground/78">
                          {mealPlanSummary(meal)}
                        </p>
                      ))
                    ) : (
                      <p>No meal planned</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="dashboard-section-title">Recently Touched Tasks</h2>
          <Button variant="ghost" size="xs" asChild>
            <Link href="/tasks">
              View all <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <TaskList tasks={recentTasks} emptyMessage="No recently touched tasks yet." />
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-[1.75rem]" />
      {[1, 2, 3].map((section) => (
        <section key={section}>
          <Skeleton className="mb-3 h-5 w-32 rounded-full" />
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <Skeleton key={`${section}-${item}`} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
