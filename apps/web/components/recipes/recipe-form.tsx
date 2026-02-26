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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Upload, Paperclip } from "lucide-react";
import type {
  Ingredient,
  Recipe,
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeAttachment,
} from "@/lib/api-client";

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

const emptyIngredient: Ingredient = { name: "", quantity: "", unit: "", qualifiers: "" };

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
  onSubmit: (data: CreateRecipeInput | UpdateRecipeInput) => Promise<void> | void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData(initialValues);
  }, [initialValues]);

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || (initialRecipe ? "Edit Recipe" : "Create Recipe")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Recipe title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Short description"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Ingredients</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
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

            <div className="space-y-3">
              {formData.ingredients.map((ingredient, index) => (
                <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-12">
                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input
                      value={ingredient.quantity?.toString() ?? ""}
                      onChange={(e) => handleIngredientChange(index, "quantity", e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Unit</Label>
                    <Input
                      value={ingredient.unit ?? ""}
                      onChange={(e) => handleIngredientChange(index, "unit", e.target.value)}
                      placeholder="cup"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label className="text-xs text-muted-foreground">Ingredient</Label>
                    <Input
                      value={ingredient.name}
                      onChange={(e) => handleIngredientChange(index, "name", e.target.value)}
                      placeholder="Chicken thighs"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs text-muted-foreground">Qualifiers</Label>
                    <Input
                      value={ingredient.qualifiers ?? ""}
                      onChange={(e) => handleIngredientChange(index, "qualifiers", e.target.value)}
                      placeholder="chopped"
                    />
                  </div>
                  <div className="flex items-end md:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          ingredients: prev.ingredients.filter((_, i) => i !== index),
                        }))
                      }
                      disabled={formData.ingredients.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Instructions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
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
            <div className="space-y-3">
              {formData.instructions.map((instruction, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-2 text-sm text-muted-foreground">{index + 1}.</div>
                  <Textarea
                    value={instruction}
                    onChange={(e) => handleInstructionChange(index, e.target.value)}
                    placeholder="Describe the step..."
                    rows={2}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        instructions: prev.instructions.filter((_, i) => i !== index),
                      }))
                    }
                    disabled={formData.instructions.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={formData.tagsInput}
              onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
              placeholder="kid-friendly, quick, dinner"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="prepTime">Prep (min)</Label>
              <Input
                id="prepTime"
                value={formData.prepTimeMinutes}
                onChange={(e) => setFormData({ ...formData, prepTimeMinutes: e.target.value })}
                placeholder="10"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cookTime">Cook (min)</Label>
              <Input
                id="cookTime"
                value={formData.cookTimeMinutes}
                onChange={(e) => setFormData({ ...formData, cookTimeMinutes: e.target.value })}
                placeholder="25"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yield">Servings</Label>
              <Input
                id="yield"
                value={formData.yieldServings}
                onChange={(e) => setFormData({ ...formData, yieldServings: e.target.value })}
                placeholder="4"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source}
                onValueChange={(value) =>
                  setFormData({ ...formData, source: value as RecipeFormValues["source"] })
                }
              >
                <SelectTrigger id="source">
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Attachments</Label>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Add files
            </Button>

            {formData.attachments.length > 0 ? (
              <div className="space-y-3">
                {formData.attachments.map((attachment, index) => (
                  <div
                    key={`${attachment.url}-${index}`}
                    className="rounded-md border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <a
                          href={attachment.url}
                          download={attachment.filename}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {attachment.filename || `Attachment ${index + 1}`}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {attachment.mediaType}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
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
                        alt={attachment.filename || `Attachment ${index + 1}`}
                        className="mt-3 max-h-48 rounded-md border object-contain"
                      />
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
              <p className="text-sm text-muted-foreground">No attachments</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit">{submitLabel}</Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
