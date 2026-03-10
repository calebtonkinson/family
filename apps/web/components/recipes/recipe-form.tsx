"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ImagePlus,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  Ingredient,
  Recipe,
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeAttachment,
} from "@/lib/api-client";
import {
  getAttachmentLabel,
  inferAttachmentLabelFromUrl,
  inferImageMediaTypeFromUrl,
  isWebLinkAttachment,
} from "@/lib/recipe-attachments";
import { toast } from "@/hooks/use-toast";

type RecipeFormValues = {
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  tagsInput: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  yieldServings: string;
  source: "photo" | "link" | "manual" | "family";
  notes: string;
  attachments: RecipeAttachment[];
};

const emptyIngredient: Ingredient = {
  name: "",
  quantity: "",
  unit: "",
  qualifiers: "",
};

const coerceNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const normalizeIngredients = (ingredients: Ingredient[]) =>
  ingredients
    .map((ingredient) => ({
      name: ingredient.name.trim(),
      quantity: ingredient.quantity === "" ? undefined : ingredient.quantity,
      unit: ingredient.unit?.trim() || undefined,
      qualifiers: ingredient.qualifiers?.trim() || undefined,
    }))
    .filter((ingredient) => ingredient.name.length > 0);

const normalizeInstructions = (instructions: string[]) =>
  instructions.map((step) => step.trim()).filter(Boolean);

const normalizeTags = (tagsInput: string) =>
  tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

interface RecipeFormProps {
  initialRecipe?: Recipe;
  title?: string;
  submitLabel?: string;
  onSubmit: (
    data: CreateRecipeInput | UpdateRecipeInput,
  ) => Promise<void> | void;
  onCancel?: () => void;
}

export function RecipeForm({
  initialRecipe,
  title,
  submitLabel = "Save recipe",
  onSubmit,
  onCancel,
}: RecipeFormProps) {
  const initialValues = useMemo<RecipeFormValues>(() => {
    if (!initialRecipe) {
      return {
        title: "",
        description: "",
        ingredients: [emptyIngredient],
        instructions: [""],
        tagsInput: "",
        prepTimeMinutes: "",
        cookTimeMinutes: "",
        yieldServings: "",
        source: "manual",
        notes: "",
        attachments: [],
      };
    }

    return {
      title: initialRecipe.title,
      description: initialRecipe.description || "",
      ingredients: initialRecipe.ingredientsJson.length
        ? initialRecipe.ingredientsJson
        : [emptyIngredient],
      instructions: initialRecipe.instructionsJson.length
        ? initialRecipe.instructionsJson
        : [""],
      tagsInput: initialRecipe.tags.join(", "),
      prepTimeMinutes: initialRecipe.prepTimeMinutes?.toString() ?? "",
      cookTimeMinutes: initialRecipe.cookTimeMinutes?.toString() ?? "",
      yieldServings: initialRecipe.yieldServings?.toString() ?? "",
      source: initialRecipe.source,
      notes: initialRecipe.notes || "",
      attachments: initialRecipe.attachmentsJson ?? [],
    };
  }, [initialRecipe]);

  const [formData, setFormData] = useState<RecipeFormValues>(initialValues);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentKind, setAttachmentKind] = useState<"image" | "link">(
    "image",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData(initialValues);
    setAttachmentUrl("");
    setAttachmentLabel("");
    setAttachmentKind("image");
  }, [initialValues]);

  const clearAttachmentUrlInputs = () => {
    setAttachmentUrl("");
    setAttachmentLabel("");
    setAttachmentKind("image");
  };

  const ingredientCount = normalizeIngredients(formData.ingredients).length;
  const stepCount = normalizeInstructions(formData.instructions).length;
  const totalMinutes =
    (coerceNumber(formData.prepTimeMinutes) ?? 0) +
    (coerceNumber(formData.cookTimeMinutes) ?? 0);

  const handleIngredientChange = (
    index: number,
    field: keyof Ingredient,
    value: string,
  ) => {
    setFormData((prev) => {
      const next = [...prev.ingredients];
      next[index] = { ...next[index], [field]: value } as Ingredient;
      return { ...prev, ingredients: next };
    });
  };

  const handleInstructionChange = (index: number, value: string) => {
    setFormData((prev) => {
      const next = [...prev.instructions];
      next[index] = value;
      return { ...prev, instructions: next };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      ingredientsJson: normalizeIngredients(formData.ingredients),
      instructionsJson: normalizeInstructions(formData.instructions),
      tags: normalizeTags(formData.tagsInput),
      prepTimeMinutes: coerceNumber(formData.prepTimeMinutes),
      cookTimeMinutes: coerceNumber(formData.cookTimeMinutes),
      yieldServings: coerceNumber(formData.yieldServings),
      source: formData.source,
      notes: formData.notes.trim() || undefined,
      attachmentsJson: formData.attachments,
    };

    await onSubmit(payload);
  };

  const handleAttachmentFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files?.length) return;

    try {
      const attachments = await Promise.all(
        Array.from(files).map(async (file) => ({
          url: await readFileAsDataUrl(file),
          mediaType: file.type || "application/octet-stream",
          filename: file.name,
        })),
      );

      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...attachments],
      }));
    } catch (error) {
      console.error("Failed to process attachment files", error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddAttachmentUrl = () => {
    const normalizedUrl = attachmentUrl.trim();
    if (!normalizedUrl) {
      toast({ title: "Add a URL first", variant: "destructive" });
      return;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      toast({ title: "Enter a valid URL", variant: "destructive" });
      return;
    }

    const normalizedLabel =
      attachmentLabel.trim() ||
      inferAttachmentLabelFromUrl(
        normalizedUrl,
        attachmentKind === "image" ? "Recipe image" : "Recipe link",
      );

    setFormData((prev) => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        {
          url: normalizedUrl,
          mediaType:
            attachmentKind === "image"
              ? inferImageMediaTypeFromUrl(normalizedUrl)
              : "text/html",
          filename: normalizedLabel,
        },
      ],
    }));
    clearAttachmentUrlInputs();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="feature-panel overflow-hidden rounded-[1.9rem] p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Recipe editor
            </p>
            <div className="space-y-2">
              <h2 className="text-3xl">
                {title || (initialRecipe ? "Edit recipe" : "Create recipe")}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Keep recipes structured enough for planning. Ingredients stay
                separate from instructions, and the steps should stay clean and
                lightweight.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1.5">
              {ingredientCount} ingredients
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1.5">
              {stepCount} steps
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1.5">
              {totalMinutes > 0 ? `${totalMinutes} min` : "Flexible timing"}
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_24rem]">
        <div className="space-y-6">
          <section className="feature-panel rounded-[1.8rem] p-5">
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Basics
              </p>
              <h3 className="text-2xl">Start with the recipe identity</h3>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData({ ...formData, title: event.target.value })
                  }
                  placeholder="Sheet-pan chicken tacos"
                  required
                  className="h-11 rounded-xl bg-background/80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      description: event.target.value,
                    })
                  }
                  placeholder="A quick weeknight dinner with crisp edges and easy leftovers."
                  rows={3}
                  className="bg-background/80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={formData.tagsInput}
                  onChange={(event) =>
                    setFormData({ ...formData, tagsInput: event.target.value })
                  }
                  placeholder="kid-friendly, quick, dinner"
                  className="h-11 rounded-xl bg-background/80"
                />
              </div>
            </div>
          </section>

          <section className="feature-panel rounded-[1.8rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Ingredients
                </p>
                <h3 className="text-2xl">
                  One item per line, structured for planning
                </h3>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    ingredients: [...prev.ingredients, { ...emptyIngredient }],
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add ingredient
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {formData.ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  className="rounded-[1.4rem] border border-border/75 bg-background/55 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Badge
                      variant="secondary"
                      className="rounded-full px-3 py-1"
                    >
                      Item {index + 1}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          ingredients: prev.ingredients.filter(
                            (_, i) => i !== index,
                          ),
                        }))
                      }
                      disabled={formData.ingredients.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">
                        Qty
                      </Label>
                      <Input
                        value={ingredient.quantity?.toString() ?? ""}
                        onChange={(event) =>
                          handleIngredientChange(
                            index,
                            "quantity",
                            event.target.value,
                          )
                        }
                        placeholder="1"
                        className="mt-1 bg-background/80"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">
                        Unit
                      </Label>
                      <Input
                        value={ingredient.unit ?? ""}
                        onChange={(event) =>
                          handleIngredientChange(
                            index,
                            "unit",
                            event.target.value,
                          )
                        }
                        placeholder="lb"
                        className="mt-1 bg-background/80"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label className="text-xs text-muted-foreground">
                        Ingredient
                      </Label>
                      <Input
                        value={ingredient.name}
                        onChange={(event) =>
                          handleIngredientChange(
                            index,
                            "name",
                            event.target.value,
                          )
                        }
                        placeholder="chicken thighs"
                        className="mt-1 bg-background/80"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label className="text-xs text-muted-foreground">
                        Qualifier
                      </Label>
                      <Input
                        value={ingredient.qualifiers ?? ""}
                        onChange={(event) =>
                          handleIngredientChange(
                            index,
                            "qualifiers",
                            event.target.value,
                          )
                        }
                        placeholder="boneless, skinless"
                        className="mt-1 bg-background/80"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="feature-panel rounded-[1.8rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Instructions
                </p>
                <h3 className="text-2xl">
                  Keep each step focused and readable
                </h3>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    instructions: [...prev.instructions, ""],
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add step
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {formData.instructions.map((instruction, index) => (
                <div
                  key={index}
                  className="flex gap-3 rounded-[1.4rem] border border-border/75 bg-background/55 p-4"
                >
                  <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Step {index + 1}
                    </Label>
                    <Textarea
                      value={instruction}
                      onChange={(event) =>
                        handleInstructionChange(index, event.target.value)
                      }
                      placeholder="Describe one action clearly."
                      rows={3}
                      className="bg-background/80"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        instructions: prev.instructions.filter(
                          (_, i) => i !== index,
                        ),
                      }))
                    }
                    disabled={formData.instructions.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="feature-panel rounded-[1.8rem] p-5">
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Timing and source
              </p>
              <h3 className="text-2xl">Make planning easier later</h3>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="prepTime">Prep time (minutes)</Label>
                <Input
                  id="prepTime"
                  value={formData.prepTimeMinutes}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      prepTimeMinutes: event.target.value,
                    })
                  }
                  placeholder="10"
                  inputMode="numeric"
                  className="h-11 rounded-xl bg-background/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cookTime">Cook time (minutes)</Label>
                <Input
                  id="cookTime"
                  value={formData.cookTimeMinutes}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      cookTimeMinutes: event.target.value,
                    })
                  }
                  placeholder="25"
                  inputMode="numeric"
                  className="h-11 rounded-xl bg-background/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yield">Servings</Label>
                <Input
                  id="yield"
                  value={formData.yieldServings}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      yieldServings: event.target.value,
                    })
                  }
                  placeholder="4"
                  inputMode="numeric"
                  className="h-11 rounded-xl bg-background/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      source: value as RecipeFormValues["source"],
                    })
                  }
                >
                  <SelectTrigger
                    id="source"
                    className="h-11 rounded-xl bg-background/80"
                  >
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="feature-panel rounded-[1.8rem] p-5">
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Notes
              </p>
              <h3 className="text-2xl">Capture the household context</h3>
            </div>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(event) =>
                setFormData({ ...formData, notes: event.target.value })
              }
              placeholder="Notes about substitutions, picky eaters, leftovers, or what pairs well with this."
              rows={6}
              className="mt-5 bg-background/80"
            />
          </section>

          <section className="feature-panel rounded-[1.8rem] p-5">
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Attachments
              </p>
              <h3 className="text-2xl">Keep the source material nearby</h3>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/plain"
              className="hidden"
              onChange={(event) => {
                void handleAttachmentFiles(event);
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="empty-state-panel mt-5 flex w-full flex-col items-center justify-center rounded-[1.5rem] px-4 py-7 text-center transition hover:border-primary/35"
            >
              <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border border-border/80 bg-background/75">
                <Upload className="h-6 w-6 text-primary" />
              </span>
              <p className="font-semibold text-foreground">Add files</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Photos, PDFs, and plain text are all fine.
              </p>
            </button>

            <div className="mt-4 rounded-[1.3rem] border border-border/75 bg-background/55 p-4">
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    Or add a web reference
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paste an image URL for a visual reminder or a recipe link to
                    keep the source nearby.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label htmlFor="attachmentKind">Type</Label>
                    <Select
                      value={attachmentKind}
                      onValueChange={(value) =>
                        setAttachmentKind(value as "image" | "link")
                      }
                    >
                      <SelectTrigger
                        id="attachmentKind"
                        className="bg-background/80"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="link">Source link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="attachmentUrl">URL</Label>
                    <Input
                      id="attachmentUrl"
                      value={attachmentUrl}
                      onChange={(event) => setAttachmentUrl(event.target.value)}
                      placeholder={
                        attachmentKind === "image"
                          ? "https://images.example.com/dinner.jpg"
                          : "https://example.com/recipe"
                      }
                      className="bg-background/80"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="attachmentLabel">Label</Label>
                    <Input
                      id="attachmentLabel"
                      value={attachmentLabel}
                      onChange={(event) =>
                        setAttachmentLabel(event.target.value)
                      }
                      placeholder={
                        attachmentKind === "image"
                          ? "Finished dish"
                          : "Original recipe"
                      }
                      className="bg-background/80"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddAttachmentUrl}
                    >
                      {attachmentKind === "image" ? (
                        <ImagePlus className="mr-2 h-4 w-4" />
                      ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                      )}
                      Add URL
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {formData.attachments.length > 0 ? (
              <div className="mt-4 space-y-3">
                {formData.attachments.map((attachment, index) => (
                  <div
                    key={`${attachment.url}-${index}`}
                    className="rounded-[1.3rem] border border-border/75 bg-background/55 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {getAttachmentLabel(
                            attachment,
                            `Attachment ${index + 1}`,
                          )}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {attachment.mediaType}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            attachments: prev.attachments.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {attachment.mediaType.startsWith("image/") ? (
                      <img
                        src={attachment.url}
                        alt={getAttachmentLabel(
                          attachment,
                          `Attachment ${index + 1}`,
                        )}
                        className="mt-3 max-h-52 rounded-[1rem] border border-border/75 object-contain"
                      />
                    ) : isWebLinkAttachment(attachment) ? (
                      <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Link2 className="h-3.5 w-3.5" />
                        Opens as a reference link
                      </div>
                    ) : (
                      <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Paperclip className="h-3.5 w-3.5" />
                        File attachment
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No attachments yet.
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="sticky bottom-[calc(var(--mobile-nav-offset)+8px)] z-10 rounded-[1.35rem] border border-border/80 bg-background/92 p-3 shadow-[0_18px_44px_-32px_hsl(var(--foreground)/0.5)] backdrop-blur supports-[backdrop-filter]:bg-background/72 md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit">{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}
