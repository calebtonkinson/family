"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import Link from "next/link";
import { useTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useComments, useCreateComment, useDeleteComment } from "@/hooks/use-comments";
import { useConversation } from "@/hooks/use-conversations";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Calendar,
  AlertCircle,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  User,
  FolderKanban,
  Palette,
  MessageSquare,
  Send,
  MoreHorizontal,
  Bot,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ToolResult,
  ConversationMessage,
  FamilyMember,
} from "@/lib/api-client";
import {
  ToolInvocationCard,
  type ChatToolInvocation,
} from "@/components/chat/tool-invocation-card";

interface TaskPageProps {
  params: Promise<{ id: string }>;
}

interface MentionOption {
  id: string;
  type: "member" | "ai";
  label: string;
  handle: string;
  familyMemberId?: string;
}

interface MentionContext {
  query: string;
  start: number;
  end: number;
}

function createMentionHandle(rawValue: string): string {
  const normalized = rawValue
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "member";
}

function buildMentionOptions(members: FamilyMember[]): MentionOption[] {
  const usedHandles = new Set<string>(["ai"]);
  const memberOptions = members
    .map((member) => {
      const label = `${member.firstName} ${member.lastName ?? ""}`.trim();
      const baseHandle = createMentionHandle(label || member.firstName || member.id);
      let handle = baseHandle;
      let suffix = 1;
      while (usedHandles.has(handle)) {
        handle = `${baseHandle}-${suffix}`;
        suffix += 1;
      }
      usedHandles.add(handle);

      return {
        id: member.id,
        type: "member" as const,
        label,
        handle,
        familyMemberId: member.id,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return [
    {
      id: "ai-assistant",
      type: "ai",
      label: "AI Assistant",
      handle: "ai",
    },
    ...memberOptions,
  ];
}

function getMentionContext(content: string, caretPosition: number | null): MentionContext | null {
  if (caretPosition === null) return null;
  const textBeforeCaret = content.slice(0, caretPosition);
  const mentionMatch = textBeforeCaret.match(/(?:^|\s)@([a-z0-9._-]*)$/i);
  if (!mentionMatch) return null;

  const query = mentionMatch[1] ?? "";
  return {
    query: query.toLowerCase(),
    start: caretPosition - query.length - 1,
    end: caretPosition,
  };
}

function extractMentionTargets(content: string, options: MentionOption[]) {
  const mentionMatches = content.match(/@([a-z0-9._-]+)/gi) ?? [];
  const mentionedHandles = new Set(
    mentionMatches.map((match) => match.slice(1).toLowerCase()),
  );

  const mentionedFamilyMemberIds = new Set<string>();
  let hasAiMention = mentionedHandles.has("ai");

  for (const option of options) {
    if (!mentionedHandles.has(option.handle.toLowerCase())) continue;
    if (option.type === "ai") {
      hasAiMention = true;
      continue;
    }
    if (option.familyMemberId) {
      mentionedFamilyMemberIds.add(option.familyMemberId);
    }
  }

  return {
    mentionedFamilyMemberIds: Array.from(mentionedFamilyMemberIds),
    hasAiMention,
  };
}

export default function TaskPage({ params }: TaskPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("from") || "/tasks";
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProcessingStartTime, setAiProcessingStartTime] = useState<number | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { data: taskData, isLoading, error } = useTask(id);
  // Poll for comments when AI is processing
  const { data: commentsData, isLoading: commentsLoading } = useComments(id, {
    pollingInterval: isAiProcessing ? 2000 : undefined,
  });
  const { data: conversationData, isLoading: conversationLoading } = useConversation(selectedConversationId || "");
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const { data: themesData } = useThemes();
  const { data: projectsData } = useProjects();
  const { data: familyData } = useFamilyMembers();
  const mentionOptions = useMemo(
    () => buildMentionOptions(familyData?.data ?? []),
    [familyData?.data],
  );
  const mentionSuggestions = useMemo(() => {
    if (!mentionContext) return [];
    const query = mentionContext.query.trim();
    const filtered = query
      ? mentionOptions.filter((option) => {
          const handle = option.handle.toLowerCase();
          const label = option.label.toLowerCase();
          return handle.includes(query) || label.includes(query);
        })
      : mentionOptions;

    return filtered.slice(0, 8);
  }, [mentionContext, mentionOptions]);
  const isMentionMenuOpen = mentionContext !== null && mentionSuggestions.length > 0;

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionContext?.query]);

  useEffect(() => {
    if (activeMentionIndex >= mentionSuggestions.length) {
      setActiveMentionIndex(0);
    }
  }, [activeMentionIndex, mentionSuggestions.length]);
  
  // Stop polling when we get a real AI response (not the "On it!" acknowledgment)
  useEffect(() => {
    if (isAiProcessing && aiProcessingStartTime && commentsData?.data) {
      // Look for an AI comment that:
      // 1. Was created after we started processing
      // 2. Is NOT the acknowledgment message
      const hasRealAiResponse = commentsData.data.some(
        (c) => c.isAiGenerated && 
          new Date(c.createdAt).getTime() > aiProcessingStartTime &&
          !c.content.includes("On it! Let me look into that")
      );
      if (hasRealAiResponse) {
        setIsAiProcessing(false);
        setAiProcessingStartTime(null);
      }
    }
  }, [commentsData, isAiProcessing, aiProcessingStartTime]);

  const task = taskData?.data;
  const comments = commentsData?.data || [];

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
    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }

    try {
      await updateTask.mutateAsync({
        id,
        data: {
          title: formData.title,
          description: formData.description || undefined,
          themeId: formData.themeId || undefined,
          projectId: formData.projectId || undefined,
          assignedToId: formData.assignedToId || undefined,
          dueDate: formData.dueDate || undefined,
          priority: parseInt(formData.priority),
          status: formData.status as "todo" | "in_progress" | "done" | "archived",
          isRecurring: formData.isRecurring,
          recurrenceType: formData.isRecurring && formData.recurrenceType
            ? formData.recurrenceType as "daily" | "weekly" | "monthly" | "yearly"
            : undefined,
          recurrenceInterval: formData.isRecurring
            ? parseInt(formData.recurrenceInterval)
            : undefined,
        },
      });

      toast({ title: "Success", description: "Task updated successfully" });
      setIsEditing(false);
    } catch {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask.mutateAsync(id);
      toast({ title: "Success", description: "Task deleted" });
      router.push("/tasks");
    } catch {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    const { mentionedFamilyMemberIds, hasAiMention } = extractMentionTargets(
      newComment,
      mentionOptions,
    );

    try {
      await createComment.mutateAsync({
        taskId: id,
        content: newComment,
        mentionedFamilyMemberIds,
      });
      setNewComment("");
      setMentionContext(null);
      
      // Start polling for AI response
      if (hasAiMention) {
        setAiProcessingStartTime(Date.now());
        setIsAiProcessing(true);
      }
    } catch {
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync({ taskId: id, commentId });
    } catch {
      toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" });
    }
  };

  const updateMentionContext = (content: string, caretPosition: number | null) => {
    const nextContext = getMentionContext(content, caretPosition);
    setMentionContext(nextContext);
  };

  const insertMention = (option: MentionOption) => {
    if (!mentionContext) return;
    const beforeMention = newComment.slice(0, mentionContext.start);
    const afterMention = newComment.slice(mentionContext.end);
    const insertion = `@${option.handle} `;
    const nextComment = `${beforeMention}${insertion}${afterMention}`;
    setNewComment(nextComment);
    setMentionContext(null);

    requestAnimationFrame(() => {
      const textarea = commentInputRef.current;
      if (!textarea) return;
      const nextCaretPosition = beforeMention.length + insertion.length;
      textarea.focus();
      textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Tasks
            </Link>
          </Button>
        </div>
        <div className="space-y-3">
          <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Tasks
            </Link>
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-semibold">Task Not Found</h2>
          <p className="text-sm text-muted-foreground">
            This task doesn&apos;t exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && task.status !== "done";
  const isDueToday = dueDate && isToday(dueDate);

  const getDueDateLabel = () => {
    if (!dueDate) return null;
    if (isToday(dueDate)) return "Today";
    if (isTomorrow(dueDate)) return "Tomorrow";
    return format(dueDate, "MMM d, yyyy");
  };

  const getPriorityBadge = () => {
    if (task.priority === 2) return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
    if (task.priority === 1) return <Badge variant="warning" className="text-xs">High</Badge>;
    return null;
  };

  const assigneeInitials = task.assignedTo
    ? `${task.assignedTo.firstName[0]}${task.assignedTo.lastName?.[0] || ""}`
    : null;

  if (isEditing) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="gap-1.5 px-2">
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateTask.isPending}>
            <Check className="mr-1.5 h-4 w-4" />
            {updateTask.isPending ? "Saving..." : "Save"}
          </Button>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="What needs to be done?"
              className="text-lg font-medium"
            />
          </div>

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

          <div className="grid gap-3 sm:grid-cols-2">
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

          <div className="grid gap-3 sm:grid-cols-2">
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

          <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="grid gap-3 sm:grid-cols-2">
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
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            Tasks
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5 px-2">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Task</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this task? This action cannot be undone.
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
        </div>
      </div>

      {/* Task Content */}
      <div className="space-y-5">
        {/* Title & Status */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className={cn(
              "text-xl font-semibold leading-tight",
              task.status === "done" && "line-through text-muted-foreground"
            )}>
              {task.title}
              {task.isRecurring && (
                <RefreshCw className="ml-2 inline h-4 w-4 text-muted-foreground" />
              )}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Created {format(new Date(task.createdAt), "MMM d, yyyy")}</span>
              {task.lastCompletedAt && (
                <>
                  <span>·</span>
                  <span>Last done {formatDistanceToNow(new Date(task.lastCompletedAt), { addSuffix: true })}</span>
                </>
              )}
              {getPriorityBadge() && (
                <>
                  <span>·</span>
                  {getPriorityBadge()}
                </>
              )}
            </div>
          </div>
          <Select
            value={task.status}
            onValueChange={async (value) => {
              try {
                await updateTask.mutateAsync({
                  id,
                  data: { status: value as "todo" | "in_progress" | "done" | "archived" },
                });
              } catch {
                toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
              }
            }}
            disabled={updateTask.isPending}
          >
            <SelectTrigger className="h-7 w-auto gap-1.5 text-xs font-medium shrink-0">
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

        {/* Description */}
        {task.description && (
          <p className="text-muted-foreground whitespace-pre-wrap">
            {task.description}
          </p>
        )}

        {/* Details Grid */}
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {dueDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className={cn(
                "h-4 w-4",
                isOverdue ? "text-destructive" : "text-muted-foreground"
              )} />
              <span className="text-muted-foreground">Due:</span>
              <span className={cn(
                "font-medium",
                isOverdue && "text-destructive",
                isDueToday && "text-primary"
              )}>
                {isOverdue && <AlertCircle className="mr-1 inline h-3 w-3" />}
                {getDueDateLabel()}
              </span>
            </div>
          )}

          {task.assignedTo && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Assigned:</span>
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">{assigneeInitials}</AvatarFallback>
                </Avatar>
                <span className="font-medium">
                  {task.assignedTo.firstName}
                </span>
              </div>
            </div>
          )}

          {task.theme && (
            <div className="flex items-center gap-2 text-sm">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Theme:</span>
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: task.theme.color || undefined }}
              >
                {task.theme.name}
              </Badge>
            </div>
          )}

          {task.project && (
            <div className="flex items-center gap-2 text-sm">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Project:</span>
              <span className="font-medium">{task.project.name}</span>
            </div>
          )}

          {task.isRecurring && (
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Repeats:</span>
              <span className="font-medium">
                Every {task.recurrenceInterval} {task.recurrenceType}
                {task.recurrenceInterval && task.recurrenceInterval > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="border-t pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">
                Comments {comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
              </h2>
              {isAiProcessing && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  <span>AI is thinking...</span>
                </div>
              )}
            </div>
          </div>

          {/* Comment Input */}
          <div className="space-y-2 mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={(e) => {
                    const content = e.target.value;
                    setNewComment(content);
                    updateMentionContext(content, e.target.selectionStart);
                  }}
                  onClick={(e) => {
                    updateMentionContext(e.currentTarget.value, e.currentTarget.selectionStart);
                  }}
                  onKeyUp={(e) => {
                    updateMentionContext(e.currentTarget.value, e.currentTarget.selectionStart);
                  }}
                  placeholder="Add a comment... (type @ to mention AI or family)"
                  rows={2}
                  className="flex-1 resize-none text-sm"
                  onKeyDown={(e) => {
                    if (isMentionMenuOpen) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveMentionIndex((prev) =>
                          prev + 1 >= mentionSuggestions.length ? 0 : prev + 1,
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveMentionIndex((prev) =>
                          prev - 1 < 0 ? mentionSuggestions.length - 1 : prev - 1,
                        );
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        const selectedMention = mentionSuggestions[activeMentionIndex];
                        if (selectedMention) {
                          insertMention(selectedMention);
                        }
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setMentionContext(null);
                        return;
                      }
                    }

                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                {isMentionMenuOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
                    <div className="max-h-48 overflow-y-auto p-1">
                      {mentionSuggestions.map((option, index) => (
                        <button
                          type="button"
                          key={option.id}
                          className={cn(
                            "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
                            index === activeMentionIndex
                              ? "bg-muted"
                              : "hover:bg-muted/60",
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertMention(option);
                          }}
                        >
                          <span className="flex items-center gap-2">
                            {option.type === "ai" ? (
                              <Bot className="h-4 w-4 text-primary" />
                            ) : (
                              <User className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>{option.label}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">@{option.handle}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 self-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const nextComment = newComment.trim() ? `${newComment} @ai ` : "@ai ";
                    setNewComment(nextComment);
                    setMentionContext(null);
                    requestAnimationFrame(() => {
                      const textarea = commentInputRef.current;
                      if (!textarea) return;
                      textarea.focus();
                      textarea.setSelectionRange(nextComment.length, nextComment.length);
                    });
                  }}
                  className="gap-1"
                  title="Ask AI for help"
                >
                  <Bot className="h-4 w-4" />
                  Ask AI
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || createComment.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Comments List */}
          {commentsLoading ? (
            <div className="space-y-3">
              <div className="h-12 animate-pulse rounded bg-muted" />
              <div className="h-12 animate-pulse rounded bg-muted" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No comments yet
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div 
                  key={comment.id} 
                  className={cn(
                    "group flex gap-2.5 rounded-lg p-2 -mx-2",
                    comment.isAiGenerated && "bg-primary/5 border border-primary/10"
                  )}
                >
                  {comment.isAiGenerated ? (
                    <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {comment.user ? `${comment.user.firstName[0]}${comment.user.lastName?.[0] || ""}` : "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium",
                        comment.isAiGenerated && "text-primary"
                      )}>
                        {comment.isAiGenerated ? "AI Assistant" : (comment.user?.firstName || "Unknown")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 md:opacity-0 md:group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className={cn(
                      "text-sm prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                      "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5",
                      "prose-headings:mt-2 prose-headings:mb-1 prose-headings:font-semibold prose-headings:break-words prose-headings:[overflow-wrap:anywhere]",
                      "prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:[overflow-wrap:anywhere] prose-pre:bg-muted prose-pre:text-foreground",
                      "prose-code:text-foreground [&_p]:break-words [&_li]:break-words [&_a]:break-all [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-all [&_pre_code]:[overflow-wrap:anywhere]",
                      comment.isAiGenerated ? "text-foreground" : "text-muted-foreground"
                    )}>
                      <ReactMarkdown>{comment.content}</ReactMarkdown>
                    </div>
                    {comment.isAiGenerated && comment.conversationId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 px-2 text-xs text-muted-foreground hover:text-primary gap-1"
                        onClick={() => setSelectedConversationId(comment.conversationId!)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View AI Thread
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Conversation Thread Sheet */}
      <Sheet open={!!selectedConversationId} onOpenChange={(open) => !open && setSelectedConversationId(null)}>
        <SheetContent side="right" className="flex min-w-0 w-full flex-col overflow-hidden sm:max-w-lg">
          <SheetHeader className="shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Research Thread
            </SheetTitle>
            <SheetDescription>
              {conversationData?.data?.title || "View the AI's research and reasoning"}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="mt-4 min-w-0 flex-1 -mx-6 px-6">
            {conversationLoading ? (
              <div className="space-y-4">
                <div className="h-20 animate-pulse rounded bg-muted" />
                <div className="h-32 animate-pulse rounded bg-muted" />
              </div>
            ) : conversationData?.data ? (
              <ConversationThread 
                messages={conversationData.data.messages} 
                toolResults={conversationData.data.toolResults || {}}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No conversation data available
              </p>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Component to render a conversation thread
function ConversationThread({ 
  messages, 
  toolResults 
}: { 
  messages: ConversationMessage[];
  toolResults: Record<string, ToolResult>;
}) {
  return (
    <div className="min-w-0 space-y-4 pb-6">
      {messages.map((message) => (
        <div key={message.id} className="min-w-0 space-y-2">
          {/* Message content */}
          {message.content && (
            <div className={cn(
              "w-full min-w-0 overflow-x-hidden rounded-lg p-3 break-words",
              message.role === "user" 
                ? "bg-muted ml-8" 
                : "bg-primary/5 border border-primary/10"
            )}>
              <div className="flex items-center gap-2 mb-1.5">
                {message.role === "user" ? (
                  <User className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-primary" />
                )}
                <span className="text-xs font-medium">
                  {message.role === "user" ? "You" : "AI Assistant"}
                </span>
              </div>
              <div className={cn(
                "text-sm prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5",
                "prose-headings:mt-2 prose-headings:mb-1 prose-headings:break-words prose-headings:[overflow-wrap:anywhere]",
                "prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:[overflow-wrap:anywhere] prose-pre:bg-muted prose-pre:text-foreground",
                "prose-code:text-foreground [&_p]:break-words [&_li]:break-words [&_a]:break-all [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-all [&_pre_code]:[overflow-wrap:anywhere]"
              )}>
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Tool calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="ml-4 min-w-0 space-y-2">
              {message.toolCalls.map((toolCall, idx) => {
                const result = toolResults[toolCall.toolCallId];
                const errorText =
                  result?.isError
                    ? typeof result.result === "string"
                      ? result.result
                      : JSON.stringify(result.result, null, 2)
                    : undefined;
                const toolState = result
                  ? result.isError
                    ? "output-error"
                    : "output-available"
                  : "input-available";

                const normalizedTool: ChatToolInvocation = {
                  id: toolCall.toolCallId || `${message.id}-tool-${idx}`,
                  toolName: toolCall.toolName,
                  state: toolState,
                  input: toolCall.toolInput,
                  output: result?.result,
                  errorText,
                };
                
                return (
                  <ToolInvocationCard
                    key={toolCall.id}
                    tool={normalizedTool}
                    className="w-full max-w-full"
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
