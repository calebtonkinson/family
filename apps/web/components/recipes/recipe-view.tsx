"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Recipe } from "@/lib/api-client";
import { Clock, Users, ChefHat, Download, Paperclip } from "lucide-react";

interface RecipeViewProps {
  recipe: Recipe;
}

export function RecipeView({ recipe }: RecipeViewProps) {
  const metaItems = [
    {
      icon: Clock,
      label: "Prep",
      value: recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} min` : null,
    },
    {
      icon: ChefHat,
      label: "Cook",
      value: recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} min` : null,
    },
    {
      icon: Users,
      label: "Servings",
      value: recipe.yieldServings?.toString() ?? null,
    },
  ].filter((item) => item.value !== null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">{recipe.title}</h1>
          {recipe.source && (
            <Badge variant="accent" className="capitalize shrink-0">
              {recipe.source}
            </Badge>
          )}
        </div>

        {recipe.description && (
          <p className="text-lg text-muted-foreground">{recipe.description}</p>
        )}

        {/* Meta information */}
        {metaItems.length > 0 && (
          <div className="flex flex-wrap gap-6">
            {metaItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">{item.label}:</span>{" "}
                  <span className="text-muted-foreground">{item.value}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Ingredients */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Ingredients</h2>
        {recipe.ingredientsJson.length > 0 ? (
          <ul className="space-y-3">
            {recipe.ingredientsJson.map((ingredient, index) => (
              <li key={index} className="flex gap-3 text-base">
                <span className="text-muted-foreground">•</span>
                <span>
                  {ingredient.quantity && (
                    <span className="font-medium">{ingredient.quantity} </span>
                  )}
                  {ingredient.unit && <span>{ingredient.unit} </span>}
                  <span>{ingredient.name}</span>
                  {ingredient.qualifiers && (
                    <span className="text-muted-foreground">, {ingredient.qualifiers}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No ingredients listed</p>
        )}
      </div>

      <Separator />

      {/* Instructions */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Instructions</h2>
        {recipe.instructionsJson.length > 0 ? (
          <ol className="space-y-5">
            {recipe.instructionsJson.map((instruction, index) => (
              <li key={index} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="pt-1.5 text-base leading-relaxed">{instruction}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No instructions provided</p>
        )}
      </div>

      {/* Notes */}
      {recipe.attachmentsJson.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Attachments</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {recipe.attachmentsJson.map((attachment, index) => (
                <div
                  key={`${attachment.url}-${index}`}
                  className="rounded-md border p-3"
                >
                  {attachment.mediaType.startsWith("image/") ? (
                    <img
                      src={attachment.url}
                      alt={attachment.filename || `Attachment ${index + 1}`}
                      className="mb-3 max-h-56 w-full rounded-md border object-contain"
                    />
                  ) : (
                    <div className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      File attachment
                    </div>
                  )}
                  <a
                    href={attachment.url}
                    download={attachment.filename}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent/50"
                  >
                    <span className="truncate">
                      {attachment.filename || `Attachment ${index + 1}`}
                    </span>
                    <Download className="h-4 w-4 shrink-0" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {recipe.notes && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Notes</h2>
            <p className="text-base leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {recipe.notes}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
