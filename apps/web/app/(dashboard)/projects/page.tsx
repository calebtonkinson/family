"use client";

import { useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useThemes } from "@/hooks/use-themes";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
  const [themeId, setThemeId] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("active");

  const { data: projectsData, isLoading } = useProjects({
    themeId: themeId === "all" ? undefined : themeId,
    isActive: activeFilter === "all" ? undefined : activeFilter === "active",
  });

  const { data: themesData } = useThemes();

  const projects = projectsData?.data || [];
  const themes = themesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <Select value={themeId} onValueChange={setThemeId}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All themes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All themes</SelectItem>
            {themes.map((theme) => (
              <SelectItem key={theme.id} value={theme.id}>
                {theme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="archived">Archived only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Project Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No projects found. Create your first project to get started.
        </div>
      )}
    </div>
  );
}
