"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  type CreateRecipeInput,
  type ImportRecipeFileInput,
  type UpdateRecipeInput,
} from "@/lib/api-client";
import { useRecipes, useCreateRecipe } from "@/hooks/use-recipes";
import { RecipeList } from "@/components/recipes/recipe-list";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Loader2, Plus, Search, Upload, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RecipesWorkspaceProps {
  showHeader?: boolean;
  showMealPlanShortcut?: boolean;
  listBasePath?: string;
  listBaseParams?: Record<string, string>;
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

export function RecipesWorkspace({
  showHeader = true,
  showMealPlanShortcut = true,
  listBasePath = "/recipes",
  listBaseParams,
}: RecipesWorkspaceProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPrompt, setImportPrompt] = useState("");
  const [importFiles, setImportFiles] = useState<FileList | null>(null);
  const [isCreatingFromFile, setIsCreatingFromFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useRecipes({
    search: search.trim() || undefined,
    tag: tagFilter.trim() || undefined,
  });
  const createRecipe = useCreateRecipe();

  const recipes = data?.data || [];

  const listHref = useMemo(() => {
    const params = new URLSearchParams(listBaseParams ?? {});
    if (search.trim()) params.set("search", search.trim());
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    const q = params.toString();
    return q ? `${listBasePath}?${q}` : listBasePath;
  }, [listBasePath, listBaseParams, search, tagFilter]);

  const handleCreate = async (payload: CreateRecipeInput | UpdateRecipeInput) => {
    if (!payload.title?.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    try {
      await createRecipe.mutateAsync(payload as CreateRecipeInput);
      toast({ title: "Recipe created" });
      setShowManualCreate(false);
    } catch {
      toast({ title: "Failed to create recipe", variant: "destructive" });
    }
  };

  const resetImportForm = () => {
    setImportPrompt("");
    setImportFiles(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    setImportFiles(event.target.files);
  };

  const serializeFiles = async (files: FileList | File[]) => {
    const serialized: ImportRecipeFileInput[] = await Promise.all(
      Array.from(files).map(async (file) => ({
        url: await readFileAsDataUrl(file),
        mediaType: file.type || "application/octet-stream",
        filename: file.name,
      })),
    );

    return serialized;
  };

  const handleCreateFromFiles = async () => {
    if (!importFiles || importFiles.length === 0) {
      toast({ title: "Add at least one file", variant: "destructive" });
      return;
    }

    try {
      setIsCreatingFromFile(true);
      const result = await apiClient.importRecipeFromFiles({
        files: await serializeFiles(importFiles),
        prompt: importPrompt.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: `Recipe created: ${result.data.recipe.title}` });
      setShowImportModal(false);
      resetImportForm();
    } catch (error) {
      console.error("Failed to import recipe:", error);
      toast({ title: "Failed to create recipe from files", variant: "destructive" });
    } finally {
      setIsCreatingFromFile(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showHeader ? <h1 className="text-2xl font-bold">Recipes</h1> : <div />}
        <div className="flex flex-wrap gap-2">
          {showMealPlanShortcut ? (
            <Button asChild variant="outline">
              <Link href="/meals?tab=plan">Open meal plan</Link>
            </Button>
          ) : null}
          <Button onClick={() => setShowImportModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New recipe
          </Button>
          <Button variant="outline" onClick={() => setShowManualCreate((prev) => !prev)}>
            {showManualCreate ? (
              <X className="mr-2 h-4 w-4" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {showManualCreate ? "Close manual" : "Create manually"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="pl-9"
          />
        </div>
        <Input
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder="Filter by tag"
        />
      </div>

      {showManualCreate && (
        <RecipeForm
          title="Create Recipe"
          submitLabel="Create recipe"
          onSubmit={handleCreate}
          onCancel={() => setShowManualCreate(false)}
        />
      )}

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Loading recipes...
        </div>
      ) : (
        <RecipeList recipes={recipes} listHref={listHref} />
      )}

      <AlertDialog
        open={showImportModal}
        onOpenChange={(open) => {
          if (isCreatingFromFile) return;
          setShowImportModal(open);
          if (!open) resetImportForm();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Recipe From Files</AlertDialogTitle>
            <AlertDialogDescription>
              Add one or more files, then click Create to run recipe extraction in the background.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,text/plain"
              multiple
              className="hidden"
              onChange={handleImportFilesChange}
              disabled={isCreatingFromFile}
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCreatingFromFile}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {importFiles?.length ? "Change files" : "Add files"}
            </Button>

            {importFiles && importFiles.length > 0 ? (
              <div className="max-h-32 space-y-1 overflow-auto rounded-md border p-2 text-sm text-muted-foreground">
                {Array.from(importFiles).map((file) => (
                  <div key={`${file.name}-${file.size}`} className="truncate">
                    {file.name}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No files selected
              </div>
            )}

            <Textarea
              value={importPrompt}
              onChange={(event) => setImportPrompt(event.target.value)}
              placeholder="Optional instructions (for example: make this gluten-free)."
              disabled={isCreatingFromFile}
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCreatingFromFile}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void handleCreateFromFiles()}
              disabled={isCreatingFromFile || !importFiles?.length}
            >
              {isCreatingFromFile ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
