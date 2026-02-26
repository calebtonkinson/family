"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useProject, useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { useThemes } from "@/hooks/use-themes";
import { useTasks } from "@/hooks/use-tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CheckSquare,
  Plus,
  Calendar,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildNewTaskHref } from "@/lib/task-navigation";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

const NO_THEME_VALUE = "__none__";

export default function ProjectPage({ params }: ProjectPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const { data: projectData, isLoading, error } = useProject(id);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { data: themesData } = useThemes();
  const { data: tasksData, isLoading: tasksLoading } = useTasks({ projectId: id });

  const project = projectData?.data;
  const themes = themesData?.data || [];
  const tasks = tasksData?.data || [];

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    themeId: "",
    dueDate: "",
    isActive: true,
  });

  // Update form data when project loads
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || "",
        themeId: project.themeId || "",
        dueDate: project.dueDate?.split("T")[0] ?? "",
        isActive: project.isActive,
      });
    }
  }, [project]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    try {
      await updateProject.mutateAsync({
        id,
        data: {
          name: formData.name,
          description: formData.description.trim() ? formData.description : null,
          themeId: formData.themeId || null,
          dueDate: formData.dueDate || null,
          isActive: formData.isActive,
        },
      });

      toast({ title: "Success", description: "Project updated successfully" });
      setIsEditing(false);
    } catch {
      toast({ title: "Error", description: "Failed to update project", variant: "destructive" });
    }
  };

  const handleCancelEdit = () => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || "",
        themeId: project.themeId || "",
        dueDate: project.dueDate?.split("T")[0] ?? "",
        isActive: project.isActive,
      });
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync(id);
      toast({ title: "Success", description: "Project deleted" });
      router.push("/projects");
    } catch {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">Project Not Found</h2>
            <p className="text-muted-foreground">
              The project you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const totalTasks = tasks.length;
  const completedTasks = doneTasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
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
                    <AlertDialogTitle>Delete Project</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this project? Tasks under this project will not be deleted, but they will no longer be associated with this project.
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

      {/* Project Info Card */}
      <Card className="mb-6">
        <CardHeader>
          {isEditing ? (
            <div className="flex items-center justify-between">
              <CardTitle>Edit Project</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateProject.isPending}>
                  <Check className="mr-2 h-4 w-4" />
                  {updateProject.isPending ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl">{project.name}</CardTitle>
                  <Badge variant={project.isActive ? "default" : "secondary"}>
                    {project.isActive ? "Active" : "Archived"}
                  </Badge>
                </div>
                <CardDescription className="mt-1">
                  Created {format(new Date(project.createdAt), "MMMM d, yyyy")}
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
                  placeholder="Project name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this project about?"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={formData.themeId || NO_THEME_VALUE}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        themeId: value === NO_THEME_VALUE ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_THEME_VALUE}>No theme</SelectItem>
                      {themes.map((theme) => (
                        <SelectItem key={theme.id} value={theme.id}>
                          {theme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active project</Label>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}

              <div className="flex flex-wrap gap-4">
                {project.theme && (
                  <Link href={`/themes/${project.theme.id}`}>
                    <div className="flex items-center gap-2 text-sm">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <Badge
                        variant="outline"
                        style={{ borderColor: project.theme.color || undefined }}
                      >
                        {project.theme.name}
                      </Badge>
                    </div>
                  </Link>
                )}
                {project.dueDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Due {format(new Date(project.dueDate), "MMMM d, yyyy")}
                  </div>
                )}
              </div>

              {/* Progress Section */}
              {totalTasks > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{completedTasks}</span>
                      <span className="text-muted-foreground">of {totalTasks} tasks completed</span>
                    </span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
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
              <Link href={buildNewTaskHref({ projectId: id, returnTo: `/projects/${id}` })}>
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
              No tasks in this project yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Task Item Component
function TaskItem({ task }: { task: { id: string; title: string; status: string; dueDate: string | null; priority: number; theme?: { id: string; name: string; color: string | null } | null } }) {
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
          {task.theme && (
            <Badge
              variant="outline"
              className="text-xs"
              style={{ borderColor: task.theme.color || undefined }}
            >
              {task.theme.name}
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
