"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useThemes } from "@/hooks/use-themes";
import { useProjects } from "@/hooks/use-projects";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import type { Task } from "@/lib/api-client";

interface TaskEditSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskEditSheet({ task, open, onOpenChange }: TaskEditSheetProps) {
  const updateTask = useUpdateTask();
  const { data: themesData } = useThemes();
  const { data: projectsData } = useProjects();
  const { data: familyData } = useFamilyMembers();

  const [showMore, setShowMore] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    themeId: "",
    projectId: "",
    assignedToId: "",
    dueDate: "",
    priority: "0",
    status: "todo",
    isRecurring: false,
    recurrenceType: "",
    recurrenceInterval: "1",
  });

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        themeId: task.themeId || "",
        projectId: task.projectId || "",
        assignedToId: task.assignedToId || "",
        dueDate: task.dueDate?.split("T")[0] ?? "",
        priority: String(task.priority),
        status: task.status,
        isRecurring: task.isRecurring,
        recurrenceType: task.recurrenceType || "",
        recurrenceInterval: String(task.recurrenceInterval || 1),
      });
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;

    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: {
          title: formData.title,
          description: formData.description.trim() ? formData.description : null,
          themeId: formData.themeId || null,
          projectId: formData.projectId || null,
          assignedToId: formData.assignedToId || null,
          dueDate: formData.dueDate || null,
          priority: parseInt(formData.priority),
          status: formData.status as Task["status"],
          isRecurring: formData.isRecurring,
          recurrenceType: formData.isRecurring && formData.recurrenceType
            ? (formData.recurrenceType as NonNullable<Task["recurrenceType"]>)
            : null,
          recurrenceInterval: formData.isRecurring ? parseInt(formData.recurrenceInterval) : null,
        },
      });
      toast({
        title: "Task updated",
        description: "Your changes have been saved.",
      });
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit Task</SheetTitle>
          <SheetDescription>
            Make changes to your task. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-10rem)] pr-4 mt-6">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What needs to be done?"
                className="text-base font-medium"
              />
            </div>

            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Normal</SelectItem>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assign To</Label>
                <Select
                  value={formData.assignedToId || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, assignedToId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {familyData?.data.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={() => setShowMore(!showMore)} className="gap-1 -ml-1">
              {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showMore ? "Less options" : "More options"}
            </Button>

            {showMore && (
            <>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add more details..."
                rows={3}
              />
            </div>

            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Theme</Label>
                <Select
                  value={formData.themeId || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, themeId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {themesData?.data.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        {theme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Project</Label>
                <Select
                  value={formData.projectId || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, projectId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {projectsData?.data.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="recurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isRecurring: checked as boolean })
                  }
                />
                <Label htmlFor="recurring" className="text-sm">Recurring task</Label>
              </div>

              {formData.isRecurring && (
                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Repeat</Label>
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

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Interval</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.recurrenceInterval}
                      onChange={(e) =>
                        setFormData({ ...formData, recurrenceInterval: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTask.isPending}>
                {updateTask.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
