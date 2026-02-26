"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateTheme } from "@/hooks/use-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const PRESET_COLORS = [
  "#4A90D9", // Blue
  "#50C878", // Green
  "#FF6B6B", // Red
  "#9B59B6", // Purple
  "#F39C12", // Orange
  "#1ABC9C", // Teal
  "#E91E63", // Pink
  "#607D8B", // Gray
];

export default function NewThemePage() {
  const router = useRouter();
  const createTheme = useCreateTheme();

  const [formData, setFormData] = useState({
    name: "",
    icon: "",
    color: "#4A90D9",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    try {
      await createTheme.mutateAsync({
        name: formData.name,
        icon: formData.icon || undefined,
        color: formData.color,
      });

      toast({ title: "Success", description: "Theme created successfully" });
      router.push("/themes");
    } catch {
      toast({ title: "Error", description: "Failed to create theme", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/themes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Themes
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Home Maintenance, Finance, Health"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon (optional)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="e.g., home, car, heart"
              />
              <p className="text-xs text-muted-foreground">
                Enter a Lucide icon name or leave empty to use the first letter
              </p>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-10 w-10 rounded-lg border-2 transition-all ${
                      formData.color === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-20 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">
                  Or pick a custom color
                </span>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: formData.color }}
                >
                  <span className="text-lg text-white">
                    {formData.icon || formData.name[0]?.toUpperCase() || "?"}
                  </span>
                </div>
                <span className="font-medium">{formData.name || "Theme Name"}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={createTheme.isPending}>
                {createTheme.isPending ? "Creating..." : "Create Theme"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
