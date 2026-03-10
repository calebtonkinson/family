"use client";

import { Badge } from "@/components/ui/badge";
import {
  Clock3,
  Download,
  ExternalLink,
  Link2,
  Paperclip,
  Soup,
  Users,
} from "lucide-react";
import type { Recipe } from "@/lib/api-client";
import {
  getAttachmentLabel,
  getRecipeImageAttachments,
  getRecipeReferenceAttachments,
  isWebLinkAttachment,
} from "@/lib/recipe-attachments";

interface RecipeViewProps {
  recipe: Recipe;
}

const sourceLabels: Record<Recipe["source"], string> = {
  manual: "Manual",
  family: "Family",
  photo: "From photo",
  link: "From link",
};

export function RecipeView({ recipe }: RecipeViewProps) {
  const prepAndCook =
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  const imageAttachments = getRecipeImageAttachments(recipe);
  const referenceAttachments = getRecipeReferenceAttachments(recipe);

  return (
    <div className="space-y-6">
      <section className="feature-panel overflow-hidden rounded-[1.9rem] p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {sourceLabels[recipe.source]}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl">{recipe.title}</h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                {recipe.description ||
                  "A household recipe ready to plug into the meal plan."}
              </p>
            </div>
          </div>

          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Total time
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                {prepAndCook > 0 ? `${prepAndCook} min` : "Open"}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Serves
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                {recipe.yieldServings ?? "Open"}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-border/75 bg-background/60 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Soup className="h-3.5 w-3.5" />
                Structure
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                {recipe.ingredientsJson.length}/{recipe.instructionsJson.length}
              </p>
            </div>
          </div>
        </div>

        {recipe.tags.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <Badge
                key={tag}
                variant="default"
                className="rounded-full px-3 py-1"
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {imageAttachments.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {imageAttachments.slice(0, 3).map((attachment, index) => (
              <div
                key={`${attachment.url}-${index}`}
                className="overflow-hidden rounded-[1.35rem] border border-border/75 bg-background/55"
              >
                <img
                  src={attachment.url}
                  alt={getAttachmentLabel(
                    attachment,
                    `Recipe image ${index + 1}`,
                  )}
                  className="h-52 w-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
        <section className="feature-panel rounded-[1.8rem] p-5 md:p-6">
          <div className="space-y-2">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Ingredients
            </p>
            <h2 className="text-2xl">Everything to gather first</h2>
          </div>

          {recipe.ingredientsJson.length > 0 ? (
            <ul className="mt-5 space-y-3">
              {recipe.ingredientsJson.map((ingredient, index) => (
                <li
                  key={`${ingredient.name}-${index}`}
                  className="rounded-[1.25rem] border border-border/75 bg-background/55 px-4 py-3"
                >
                  <p className="text-base text-foreground/90">
                    {ingredient.quantity ? (
                      <span className="font-semibold">
                        {ingredient.quantity}{" "}
                      </span>
                    ) : null}
                    {ingredient.unit ? <span>{ingredient.unit} </span> : null}
                    <span className="font-medium">{ingredient.name}</span>
                    {ingredient.qualifiers ? (
                      <span className="text-muted-foreground">
                        , {ingredient.qualifiers}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state-panel mt-5 rounded-[1.5rem] px-5 py-10 text-sm text-muted-foreground">
              No ingredients listed yet.
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="feature-panel rounded-[1.7rem] p-4">
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Snapshot
              </p>
              <h3 className="text-xl">Recipe at a glance</h3>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-[1.2rem] border border-border/75 bg-background/55 p-3">
                <p className="text-muted-foreground">Prep time</p>
                <p className="mt-1 font-semibold">
                  {recipe.prepTimeMinutes
                    ? `${recipe.prepTimeMinutes} min`
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/75 bg-background/55 p-3">
                <p className="text-muted-foreground">Cook time</p>
                <p className="mt-1 font-semibold">
                  {recipe.cookTimeMinutes
                    ? `${recipe.cookTimeMinutes} min`
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/75 bg-background/55 p-3">
                <p className="text-muted-foreground">Visuals</p>
                <p className="mt-1 font-semibold">
                  {imageAttachments.length > 0
                    ? `${imageAttachments.length} photo${imageAttachments.length > 1 ? "s" : ""}`
                    : "None"}
                </p>
              </div>
            </div>
          </section>

          {recipe.notes ? (
            <section className="feature-panel rounded-[1.7rem] p-4">
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Notes
                </p>
                <h3 className="text-xl">What to remember</h3>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {recipe.notes}
              </p>
            </section>
          ) : null}
        </aside>
      </div>

      <section className="feature-panel rounded-[1.8rem] p-5 md:p-6">
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Instructions
          </p>
          <h2 className="text-2xl">Keep the cooking flow simple</h2>
        </div>

        {recipe.instructionsJson.length > 0 ? (
          <ol className="mt-5 space-y-4">
            {recipe.instructionsJson.map((instruction, index) => (
              <li
                key={`${instruction}-${index}`}
                className="flex gap-4 rounded-[1.35rem] border border-border/75 bg-background/55 p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_-16px_hsl(var(--primary)/0.9)]">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-6 text-foreground/90 md:text-base">
                  {instruction}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state-panel mt-5 rounded-[1.5rem] px-5 py-10 text-sm text-muted-foreground">
            No instructions provided yet.
          </div>
        )}
      </section>

      {imageAttachments.length > 0 || referenceAttachments.length > 0 ? (
        <section className="feature-panel rounded-[1.8rem] p-5 md:p-6">
          <div className="space-y-2">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Attachments
            </p>
            <h2 className="text-2xl">
              Reference the source whenever you need it
            </h2>
          </div>

          {imageAttachments.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-semibold text-foreground">
                Visual references
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {imageAttachments.map((attachment, index) => (
                  <div
                    key={`${attachment.url}-${index}`}
                    className="rounded-[1.35rem] border border-border/75 bg-background/55 p-4"
                  >
                    <img
                      src={attachment.url}
                      alt={getAttachmentLabel(
                        attachment,
                        `Attachment ${index + 1}`,
                      )}
                      className="mb-4 h-52 w-full rounded-[1rem] border border-border/75 object-cover"
                    />

                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/75 bg-background/75 px-3 py-2 text-sm transition hover:border-primary/35 hover:bg-background"
                    >
                      <span className="truncate">
                        {getAttachmentLabel(
                          attachment,
                          `Attachment ${index + 1}`,
                        )}
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {referenceAttachments.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-semibold text-foreground">
                Links and files
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {referenceAttachments.map((attachment, index) => (
                  <div
                    key={`${attachment.url}-${index}`}
                    className="rounded-[1.35rem] border border-border/75 bg-background/55 p-4"
                  >
                    <div className="mb-4 flex h-24 items-center justify-center rounded-[1rem] border border-dashed border-border bg-background/45">
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        {isWebLinkAttachment(attachment) ? (
                          <Link2 className="h-4 w-4" />
                        ) : (
                          <Paperclip className="h-4 w-4" />
                        )}
                        {isWebLinkAttachment(attachment)
                          ? "Source link"
                          : "File attachment"}
                      </span>
                    </div>

                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/75 bg-background/75 px-3 py-2 text-sm transition hover:border-primary/35 hover:bg-background"
                    >
                      <span className="truncate">
                        {getAttachmentLabel(
                          attachment,
                          `Attachment ${index + 1}`,
                        )}
                      </span>
                      {isWebLinkAttachment(attachment) ? (
                        <ExternalLink className="h-4 w-4 shrink-0" />
                      ) : (
                        <Download className="h-4 w-4 shrink-0" />
                      )}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
