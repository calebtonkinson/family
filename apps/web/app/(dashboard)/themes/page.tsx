"use client";

import { useThemes } from "@/hooks/use-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeIcon } from "@/components/themes/theme-icon";
import { Plus, Folder, CheckSquare } from "lucide-react";
import Link from "next/link";

export default function ThemesPage() {
  const { data: themesData, isLoading } = useThemes();
  const themes = themesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Themes</h1>
        <Button asChild>
          <Link href="/themes/new">
            <Plus className="mr-2 h-4 w-4" />
            New Theme
          </Link>
        </Button>
      </div>

      {/* Theme Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : themes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <Link key={theme.id} href={`/themes/${theme.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: theme.color || "#6366f1" }}
                    >
                      <ThemeIcon icon={theme.icon} name={theme.name} size="md" />
                    </div>
                    <CardTitle className="text-lg">{theme.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Folder className="h-4 w-4" />
                      {theme.projectCount || 0} projects
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckSquare className="h-4 w-4" />
                      {theme.taskCount || 0} tasks
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No themes found. Create your first theme to organize tasks and projects.
        </div>
      )}
    </div>
  );
}
