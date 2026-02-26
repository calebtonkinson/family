"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { usePinnedLists, useMarkOffListItem } from "@/hooks/use-lists";
import { TaskList } from "@/components/tasks/task-list";
import { ProjectCard } from "@/components/projects/project-card";
import { PinnedListCard } from "@/components/lists";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Calendar, AlertCircle, RefreshCw, List } from "lucide-react";
import Link from "next/link";
import { isToday, addDays, isBefore, startOfDay } from "date-fns";
import { buildNewTaskHref } from "@/lib/task-navigation";

export default function DashboardPage() {
  const { data: tasksData, isLoading: tasksLoading } = useTasks({
    status: "todo",
    limit: 50,
  });

  const { data: projectsData, isLoading: projectsLoading } = useProjects({
    isActive: true,
    limit: 5,
  });

  const { data: pinnedData } = usePinnedLists();
  const markOffItem = useMarkOffListItem();

  const tasks = tasksData?.data || [];
  const projects = projectsData?.data || [];
  const pinnedLists = pinnedData?.data || [];

  // Filter tasks
  const todayStart = startOfDay(new Date());

  const overdueTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return isBefore(dueDate, todayStart);
  });

  const todayTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return isToday(dueDate);
  });

  const upcomingTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    const weekFromNow = addDays(new Date(), 7);
    return isBefore(todayStart, dueDate) && isBefore(dueDate, weekFromNow);
  });

  const recurringTasks = tasks.filter((task) => task.isRecurring);

  if (tasksLoading || projectsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Pinned Lists */}
      {pinnedLists.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <List className="h-4 w-4 text-primary" />
              <h2 className="dashboard-section-title">Pinned Lists</h2>
            </div>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/lists">
                View all <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedLists.map((list) => (
              <PinnedListCard
                key={list.id}
                list={list}
                compact
                onToggleItem={(listId, itemId, markedOff) =>
                  markOffItem.mutate({ listId, itemId, markedOff })
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Today Section */}
      {overdueTasks.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <h2 className="dashboard-section-title">Overdue</h2>
              <span className="rounded-full bg-destructive px-1.5 py-0 text-[10px] leading-4 text-destructive-foreground">
                {overdueTasks.length}
              </span>
            </div>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/tasks?due=overdue">
                View all <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <TaskList tasks={overdueTasks.slice(0, 5)} />
        </section>
      )}

      {/* Today Section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="dashboard-section-title">Today</h2>
            {todayTasks.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] leading-4 text-primary-foreground">
                {todayTasks.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="xs" asChild>
            <Link href="/tasks">
              View all <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {todayTasks.length > 0 ? (
          <TaskList tasks={todayTasks.slice(0, 5)} />
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No tasks due today.
            </CardContent>
          </Card>
        )}
      </section>

      {/* Upcoming Section */}
      {upcomingTasks.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <h2 className="dashboard-section-title">Upcoming (7 days)</h2>
          </div>
          <TaskList tasks={upcomingTasks.slice(0, 5)} />
        </section>
      )}

      {/* Recurring Tasks */}
      {recurringTasks.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <h2 className="dashboard-section-title">Recurring Tasks</h2>
          </div>
          <TaskList tasks={recurringTasks.slice(0, 3)} />
        </section>
      )}

      {/* Active Projects */}
      {projects.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="dashboard-section-title">Projects in Progress</h2>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/projects">
                View all <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {tasks.length === 0 && projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold">Welcome to Home Management</h3>
            <p className="mt-2 text-muted-foreground">
              Get started by creating your first task or project.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button asChild>
                <Link href={buildNewTaskHref({ returnTo: "/dashboard" })}>Create Task</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/projects/new">Create Project</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <section>
        <Skeleton className="mb-3 h-5 w-24" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
