"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useTheme, useUpdateTheme, useDeleteTheme } from "@/hooks/use-themes";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  AlertCircle,
  Pencil,
  Trash2,
  Check,
  X,
  Folder,
  CheckSquare,
  Plus,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildNewTaskHref } from "@/lib/task-navigation";
import { ThemeIcon } from "@/components/themes/theme-icon";

interface ThemePageProps {
  params: Promise<{ id: string }>;
}

export default function ThemePage({ params }: ThemePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const { data: themeData, isLoading, error } = useTheme(id);
  const updateTheme = useUpdateTheme();
  const deleteTheme = useDeleteTheme();
  const { data: projectsData, isLoading: projectsLoading } = useProjects({ themeId: id });
  const { data: tasksData, isLoading: tasksLoading } = useTasks({ themeId: id });

  const theme = themeData?.data;
  const projects = projectsData?.data || [];
  const tasks = tasksData?.data || [];

  const [formData, setFormData] = useState({
    name: "",
    icon: "",
    color: "",
  });

  // Update form data when theme loads
  useEffect(() => {
    if (theme) {
      setFormData({
        name: theme.name,
        icon: theme.icon || "",
        color: theme.color || "#6366f1",
      });
    }
  }, [theme]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    try {
      await updateTheme.mutateAsync({
        id,
        data: {
          name: formData.name,
          icon: formData.icon || undefined,
          color: formData.color || undefined,
        },
      });

      toast({ title: "Success", description: "Theme updated successfully" });
      setIsEditing(false);
    } catch {
      toast({ title: "Error", description: "Failed to update theme", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTheme.mutateAsync(id);
      toast({ title: "Success", description: "Theme deleted" });
      router.push("/themes");
    } catch {
      toast({ title: "Error", description: "Failed to delete theme", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/themes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Themes
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-12 w-12 animate-pulse rounded-lg bg-muted" />
              <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !theme) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/themes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Themes
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">Theme Not Found</h2>
            <p className="text-muted-foreground">
              The theme you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/themes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Themes
          </Link>
        </Button>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Theme</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this theme? Projects and tasks under this theme will not be deleted, but they will no longer be associated with this theme.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Theme Info Card */}
      <Card className="mb-6">
        <CardHeader>
          {isEditing ? (
            <div className="flex items-center justify-between">
              <CardTitle>Edit Theme</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateTheme.isPending}>
                  <Check className="mr-2 h-4 w-4" />
                  {updateTheme.isPending ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ backgroundColor: theme.color || "#6366f1" }}
              >
                <ThemeIcon icon={theme.icon} name={theme.name} size="lg" />
              </div>
              <div>
                <CardTitle className="text-2xl">{theme.name}</CardTitle>
                <CardDescription className="mt-1">
                  Created {format(new Date(theme.createdAt), "MMMM d, yyyy")}
                </CardDescription>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Theme name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (Emoji)</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🏠"
                    maxLength={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-16 cursor-pointer p-1"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#6366f1"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-medium">{projects.length}</span>
                <span className="text-muted-foreground">projects</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-medium">{tasks.length}</span>
                <span className="text-muted-foreground">tasks</span>
              </div>
              {doneTasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="success">{doneTasks.length} completed</Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Projects
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/new?themeId=${id}`}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {project.dueDate && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(project.dueDate), "MMM d")}
                        </div>
                      )}
                      <Badge variant={project.isActive ? "default" : "secondary"}>
                        {project.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {project.taskCount !== undefined && (
                        <span className="text-sm text-muted-foreground">
                          {project.completedTaskCount || 0}/{project.taskCount} tasks
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-muted-foreground">
              No projects under this theme yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Tasks
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={buildNewTaskHref({ themeId: id, returnTo: `/themes/${id}` })}>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : tasks.length > 0 ? (
            <div className="space-y-4">
              {/* To Do Tasks */}
              {todoTasks.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">To Do ({todoTasks.length})</h4>
                  <div className="space-y-2">
                    {todoTasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {/* In Progress Tasks */}
              {inProgressTasks.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">In Progress ({inProgressTasks.length})</h4>
                  <div className="space-y-2">
                    {inProgressTasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {/* Done Tasks */}
              {doneTasks.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">Completed ({doneTasks.length})</h4>
                  <div className="space-y-2">
                    {doneTasks.slice(0, 5).map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                    {doneTasks.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        +{doneTasks.length - 5} more completed tasks
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="py-4 text-center text-muted-foreground">
              No tasks under this theme yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Task Item Component
function TaskItem({ task }: { task: { id: string; title: string; status: string; dueDate: string | null; priority: number; project?: { id: string; name: string } | null } }) {
  const getStatusBadge = () => {
    switch (task.status) {
      case "done":
        return <Badge variant="success">Done</Badge>;
      case "in_progress":
        return <Badge variant="default">In Progress</Badge>;
      default:
        return null;
    }
  };

  const getPriorityIndicator = () => {
    if (task.priority === 2) {
      return <span className="h-2 w-2 rounded-full bg-destructive" title="Urgent" />;
    }
    if (task.priority === 1) {
      return <span className="h-2 w-2 rounded-full bg-yellow-500" title="High Priority" />;
    }
    return null;
  };

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className={cn(
        "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
        task.status === "done" && "opacity-60"
      )}>
        <div className="flex items-center gap-3">
          {getPriorityIndicator()}
          <span className={cn(task.status === "done" && "line-through")}>
            {task.title}
          </span>
          {task.project && (
            <Badge variant="outline" className="text-xs">
              {task.project.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className="text-sm text-muted-foreground">
              {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}
          {getStatusBadge()}
        </div>
      </div>
    </Link>
  );
}
