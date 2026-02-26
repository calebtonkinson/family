"use client";

import { useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { RecipeView } from "@/components/recipes/recipe-view";
import { Button } from "@/components/ui/button";
import { useRecipe, useUpdateRecipe, useDeleteRecipe } from "@/hooks/use-recipes";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Pencil, X } from "lucide-react";

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

  const handleUpdate = async (payload: Parameters<typeof updateRecipe.mutateAsync>[0]["data"]) => {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={from || "/recipes"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Recipes
          </Link>
        </Button>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Loading recipe...
        </div>
      )}

      {!isLoading && recipe && (
        <>
          {isEditing ? (
            <RecipeForm
              initialRecipe={recipe}
              submitLabel="Save changes"
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <RecipeView recipe={recipe} />
          )}
        </>
      )}

      {!isLoading && !recipe && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Recipe not found.
        </div>
      )}
    </div>
  );
}
