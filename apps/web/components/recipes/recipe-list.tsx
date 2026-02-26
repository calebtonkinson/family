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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="mb-2 text-muted-foreground">{emptyMessage}</p>
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
    <div className="flex flex-col gap-4">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} listHref={listHref} />
      ))}
    </div>
  );
}
