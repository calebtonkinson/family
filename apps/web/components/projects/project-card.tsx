"use client";

import { format } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, CheckCircle2 } from "lucide-react";
import type { Project } from "@/lib/api-client";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const totalTasks = project.taskCount || 0;
  const completedTasks = project.completedTaskCount || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="feature-panel overflow-hidden">
        <CardHeader className="pb-1.5 md:pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="line-clamp-2 text-base md:text-lg">
              {project.name}
            </CardTitle>
            {!project.isActive && <Badge variant="secondary">Archived</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 md:space-y-3">
          {project.description && (
            <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
              {project.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {project.theme && (
              <Badge
                variant="outline"
                className="rounded-full text-xs"
                style={{ borderColor: project.theme.color || undefined }}
              >
                {project.theme.name}
              </Badge>
            )}
            {project.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(project.dueDate), "MMM d, yyyy")}
              </span>
            )}
          </div>

          {totalTasks > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  {completedTasks} of {totalTasks} tasks
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
