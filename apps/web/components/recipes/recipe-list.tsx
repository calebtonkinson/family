"use client";

import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "./recipe-card";
import type { Recipe } from "@/lib/api-client";

interface RecipeListProps {
  recipes: Recipe[];
  emptyMessage?: string;
  listHref?: string;
}

export function RecipeList({
  recipes,
  emptyMessage = "No recipes yet",
  listHref,
}: RecipeListProps) {
  if (recipes.length === 0) {
    return (
      <div className="empty-state-panel flex flex-col items-center justify-center rounded-[1.75rem] px-6 py-16 text-center">
        <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-border/80 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),hsl(var(--card)/0.78))] shadow-[inset_0_1px_0_hsl(var(--background)/0.9)]">
          <BookOpen className="h-10 w-10 text-foreground" />
        </span>
        <p className="mb-2 text-lg font-semibold text-foreground">
          {emptyMessage}
        </p>
        <p className="mb-5 max-w-md text-sm text-muted-foreground">
          Start with one dependable family meal, then grow the cookbook into a
          reusable planning library.
        </p>
        <Button asChild>
          <Link href="/recipes">
            <Plus className="mr-2 h-4 w-4" />
            Create your first recipe
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Cookbook
          </p>
          <h2 className="mt-1 text-xl md:text-2xl">
            Recipes ready for planning
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {recipes.length} recipe{recipes.length > 1 ? "s" : ""} in rotation
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} listHref={listHref} />
        ))}
      </div>
    </div>
  );
}
