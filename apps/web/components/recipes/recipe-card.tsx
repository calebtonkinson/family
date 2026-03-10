"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  Link2,
  Paperclip,
  Soup,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Recipe } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  getRecipePrimaryImage,
  getRecipeReferenceAttachments,
  getRecipeImageAttachments,
} from "@/lib/recipe-attachments";

interface RecipeCardProps {
  recipe: Recipe;
  listHref?: string;
}

const sourceLabels: Record<Recipe["source"], string> = {
  manual: "Manual",
  family: "Family",
  photo: "From photo",
  link: "From link",
};

export function RecipeCard({ recipe, listHref }: RecipeCardProps) {
  const href = `/recipes/${recipe.id}${listHref ? `?from=${encodeURIComponent(listHref)}` : ""}`;
  const totalMinutes =
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  const previewIngredients = recipe.ingredientsJson
    .slice(0, 3)
    .map((ingredient) => ingredient.name)
    .filter(Boolean);
  const primaryImage = getRecipePrimaryImage(recipe);
  const imageCount = getRecipeImageAttachments(recipe).length;
  const referenceCount = getRecipeReferenceAttachments(recipe).length;

  return (
    <Link
      href={href}
      className={cn(
        "group feature-panel block h-full rounded-[1.45rem] p-4 transition duration-300 md:rounded-[1.7rem] md:p-5",
        "hover:-translate-y-1 hover:border-primary/30",
      )}
    >
      <div className="flex h-full flex-col">
        {primaryImage ? (
          <div className="mb-4 overflow-hidden rounded-[1.2rem] border border-border/75 bg-background/60 md:mb-5 md:rounded-[1.45rem]">
            <img
              src={primaryImage.url}
              alt={primaryImage.filename || `${recipe.title} reference`}
              className="h-40 w-full object-cover transition duration-500 group-hover:scale-[1.03] md:h-48"
            />
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {sourceLabels[recipe.source]}
          </Badge>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/75 bg-background/65 text-primary transition group-hover:bg-primary/12 md:h-10 md:w-10">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-4 space-y-1.5 md:mt-5 md:space-y-2">
          <h3 className="text-lg font-semibold tracking-[-0.03em] md:text-xl">
            {recipe.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground md:leading-6">
            {recipe.description ||
              "A household staple ready to drop into the meal plan."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:mt-5">
          <div className="rounded-[1rem] border border-border/70 bg-background/55 p-2.5 md:rounded-[1.15rem] md:p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              <span>Total time</span>
            </div>
            <p className="mt-1.5 font-semibold text-foreground md:mt-2">
              {totalMinutes > 0 ? `${totalMinutes} min` : "Flexible"}
            </p>
          </div>
          <div className="rounded-[1rem] border border-border/70 bg-background/55 p-2.5 md:rounded-[1.15rem] md:p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>Serves</span>
            </div>
            <p className="mt-1.5 font-semibold text-foreground md:mt-2">
              {recipe.yieldServings ?? "Open"}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 md:mt-5 md:space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {recipe.ingredientsJson.length} ingredients
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {recipe.instructionsJson.length} steps
            </Badge>
            {imageCount > 0 ? (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                <Paperclip className="mr-1 h-3.5 w-3.5" />
                {imageCount} photo{imageCount > 1 ? "s" : ""}
              </Badge>
            ) : null}
            {referenceCount > 0 ? (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                <Link2 className="mr-1 h-3.5 w-3.5" />
                {referenceCount} link{referenceCount > 1 ? "s" : ""}
              </Badge>
            ) : null}
          </div>

          {previewIngredients.length > 0 ? (
            <div className="hidden rounded-[1.2rem] border border-border/70 bg-background/45 p-3 md:block">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Soup className="h-3.5 w-3.5" />
                Ingredient preview
              </p>
              <p className="mt-2 text-sm text-foreground/90">
                {previewIngredients.join(", ")}
                {recipe.ingredientsJson.length > previewIngredients.length
                  ? ", ..."
                  : ""}
              </p>
            </div>
          ) : null}

          {recipe.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {recipe.tags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag}
                  variant="default"
                  className="rounded-full px-3 py-1"
                >
                  {tag}
                </Badge>
              ))}
              {recipe.tags.length > 4 ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  +{recipe.tags.length - 4}
                </Badge>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tags yet.</p>
          )}
        </div>
      </div>
    </Link>
  );
}
