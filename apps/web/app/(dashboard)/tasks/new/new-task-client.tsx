"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateTask } from "@/hooks/use-tasks";
import { useThemes } from "@/hooks/use-themes";
import { useProjects } from "@/hooks/use-projects";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { sanitizeTaskReturnTo } from "@/lib/task-navigation";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

const QUICK_TEMPLATES = [
  "Take out trash",
  "Do laundry",
  "Groceries",
  "Clean kitchen",
  "Water plants",
  "Pay bills",
];

export default function NewTaskClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createTask = useCreateTask();
  const { data: themesData } = useThemes();
  const { data: projectsData } = useProjects();
  const { data: familyData } = useFamilyMembers();

  // Get initial values from URL query parameters
  const initialThemeId = searchParams.get("themeId") || "";
  const initialProjectId = searchParams.get("projectId") || "";
  const returnTo = sanitizeTaskReturnTo(searchParams.get("returnTo"));

  const [showMore, setShowMore] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    themeId: initialThemeId,
    projectId: initialProjectId,
    assignedToId: "",
    dueDate: "",
    priority: "0",
    isRecurring: false,
    recurrenceType: "",
    recurrenceInterval: "1",
  });

  const applyDuePreset = (preset: "today" | "tomorrow" | "next_week") => {
    const today = new Date();
    if (preset === "today") {
      setFormData((prev) => ({ ...prev, dueDate: format(today, "yyyy-MM-dd") }));
      return;
    }
    if (preset === "tomorrow") {
      setFormData((prev) => ({ ...prev, dueDate: format(addDays(today, 1), "yyyy-MM-dd") }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      dueDate: format(addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1), "yyyy-MM-dd"),
    }));
  };

  // When projectId is provided via URL, also set the theme from the project
  useEffect(() => {
    if (initialProjectId && projectsData?.data) {
      const project = projectsData.data.find((p) => p.id === initialProjectId);
      if (project?.themeId && !initialThemeId) {
        setFormData((prev) => ({ ...prev, themeId: project.themeId! }));
      }
    }
  }, [initialProjectId, initialThemeId, projectsData?.data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }

    try {
      await createTask.mutateAsync({
        title: formData.title,
        description: formData.description || undefined,
        themeId: formData.themeId || undefined,
        projectId: formData.projectId || undefined,
        assignedToId: formData.assignedToId || undefined,
        dueDate: formData.dueDate || undefined,
        priority: parseInt(formData.priority),
        isRecurring: formData.isRecurring,
        recurrenceType: formData.isRecurring && formData.recurrenceType
          ? formData.recurrenceType as "daily" | "weekly" | "monthly" | "yearly"
          : undefined,
        recurrenceInterval: formData.isRecurring
          ? parseInt(formData.recurrenceInterval)
          : undefined,
      });

      toast({ title: "Success", description: "Task created successfully" });
      router.push(returnTo);
    } catch {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={returnTo}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card className="tasks-panel rounded-3xl border-border/75">
        <CardHeader>
          <CardTitle className="text-xl tracking-[-0.02em]">Create New Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What needs to be done?"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((template) => (
                <Button
                  key={template}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-border/65 bg-background/65 hover:border-primary/35"
                  onClick={() => setFormData({ ...formData, title: template })}
                >
                  {template}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assignee">Assign To</Label>
                <Select
                  value={formData.assignedToId}
                  onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {familyData?.data.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
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
                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="ghost" size="xs" className="rounded-full border border-border/60 bg-background/60" onClick={() => applyDuePreset("today")}>
                    Today
                  </Button>
                  <Button type="button" variant="ghost" size="xs" className="rounded-full border border-border/60 bg-background/60" onClick={() => applyDuePreset("tomorrow")}>
                    Tomorrow
                  </Button>
                  <Button type="button" variant="ghost" size="xs" className="rounded-full border border-border/60 bg-background/60" onClick={() => applyDuePreset("next_week")}>
                    Next week
                  </Button>
                </div>
              </div>
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={() => setShowMore(!showMore)} className="gap-1">
              {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showMore ? "Less options" : "More options"}
            </Button>

            {showMore && (
            <>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add more details..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={formData.themeId}
                  onValueChange={(value) => setFormData({ ...formData, themeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {themesData?.data.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        {theme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsData?.data.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="recurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isRecurring: Boolean(checked) })
                  }
                />
                <Label htmlFor="recurring">Recurring Task</Label>
              </div>

              {formData.isRecurring && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceType">Repeat</Label>
                    <Select
                      value={formData.recurrenceType}
                      onValueChange={(value) => setFormData({ ...formData, recurrenceType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recurrenceInterval">Every</Label>
                    <Select
                      value={formData.recurrenceInterval}
                      onValueChange={(value) => setFormData({ ...formData, recurrenceInterval: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select interval" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((value) => (
                          <SelectItem key={value} value={value.toString()}>
                            {value} {formData.recurrenceType || "times"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
            </>
            )}

            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm shadow-[inset_0_1px_0_hsl(var(--background)/0.92)]">
              <p className="font-medium">
                {formData.title.trim() || "Untitled task"}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  Assignee:{" "}
                  {familyData?.data.find((m) => m.id === formData.assignedToId)?.firstName || "Unassigned"}
                </span>
                <span>Priority: {formData.priority === "2" ? "Urgent" : formData.priority === "1" ? "High" : "Normal"}</span>
                <span>Due: {formData.dueDate || "No due date"}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push(returnTo)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
