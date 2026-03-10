"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  type CreateRecipeInput,
  type ImportRecipeFileInput,
  type ImportRecipeFromUrlInput,
  type UpdateRecipeInput,
} from "@/lib/api-client";
import { useRecipes, useCreateRecipe } from "@/hooks/use-recipes";
import { RecipeList } from "@/components/recipes/recipe-list";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Camera,
  Link2,
  FileText,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getRecipeImageAttachments } from "@/lib/recipe-attachments";

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
  const [importMode, setImportMode] = useState<"files" | "url">("files");
  const [importPrompt, setImportPrompt] = useState("");
  const [importFiles, setImportFiles] = useState<FileList | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [isCreatingFromFile, setIsCreatingFromFile] = useState(false);
  const [isCreatingFromUrl, setIsCreatingFromUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useRecipes({
    search: search.trim() || undefined,
    tag: tagFilter.trim() || undefined,
  });
  const createRecipe = useCreateRecipe();

  const recipes = useMemo(() => data?.data ?? [], [data?.data]);
  const totalRecipes = recipes.length;
  const quickRecipeCount = recipes.filter((recipe) => {
    const totalMinutes =
      (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
    return totalMinutes > 0 && totalMinutes <= 40;
  }).length;
  const recipesWithPhotos = recipes.filter(
    (recipe) => getRecipeImageAttachments(recipe).length > 0,
  ).length;
  const taggedRecipeCount = recipes.filter(
    (recipe) => recipe.tags.length > 0,
  ).length;

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const tag of recipe.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8);
  }, [recipes]);

  const listHref = useMemo(() => {
    const params = new URLSearchParams(listBaseParams ?? {});
    if (search.trim()) params.set("search", search.trim());
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    const query = params.toString();
    return query ? `${listBasePath}?${query}` : listBasePath;
  }, [listBasePath, listBaseParams, search, tagFilter]);

  const handleCreate = async (
    payload: CreateRecipeInput | UpdateRecipeInput,
  ) => {
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
    setImportMode("files");
    setImportPrompt("");
    setImportFiles(null);
    setImportUrl("");
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
      toast({
        title: "Failed to create recipe from files",
        variant: "destructive",
      });
    } finally {
      setIsCreatingFromFile(false);
    }
  };

  const handleCreateFromUrl = async () => {
    const payload: ImportRecipeFromUrlInput = {
      url: importUrl.trim(),
      prompt: importPrompt.trim() || undefined,
    };

    if (!payload.url) {
      toast({ title: "Add a recipe URL", variant: "destructive" });
      return;
    }

    try {
      new URL(payload.url);
    } catch {
      toast({ title: "Enter a valid URL", variant: "destructive" });
      return;
    }

    try {
      setIsCreatingFromUrl(true);
      const result = await apiClient.importRecipeFromUrl(payload);
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: `Recipe created: ${result.data.recipe.title}` });
      setShowImportModal(false);
      resetImportForm();
    } catch (error) {
      console.error("Failed to import recipe from URL:", error);
      toast({
        title: "Failed to create recipe from URL",
        variant: "destructive",
      });
    } finally {
      setIsCreatingFromUrl(false);
    }
  };

  return (
    <div className="space-y-6">
      {showHeader ? (
        <section className="feature-panel overflow-hidden rounded-[1.55rem] p-4 md:rounded-[1.9rem] md:p-6">
          <div className="flex flex-col gap-4 md:gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2.5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Household cookbook
              </p>
              <div className="space-y-1.5">
                <h1 className="text-2xl md:text-4xl">
                  Recipes ready for real meal planning.
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Keep family staples easy to scan, easy to import, and fast to
                  pull into the week.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {showMealPlanShortcut ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/meals?tab=plan">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Open planner
                  </Link>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualCreate((prev) => !prev)}
              >
                {showManualCreate ? (
                  <X className="mr-2 h-4 w-4" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                {showManualCreate ? "Close editor" : "Create manually"}
              </Button>
              <Button onClick={() => setShowImportModal(true)} size="sm">
                <Camera className="mr-2 h-4 w-4" />
                Import from file
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 md:mt-6 md:gap-3 xl:grid-cols-4">
            <div className="rounded-[1.1rem] border border-border/75 bg-background/60 px-3 py-2.5 md:rounded-[1.35rem] md:px-4 md:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Cookbook size
              </p>
              <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] md:mt-2 md:text-2xl">
                {totalRecipes}
              </p>
            </div>
            <div className="rounded-[1.1rem] border border-border/75 bg-background/60 px-3 py-2.5 md:rounded-[1.35rem] md:px-4 md:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Quick wins
              </p>
              <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] md:mt-2 md:text-2xl">
                {quickRecipeCount}
              </p>
            </div>
            <div className="rounded-[1.1rem] border border-border/75 bg-background/60 px-3 py-2.5 md:rounded-[1.35rem] md:px-4 md:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                With visuals
              </p>
              <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] md:mt-2 md:text-2xl">
                {recipesWithPhotos}
              </p>
            </div>
            <div className="rounded-[1.1rem] border border-border/75 bg-background/60 px-3 py-2.5 md:rounded-[1.35rem] md:px-4 md:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Tagged
              </p>
              <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] md:mt-2 md:text-2xl">
                {taggedRecipeCount}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="feature-panel rounded-[1.5rem] p-3.5 md:rounded-[1.8rem] md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2.5 xl:max-w-2xl">
            <div className="space-y-1.5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Browse and capture
              </p>
              <h2 className="text-xl md:text-2xl">
                Search quickly, then add what is missing.
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title or description"
                  className="h-11 rounded-xl border-border/75 bg-background/80 pl-9"
                />
              </div>
              <Input
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                placeholder="Filter by tag"
                className="h-11 rounded-xl border-border/75 bg-background/80"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {showMealPlanShortcut ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/meals?tab=plan">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Meal plan
                </Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualCreate((prev) => !prev)}
            >
              {showManualCreate ? (
                <X className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {showManualCreate ? "Hide editor" : "New recipe"}
            </Button>
            <Button onClick={() => setShowImportModal(true)} size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </div>
        </div>

        {tagCounts.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tagCounts.map(([tag, count]) => {
              const isActive =
                tagFilter.trim().toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(isActive ? "" : tag)}
                  className="transition"
                >
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className="rounded-full px-3 py-1.5"
                  >
                    {tag} · {count}
                  </Badge>
                </button>
              );
            })}
            {tagFilter.trim() ? (
              <button type="button" onClick={() => setTagFilter("")}>
                <Badge variant="outline" className="rounded-full px-3 py-1.5">
                  Clear filter
                </Badge>
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {showManualCreate ? (
        <RecipeForm
          title="Create recipe"
          submitLabel="Save recipe"
          onSubmit={handleCreate}
          onCancel={() => setShowManualCreate(false)}
        />
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="feature-panel h-72 animate-pulse rounded-[1.7rem] bg-muted/60"
            />
          ))}
        </div>
      ) : (
        <RecipeList
          recipes={recipes}
          listHref={listHref}
          emptyMessage={
            search.trim() || tagFilter.trim()
              ? "No recipes match those filters"
              : "No recipes in the cookbook yet"
          }
        />
      )}

      <AlertDialog
        open={showImportModal}
        onOpenChange={(open) => {
          if (isCreatingFromFile || isCreatingFromUrl) return;
          setShowImportModal(open);
          if (!open) resetImportForm();
        }}
      >
        <AlertDialogContent className="border-border/80 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--card)/0.92))] sm:max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">
              Import a recipe from a URL or file
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Save the practical recipe card, keep the original source nearby,
              and attach a reminder image when one is available.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Tabs
            value={importMode}
            onValueChange={(value) => setImportMode(value as "files" | "url")}
            className="space-y-4"
          >
            <TabsList className="grid h-auto grid-cols-2 rounded-2xl bg-muted/75 p-1">
              <TabsTrigger value="url" className="rounded-xl py-2">
                <Link2 className="mr-2 h-4 w-4" />
                From URL
              </TabsTrigger>
              <TabsTrigger value="files" className="rounded-xl py-2">
                <Upload className="mr-2 h-4 w-4" />
                From file
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div className="rounded-[1.35rem] border border-border/75 bg-background/60 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Paste the original recipe page
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The importer keeps the source link, pulls the core recipe
                  only, and uses the page image as a memory cue when it can.
                </p>
              </div>
              <div className="space-y-2">
                <Input
                  value={importUrl}
                  onChange={(event) => setImportUrl(event.target.value)}
                  placeholder="https://example.com/recipe"
                  disabled={isCreatingFromUrl}
                  className="h-11 rounded-xl bg-background/80"
                />
              </div>
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,text/plain"
                multiple
                className="hidden"
                onChange={handleImportFilesChange}
                disabled={isCreatingFromFile}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCreatingFromFile}
                className="empty-state-panel flex w-full flex-col items-center justify-center rounded-[1.5rem] px-5 py-8 text-center transition hover:border-primary/35"
              >
                <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border border-border/80 bg-background/75">
                  <Upload className="h-6 w-6 text-primary" />
                </span>
                <p className="font-semibold text-foreground">
                  {importFiles?.length
                    ? "Change selected files"
                    : "Choose files to import"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Images, PDFs, and plain text all work.
                </p>
              </button>

              {importFiles && importFiles.length > 0 ? (
                <div className="rounded-[1.25rem] border border-border/75 bg-background/65 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Selected files
                  </p>
                  <div className="mt-3 max-h-36 space-y-2 overflow-auto text-sm text-foreground/90">
                    {Array.from(importFiles).map((file) => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="truncate"
                      >
                        {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <Textarea
              value={importPrompt}
              onChange={(event) => setImportPrompt(event.target.value)}
              placeholder="Optional notes, for example: keep the title short, combine duplicate ingredients, or preserve kid-friendly wording."
              disabled={isCreatingFromFile || isCreatingFromUrl}
              rows={4}
              className="bg-background/80"
            />
          </Tabs>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isCreatingFromFile || isCreatingFromUrl}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={() =>
                void (importMode === "url"
                  ? handleCreateFromUrl()
                  : handleCreateFromFiles())
              }
              disabled={isCreatingFromFile || isCreatingFromUrl}
            >
              {isCreatingFromFile || isCreatingFromUrl ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : importMode === "url" ? (
                <Link2 className="mr-2 h-4 w-4" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Create recipe
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
