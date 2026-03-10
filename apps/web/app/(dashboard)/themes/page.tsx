"use client";

import { useThemes } from "@/hooks/use-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeIcon } from "@/components/themes/theme-icon";
import { Plus, Folder, CheckSquare, Palette, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ThemesPage() {
  const { data: themesData, isLoading } = useThemes();
  const themes = themesData?.data || [];
  const totalProjects = themes.reduce((sum, theme) => sum + (theme.projectCount || 0), 0);
  const totalTasks = themes.reduce((sum, theme) => sum + (theme.taskCount || 0), 0);

  return (
    <div className="space-y-6">
      <section className="feature-panel overflow-hidden rounded-[1.8rem] p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Organize by energy
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl">Themes</h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Turn broad areas of life into visual buckets so projects and tasks feel grouped, not scattered.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-[1.35rem] border border-border/75 bg-[linear-gradient(180deg,hsl(var(--card)/0.95),hsl(var(--card)/0.82))] px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--background)/0.9)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Themes</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{themes.length}</p>
            </div>
            <div className="rounded-[1.35rem] border border-border/75 bg-[linear-gradient(180deg,hsl(var(--card)/0.95),hsl(var(--card)/0.82))] px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--background)/0.9)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Projects</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{totalProjects}</p>
            </div>
            <div className="rounded-[1.35rem] border border-border/75 bg-[linear-gradient(180deg,hsl(var(--card)/0.95),hsl(var(--card)/0.82))] px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--background)/0.9)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tasks</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{totalTasks}</p>
            </div>
            <Button asChild className="h-auto rounded-[1.25rem] px-5 py-3">
              <Link href="/themes/new">
                <Plus className="mr-2 h-4 w-4" />
                New Theme
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-[1.5rem] bg-muted" />
          ))}
        </div>
      ) : themes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <Link key={theme.id} href={`/themes/${theme.id}`}>
              <Card className="feature-panel h-full overflow-hidden">
                <CardHeader className="pb-3">
                  <div
                    className="rounded-[1.35rem] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                    style={{
                      background: `linear-gradient(160deg, ${theme.color || "#4f73d9"} 0%, ${theme.color || "#4f73d9"}cc 100%)`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/12">
                          <ThemeIcon icon={theme.icon} name={theme.name} size="lg" />
                        </span>
                        <div>
                          <CardTitle className="text-xl text-white">{theme.name}</CardTitle>
                          <p className="mt-1 text-sm text-white/72">
                            A dedicated lane for this part of household life.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-white/70" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        <Folder className="h-3.5 w-3.5" />
                        Projects
                      </div>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{theme.projectCount || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        <CheckSquare className="h-3.5 w-3.5" />
                        Tasks
                      </div>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{theme.taskCount || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Color-led organization
                    </span>
                    <span className="font-medium text-foreground">Open</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state-panel rounded-[1.75rem] py-16 text-center text-muted-foreground">
          <p className="text-lg font-semibold text-foreground">No themes yet</p>
          <p className="mt-2">Create your first theme to organize tasks and projects.</p>
        </div>
      )}
    </div>
  );
}
