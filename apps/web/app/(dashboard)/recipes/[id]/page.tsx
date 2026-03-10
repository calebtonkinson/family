"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { RecipeView } from "@/components/recipes/recipe-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteRecipe, useRecipe, useUpdateRecipe } from "@/hooks/use-recipes";
import { toast } from "@/hooks/use-toast";

export default function RecipeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id);
  const from = searchParams.get("from");

  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading } = useRecipe(id);
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const recipe = data?.data;

  const handleUpdate = async (
    payload: Parameters<typeof updateRecipe.mutateAsync>[0]["data"],
  ) => {
    try {
      await updateRecipe.mutateAsync({ id, data: payload });
      toast({ title: "Recipe updated" });
      setIsEditing(false);
    } catch {
      toast({ title: "Failed to update recipe", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this recipe?")) return;
    try {
      await deleteRecipe.mutateAsync(id);
      toast({ title: "Recipe deleted" });
      router.push(from || "/recipes");
    } catch {
      toast({ title: "Failed to delete recipe", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <section className="feature-panel rounded-[1.85rem] p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
              <Link href={from || "/recipes"}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to cookbook
              </Link>
            </Button>
            {recipe ? (
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                Updated {format(new Date(recipe.updatedAt), "MMM d, yyyy")}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit recipe
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="feature-panel rounded-[1.75rem] p-8 text-sm text-muted-foreground">
          Loading recipe...
        </div>
      ) : null}

      {!isLoading && recipe ? (
        isEditing ? (
          <RecipeForm
            initialRecipe={recipe}
            submitLabel="Save changes"
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <RecipeView recipe={recipe} />
        )
      ) : null}

      {!isLoading && !recipe ? (
        <div className="empty-state-panel rounded-[1.75rem] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-foreground">Recipe not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been deleted or the link is out of date.
          </p>
        </div>
      ) : null}
    </div>
  );
}
