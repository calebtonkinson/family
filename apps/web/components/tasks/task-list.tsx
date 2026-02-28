"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { TaskCard } from "./task-card";
import { Button } from "@/components/ui/button";
import { CheckSquare, Plus } from "lucide-react";
import type { Task, FamilyMember } from "@/lib/api-client";
import { buildNewTaskHrefFromLocation } from "@/lib/task-navigation";

interface TaskListProps {
  tasks: Task[];
  emptyMessage?: string;
  showProject?: boolean;
  showTheme?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  bulkToolbar?: React.ReactNode;
  listHref?: string;
  assignees?: FamilyMember[];
}

export function TaskList({
  tasks,
  emptyMessage = "No tasks found",
  showProject = true,
  showTheme = true,
  selectable,
  selectedIds = new Set(),
  onSelectionChange,
  bulkToolbar,
  listHref,
  assignees,
}: TaskListProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const newTaskHref = buildNewTaskHrefFromLocation(pathname, searchParams.toString());

  const handleSelectTask = (taskId: string, selected: boolean) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (selected) next.add(taskId);
    else next.delete(taskId);
    onSelectionChange(next);
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="mb-2 text-muted-foreground">{emptyMessage}</p>
        <Button asChild>
          <Link href={newTaskHref}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first task
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {bulkToolbar}
      <div className="space-y-2 sm:space-y-0 sm:divide-y sm:divide-border sm:rounded-lg sm:border sm:bg-card">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            showProject={showProject}
            showTheme={showTheme}
            selectable={selectable}
            selected={selectedIds.has(task.id)}
            onSelectionChange={(s) => handleSelectTask(task.id, s)}
            listHref={listHref}
            assignees={assignees}
          />
        ))}
      </div>
    </div>
  );
}
