"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MealPlanWorkspace } from "@/components/meals/meal-plan-workspace";
import { RecipesWorkspace } from "@/components/recipes/recipes-workspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MealsTab = "plan" | "recipes";

const normalizeTab = (value: string | null): MealsTab =>
  value === "recipes" ? "recipes" : "plan";

export default function MealsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  const listBaseParams = useMemo(() => ({ tab: "recipes" }), []);

  const handleTabChange = (value: string) => {
    const nextTab = normalizeTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Meals</h1>
        <p className="text-sm text-muted-foreground">
          Plan meals and manage recipes in one place.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-4">
          <MealPlanWorkspace showHeader={false} />
        </TabsContent>

        <TabsContent value="recipes" className="space-y-4">
          <RecipesWorkspace
            showHeader={false}
            showMealPlanShortcut={false}
            listBasePath="/meals"
            listBaseParams={listBaseParams}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
