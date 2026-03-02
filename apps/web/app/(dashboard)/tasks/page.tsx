"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  format,
  subDays,
  addDays,
  addWeeks,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  differenceInCalendarDays,
  isPast,
  isToday,
} from "date-fns";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useThemes } from "@/hooks/use-themes";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { TaskList } from "@/components/tasks/task-list";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  CheckSquare,
  Trash2,
  X,
  Bell,
  LayoutList,
  Columns3,
  SlidersHorizontal,
  Rocket,
  Clock3,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  canSendNotifications,
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
} from "@/lib/pwa";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "workflow";

function TasksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string>(() => searchParams.get("status") || "todo");
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    searchParams.get("view") === "workflow" ? "workflow" : "list",
  );
  const [themeId, setThemeId] = useState<string>(() => searchParams.get("themeId") || "all");
  const [assigneeId, setAssigneeId] = useState<string>(() => searchParams.get("assigneeId") || "all");
  const [priority, setPriority] = useState<string>(() => searchParams.get("priority") || "all");
  const [dueFilter, setDueFilter] = useState<string>(() => searchParams.get("due") || "all");
  const [recurring, setRecurring] = useState<string>(() => searchParams.get("recurring") || "all");
  const [hasDescription, setHasDescription] = useState<boolean>(() => searchParams.get("hasDesc") === "1");
  const [search, setSearch] = useState("");
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddAssigneeId, setQuickAddAssigneeId] = useState<string>("none");
  const [quickAddPriority, setQuickAddPriority] = useState<string>("0");
  const [quickAddDueDate, setQuickAddDueDate] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [testNotificationLoading, setTestNotificationLoading] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  const effectiveStatus = viewMode === "workflow" ? "all" : status;

  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "todo") params.set("status", status);
    if (viewMode === "workflow") params.set("view", viewMode);
    if (themeId !== "all") params.set("themeId", themeId);
    if (assigneeId !== "all") params.set("assigneeId", assigneeId);
    if (priority !== "all") params.set("priority", priority);
    if (dueFilter !== "all") params.set("due", dueFilter);
    if (recurring !== "all") params.set("recurring", recurring);
    if (hasDescription) params.set("hasDesc", "1");
    const q = params.toString();
    if (window.history.replaceState) {
      window.history.replaceState(null, "", q ? `/tasks?${q}` : "/tasks");
    }
  }, [status, viewMode, themeId, assigneeId, priority, dueFilter, recurring, hasDescription]);

  useEffect(() => {
    if (viewMode !== "workflow" || !selectMode) return;
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [viewMode, selectMode]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotificationsReady(canSendNotifications());
  }, []);

  const dueParams = useMemo(() => {
    if (dueFilter === "overdue") {
      return { dueBefore: format(subDays(new Date(), 1), "yyyy-MM-dd") };
    }
    if (dueFilter === "today") {
      const d = new Date();
      return {
        dueAfter: format(startOfDay(d), "yyyy-MM-dd"),
        dueBefore: format(endOfDay(d), "yyyy-MM-dd"),
      };
    }
    if (dueFilter === "week") {
      const d = new Date();
      return {
        dueAfter: format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        dueBefore: format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    return {};
  }, [dueFilter]);

  const { data: tasksData, isLoading } = useTasks({
    status: effectiveStatus === "all" ? undefined : effectiveStatus,
    themeId: themeId === "all" ? undefined : themeId,
    assignedToId: assigneeId === "all" ? undefined : assigneeId,
    ...dueParams,
    isRecurring: recurring === "all" ? undefined : recurring === "yes",
  });

  const countParams = useMemo(() => ({
    themeId: themeId === "all" ? undefined : themeId,
    assignedToId: assigneeId === "all" ? undefined : assigneeId,
    ...dueParams,
    isRecurring: recurring === "all" ? undefined : recurring === "yes",
    limit: 1,
  }), [themeId, assigneeId, dueParams, recurring]);

  const { data: statsTasksData } = useTasks({
    ...countParams,
    limit: 250,
  });
  const { data: countsData } = useTasks({ ...countParams });
  const { data: todoCountData } = useTasks({ ...countParams, status: "todo" });
  const { data: inProgressCountData } = useTasks({ ...countParams, status: "in_progress" });
  const { data: doneCountData } = useTasks({ ...countParams, status: "done" });

  const { data: themesData } = useThemes();
  const { data: familyData } = useFamilyMembers();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const tasks = tasksData?.data || [];
  const themes = themesData?.data || [];
  const family = familyData?.data || [];

  const counts = useMemo(() => ({
    all: countsData?.meta?.total ?? 0,
    todo: todoCountData?.meta?.total ?? 0,
    in_progress: inProgressCountData?.meta?.total ?? 0,
    done: doneCountData?.meta?.total ?? 0,
  }), [countsData, todoCountData, inProgressCountData, doneCountData]);

  const stats = useMemo(() => {
    const statsTasks = statsTasksData?.data ?? [];
    const activeTasks = statsTasks.filter((task) => task.status !== "archived");
    const today = new Date();

    const overdue = activeTasks.filter((task) => {
      if (!task.dueDate || task.status === "done") return false;
      const due = new Date(task.dueDate);
      return isPast(due) && !isToday(due);
    });

    const dueToday = activeTasks.filter((task) => {
      if (!task.dueDate || task.status === "done") return false;
      return isToday(new Date(task.dueDate));
    });

    const done = activeTasks.filter((task) => task.status === "done").length;
    const inProgress = activeTasks.filter((task) => task.status === "in_progress").length;
    const open = activeTasks.filter((task) => task.status === "todo" || task.status === "in_progress").length;
    const completionRate = activeTasks.length > 0 ? Math.round((done / activeTasks.length) * 100) : 0;

    const averageOverdueDays = overdue.length
      ? Math.round(
          overdue.reduce((sum, task) => {
            if (!task.dueDate) return sum;
            const days = differenceInCalendarDays(today, new Date(task.dueDate));
            return sum + Math.max(days, 0);
          }, 0) / overdue.length,
        )
      : 0;

    const doneThisWeek = activeTasks.filter((task) => {
      if (task.status !== "done") return false;
      const completedAt = task.lastCompletedAt || task.updatedAt;
      if (!completedAt) return false;
      return new Date(completedAt) >= startOfWeek(today, { weekStartsOn: 1 });
    }).length;

    return {
      open,
      inProgress,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      doneThisWeek,
      completionRate,
      averageOverdueDays,
    };
  }, [statsTasksData?.data]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (!isTyping && (event.key === "/" || (event.key.toLowerCase() === "k" && event.metaKey))) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (!isTyping && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setQuickCaptureOpen(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-focus the quick-add input when the dialog opens
  useEffect(() => {
    if (quickCaptureOpen) {
      setTimeout(() => quickAddInputRef.current?.focus(), 50);
    }
  }, [quickCaptureOpen]);

  let filteredTasks = tasks;
  if (search) {
    filteredTasks = filteredTasks.filter((t) =>
      t.title.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (priority !== "all") {
    filteredTasks = filteredTasks.filter((t) => t.priority === parseInt(priority));
  }
  if (hasDescription) {
    filteredTasks = filteredTasks.filter((t) => !!t.description?.trim());
  }

  const workflowColumns = useMemo(
    () => [
      {
        id: "todo",
        title: "Backlog",
        subtitle: "Ready to pick up",
        tasks: filteredTasks.filter((task) => task.status === "todo"),
        badgeVariant: "secondary" as const,
        laneClass: "bg-[linear-gradient(180deg,hsl(var(--card)/0.94),hsl(var(--secondary)/0.26))]",
      },
      {
        id: "in_progress",
        title: "In Progress",
        subtitle: "Currently moving",
        tasks: filteredTasks.filter((task) => task.status === "in_progress"),
        badgeVariant: "info" as const,
        laneClass: "bg-[linear-gradient(180deg,hsl(var(--card)/0.94),hsl(var(--info)/0.18))]",
      },
      {
        id: "done",
        title: "Done",
        subtitle: "Completed recently",
        tasks: filteredTasks.filter((task) => task.status === "done"),
        badgeVariant: "success" as const,
        laneClass: "bg-[linear-gradient(180deg,hsl(var(--card)/0.94),hsl(var(--success)/0.16))]",
      },
    ],
    [filteredTasks],
  );

  const handleQuickAdd = useCallback(async () => {
    const title = quickAddTitle.trim();
    if (!title) return;
    try {
      await createTask.mutateAsync({
        title,
        assignedToId: quickAddAssigneeId === "none" ? undefined : quickAddAssigneeId,
        priority: Number(quickAddPriority),
        dueDate: quickAddDueDate || undefined,
      });
      setQuickAddTitle("");
      setQuickAddDueDate("");
      setQuickCaptureOpen(false);
      toast({ title: "Task created" });
    } catch {
      toast({ title: "Failed to create task", variant: "destructive" });
    }
  }, [quickAddTitle, quickAddAssigneeId, quickAddPriority, quickAddDueDate, createTask]);

  const applyQuickDuePreset = (preset: "today" | "tomorrow" | "next_week") => {
    const today = new Date();
    if (preset === "today") {
      setQuickAddDueDate(format(today, "yyyy-MM-dd"));
      return;
    }
    if (preset === "tomorrow") {
      setQuickAddDueDate(format(addDays(today, 1), "yyyy-MM-dd"));
      return;
    }
    setQuickAddDueDate(format(addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1), "yyyy-MM-dd"));
  };

  const handleBulkComplete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const results = await Promise.allSettled(
      ids.map((id) =>
        updateTask.mutateAsync({ id, data: { status: "done" }, invalidate: false }),
      ),
    );

    const failedIds = results
      .map((result, index) => ({ result, id: ids[index] }))
      .filter((item) => item.result.status === "rejected")
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string");
    const successCount = ids.length - failedIds.length;

    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: `${successCount} task(s) completed` });
    }
    if (failedIds.length > 0) {
      toast({
        title: `${failedIds.length} task(s) failed to complete`,
        variant: "destructive",
      });
    }

    if (failedIds.length === 0) {
      setSelectedIds(new Set());
      setSelectMode(false);
    } else {
      setSelectedIds(new Set(failedIds));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} task(s)?`)) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const results = await Promise.allSettled(
      ids.map((id) => deleteTask.mutateAsync({ id, invalidate: false })),
    );

    const failedIds = results
      .map((result, index) => ({ result, id: ids[index] }))
      .filter((item) => item.result.status === "rejected")
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string");
    const successCount = ids.length - failedIds.length;

    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: `${successCount} task(s) deleted` });
    }
    if (failedIds.length > 0) {
      toast({
        title: `${failedIds.length} task(s) failed to delete`,
        variant: "destructive",
      });
    }

    if (failedIds.length === 0) {
      setSelectedIds(new Set());
      setSelectMode(false);
    } else {
      setSelectedIds(new Set(failedIds));
    }
  };

  const handleEnableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast({
        title: "Notifications unavailable",
        description: "This browser does not support notifications.",
        variant: "destructive",
      });
      return;
    }

    setNotificationLoading(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        toast({
          title: "Permission not granted",
          description: "Enable notifications in browser settings to receive task alerts.",
          variant: "destructive",
        });
        return;
      }

      const registration = await registerServiceWorker();
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!registration || !vapidKey) {
        setNotificationsReady(true);
        toast({
          title: "Notifications enabled",
          description: "Browser permission is granted. Push subscription will activate when configured.",
        });
        return;
      }

      const subscription = await subscribeToPush(registration, vapidKey);
      if (subscription) {
        await apiClient.subscribeToPush(subscription.toJSON());
      }

      setNotificationsReady(true);
      toast({
        title: "Task notifications enabled",
        description: "You will now get alerts for assignments and important updates.",
      });
    } catch {
      toast({
        title: "Failed to enable notifications",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestNotificationLoading(true);
    try {
      const result = await apiClient.sendTestNotification();
      toast({
        title: "Test notification sent",
        description: `Delivered to ${result.sent}/${result.total} subscribed devices.`,
      });
    } catch {
      toast({
        title: "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setTestNotificationLoading(false);
    }
  };

  const clearAllFilters = () => {
    setThemeId("all");
    setAssigneeId("all");
    setPriority("all");
    setDueFilter("all");
    setRecurring("all");
    setHasDescription(false);
    setSearch("");
  };

  const activeFiltersCount = [themeId, assigneeId, priority, dueFilter, recurring]
    .filter((f) => f !== "all").length + (hasDescription ? 1 : 0) + (search.trim() ? 1 : 0);
  const noTasksWithCurrentFilters = !isLoading && filteredTasks.length === 0;
  const quickTemplates = [
    "Take out trash",
    "Prep tomorrow lunch",
    "Laundry reset",
    "Kitchen reset",
    "Pay utility bill",
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative space-y-3 pb-6">
        {/* ── Row 1: Title + inline stats ── */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Tasks</h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <Rocket className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-foreground">{stats.open}</span> open
                </span>
              </TooltipTrigger>
              <TooltipContent>{stats.inProgress} in progress</TooltipContent>
            </Tooltip>
            <span className="text-border">·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5 text-info" />
                  <span className="font-semibold text-foreground">{stats.dueTodayCount}</span> due today
                </span>
              </TooltipTrigger>
              <TooltipContent>{stats.dueTodayCount > 0 ? "Time to focus" : "You're clear"}</TooltipContent>
            </Tooltip>
            <span className="text-border">·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("flex items-center gap-1", stats.overdueCount > 0 && "text-destructive")}>
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="font-semibold text-foreground">{stats.overdueCount}</span> overdue
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {stats.overdueCount > 0
                  ? `Avg ${stats.averageOverdueDays} day${stats.averageOverdueDays === 1 ? "" : "s"} late`
                  : "No overdue tasks"}
              </TooltipContent>
            </Tooltip>
            <span className="text-border">·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-success" />
                  <span className="font-semibold text-foreground">{stats.doneThisWeek}</span> done this week
                </span>
              </TooltipTrigger>
              <TooltipContent>{stats.completionRate}% completion rate</TooltipContent>
            </Tooltip>
            <span className="hidden text-border sm:inline">·</span>
            <div className="hidden items-center gap-2 sm:flex">
              <Progress value={stats.completionRate} className="h-1.5 w-16" />
              <span className="text-[11px] font-medium">{stats.completionRate}%</span>
            </div>
          </div>
        </div>

        {/* ── Row 2: Search + Filters + Actions ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search tasks…  ( / )"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-border/70 bg-background/70 pl-9 text-sm"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 px-1.5 text-[10px]">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3" align="end">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Filters</span>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAllFilters}>
                    Reset all
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Select value={themeId} onValueChange={setThemeId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All themes</SelectItem>
                    {themes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>{theme.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assignees</SelectItem>
                    {family.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.firstName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="0">Normal</SelectItem>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Urgent</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dueFilter} onValueChange={setDueFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Due date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any date</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This week</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={recurring} onValueChange={setRecurring}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Recurring" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Recurring</SelectItem>
                    <SelectItem value="no">One-time</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant={hasDescription ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-full text-xs"
                  onClick={() => setHasDescription(!hasDescription)}
                >
                  Has description
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setQuickCaptureOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Task</span>
            <kbd className="ml-1 hidden rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground/70 sm:inline">
              N
            </kbd>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setSelectMode(!selectMode)}
            disabled={viewMode === "workflow"}
          >
            <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
            {selectMode ? "Exit" : "Select"}
          </Button>

          {notificationsReady ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={handleSendTestNotification}
              disabled={testNotificationLoading}
            >
              <Bell className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={handleEnableNotifications}
              disabled={notificationLoading}
            >
              <Bell className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* ── Row 3: Status tabs + View toggle ── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {viewMode === "list" ? (
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList className="h-9 rounded-xl border border-border/70 bg-card/70 p-0.5 shadow-[inset_0_1px_0_hsl(var(--background)/0.8)]">
                <TabsTrigger className="rounded-lg px-2.5 text-xs" value="all">
                  All{counts.all > 0 && <Badge variant="secondary" className="ml-1 scale-90">{counts.all}</Badge>}
                </TabsTrigger>
                <TabsTrigger className="rounded-lg px-2.5 text-xs" value="todo">
                  To Do{counts.todo > 0 && <Badge variant="secondary" className="ml-1 scale-90">{counts.todo}</Badge>}
                </TabsTrigger>
                <TabsTrigger className="rounded-lg px-2.5 text-xs" value="in_progress">
                  Active{counts.in_progress > 0 && <Badge variant="info" className="ml-1 scale-90">{counts.in_progress}</Badge>}
                </TabsTrigger>
                <TabsTrigger className="rounded-lg px-2.5 text-xs" value="done">
                  Done{counts.done > 0 && <Badge variant="success" className="ml-1 scale-90">{counts.done}</Badge>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Columns3 className="h-3.5 w-3.5" />
              Workflow view — tasks grouped by status
            </div>
          )}

          <div className="flex items-center rounded-lg border border-border/70 p-0.5">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-md px-2 text-xs"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="mr-1 h-3.5 w-3.5" />
              List
            </Button>
            <Button
              variant={viewMode === "workflow" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-md px-2 text-xs"
              onClick={() => setViewMode("workflow")}
            >
              <Columns3 className="mr-1 h-3.5 w-3.5" />
              Board
            </Button>
          </div>
        </div>

        {/* ── Task list / Workflow grid ── */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <>
            {viewMode === "list" ? (
              <TaskList
                tasks={filteredTasks}
                assignees={family}
                emptyMessage={search || activeFiltersCount > 0 ? "No tasks match your filters" : "No tasks found"}
                selectable={selectMode}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                listHref={`/tasks`}
                bulkToolbar={
                  selectMode && selectedIds.size > 0 ? (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
                      <span className="text-sm font-medium">{selectedIds.size} selected</span>
                      <Button size="sm" onClick={handleBulkComplete}>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Complete
                      </Button>
                      <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedIds(new Set()); setSelectMode(false); }}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-3">
                {workflowColumns.map((column) => (
                  <section key={column.id} className={cn("tasks-lane-panel rounded-2xl p-3", column.laneClass)}>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{column.title}</h3>
                        <p className="text-xs text-muted-foreground">{column.subtitle}</p>
                      </div>
                      <Badge variant={column.badgeVariant}>{column.tasks.length}</Badge>
                    </div>
                    {column.tasks.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                        Nothing here right now.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {column.tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            assignees={family}
                            listHref={`/tasks`}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}

            {viewMode === "workflow" && noTasksWithCurrentFilters && (
              <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No matching tasks</p>
                <p className="mt-1">Adjust filters or create a fresh task to keep momentum.</p>
              </div>
            )}
          </>
        )}

        {/* ── Quick Capture Dialog ── */}
        <Dialog open={quickCaptureOpen} onOpenChange={setQuickCaptureOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Quick capture</DialogTitle>
              <DialogDescription>Add a task with smart defaults. Press Enter to save.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  ref={quickAddInputRef}
                  placeholder="What needs to be done?"
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                  className="h-10 flex-1"
                />
                <Button
                  onClick={handleQuickAdd}
                  disabled={!quickAddTitle.trim() || createTask.isPending}
                >
                  {createTask.isPending ? "Adding…" : "Add"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {quickTemplates.map((template) => (
                  <Button
                    key={template}
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="rounded-full border border-border/65 bg-background/55 text-xs hover:border-primary/35 hover:bg-primary/10"
                    onClick={() => {
                      setQuickAddTitle(template);
                      quickAddInputRef.current?.focus();
                    }}
                  >
                    {template}
                  </Button>
                ))}
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="xs" onClick={() => applyQuickDuePreset("today")}>
                    Today
                  </Button>
                  <Button type="button" variant="outline" size="xs" onClick={() => applyQuickDuePreset("tomorrow")}>
                    Tomorrow
                  </Button>
                  <Button type="button" variant="outline" size="xs" onClick={() => applyQuickDuePreset("next_week")}>
                    Next week
                  </Button>
                  <Input
                    type="date"
                    value={quickAddDueDate}
                    onChange={(e) => setQuickAddDueDate(e.target.value)}
                    className="h-7 w-[140px] text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={quickAddAssigneeId} onValueChange={setQuickAddAssigneeId}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Assign to" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {family.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.firstName} {member.lastName ?? ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={quickAddPriority} onValueChange={setQuickAddPriority}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Normal</SelectItem>
                      <SelectItem value="1">High</SelectItem>
                      <SelectItem value="2">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  );
}
