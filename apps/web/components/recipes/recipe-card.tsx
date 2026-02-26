"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/lib/api-client";
import { Clock, ChefHat, Users, Paperclip } from "lucide-react";

interface RecipeCardProps {
  recipe: Recipe;
  listHref?: string;
}

export function RecipeCard({ recipe, listHref }: RecipeCardProps) {
  const metaItems = [
    {
      icon: Clock,
      value: recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes}m` : null,
      label: "Prep",
    },
    {
      icon: ChefHat,
      value: recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes}m` : null,
      label: "Cook",
    },
    {
      icon: Users,
      value: recipe.yieldServings ? `${recipe.yieldServings}` : null,
      label: "Serves",
    },
  ].filter((item) => item.value !== null);

  const href = `/recipes/${recipe.id}${listHref ? `?from=${encodeURIComponent(listHref)}` : ""}`;

  return (
    <Link
      href={href}
      className={cn(
        "block space-y-3 px-5 py-4 rounded-xl transition-all",
        "hover:bg-accent/50 border border-border/50 hover:border-border",
        "hover:shadow-md hover:scale-[1.01]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold mb-1">{recipe.title}</h3>
          {recipe.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {recipe.description}
            </p>
          )}
        </div>
        {recipe.source && (
          <Badge variant="accent" className="capitalize shrink-0 text-xs">
            {recipe.source}
          </Badge>
        )}
      </div>

      {metaItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          {metaItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <item.icon className="h-3.5 w-3.5" />
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {recipe.attachmentsJson.length > 0 && (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          <span>{recipe.attachmentsJson.length} attachment(s)</span>
        </div>
      )}

      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recipe.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </Link>
  );
}
