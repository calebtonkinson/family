"use client";

import { useState, useMemo, useEffect, useRef, Suspense, type ReactNode } from "react";
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
  Plus,
  Search,
  CheckSquare,
  Trash2,
  X,
  Sparkles,
  Bell,
  Clock3,
  AlertTriangle,
  Rocket,
  LayoutList,
  Columns3,
  SlidersHorizontal,
  Command,
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import { buildNewTaskHref } from "@/lib/task-navigation";
import { apiClient } from "@/lib/api-client";
import {
  canSendNotifications,
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
} from "@/lib/pwa";

type ViewMode = "list" | "workflow";

function TasksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize from URL
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

  const effectiveStatus = viewMode === "workflow" ? "all" : status;

  // Sync URL with filters
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

  const getDueParams = () => {
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
  };

  const { data: tasksData, isLoading } = useTasks({
    status: effectiveStatus === "all" ? undefined : effectiveStatus,
    themeId: themeId === "all" ? undefined : themeId,
    assignedToId: assigneeId === "all" ? undefined : assigneeId,
    ...getDueParams(),
    isRecurring: recurring === "all" ? undefined : recurring === "yes",
  });

  const countParams = useMemo(() => ({
    themeId: themeId === "all" ? undefined : themeId,
    assignedToId: assigneeId === "all" ? undefined : assigneeId,
    ...getDueParams(),
    isRecurring: recurring === "all" ? undefined : recurring === "yes",
    limit: 1,
  }), [themeId, assigneeId, dueFilter, recurring]);

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
  const statsTasks = statsTasksData?.data || [];

  const counts = useMemo(() => ({
    all: countsData?.meta?.total ?? 0,
    todo: todoCountData?.meta?.total ?? 0,
    in_progress: inProgressCountData?.meta?.total ?? 0,
    done: doneCountData?.meta?.total ?? 0,
  }), [countsData, todoCountData, inProgressCountData, doneCountData]);

  const stats = useMemo(() => {
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
  }, [statsTasks]);

  const listHref = useMemo(() => {
    const p = new URLSearchParams();
    if (status !== "todo") p.set("status", status);
    if (viewMode === "workflow") p.set("view", viewMode);
    if (themeId !== "all") p.set("themeId", themeId);
    if (assigneeId !== "all") p.set("assigneeId", assigneeId);
    if (priority !== "all") p.set("priority", priority);
    if (dueFilter !== "all") p.set("due", dueFilter);
    if (recurring !== "all") p.set("recurring", recurring);
    if (hasDescription) p.set("hasDesc", "1");
    const q = p.toString();
    return q ? `/tasks?${q}` : "/tasks";
  }, [status, viewMode, themeId, assigneeId, priority, dueFilter, recurring, hasDescription]);

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
        router.push(buildNewTaskHref({ returnTo: listHref }));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [listHref, router]);

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
      },
      {
        id: "in_progress",
        title: "In Progress",
        subtitle: "Currently moving",
        tasks: filteredTasks.filter((task) => task.status === "in_progress"),
        badgeVariant: "info" as const,
      },
      {
        id: "done",
        title: "Done",
        subtitle: "Completed recently",
        tasks: filteredTasks.filter((task) => task.status === "done"),
        badgeVariant: "success" as const,
      },
    ],
    [filteredTasks],
  );

  const handleQuickAdd = async () => {
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
      toast({ title: "Task created" });
    } catch {
      toast({ title: "Failed to create task", variant: "destructive" });
    }
  };

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
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Crisp execution for your household. Capture fast, assign clearly, finish consistently.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectMode(!selectMode)}
                disabled={viewMode === "workflow"}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                {selectMode ? "Exit select" : "Select"}
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href={buildNewTaskHref({ returnTo: listHref })}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Task
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InsightTile
              icon={<Rocket className="h-4 w-4 text-primary" />}
              label="Open work"
              value={stats.open}
              detail={`${stats.inProgress} in progress`}
            />
            <InsightTile
              icon={<Clock3 className="h-4 w-4 text-info" />}
              label="Due today"
              value={stats.dueTodayCount}
              detail={stats.dueTodayCount > 0 ? "Time to focus" : "You are clear"}
            />
            <InsightTile
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              label="Overdue"
              value={stats.overdueCount}
              detail={
                stats.overdueCount > 0
                  ? `Avg ${stats.averageOverdueDays} day${stats.averageOverdueDays === 1 ? "" : "s"} late`
                  : "No overdue tasks"
              }
            />
            <InsightTile
              icon={<Sparkles className="h-4 w-4 text-success" />}
              label="Completed this week"
              value={stats.doneThisWeek}
              detail={`${stats.completionRate}% completion`}
            />
          </div>

          <div className="mt-4 rounded-xl border bg-background/70 p-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Household execution score</span>
              <span>{stats.completionRate}%</span>
            </div>
            <Progress value={stats.completionRate} className="h-2.5" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Quick capture</h2>
            <p className="text-xs text-muted-foreground">
              One-line add with smart defaults. Press <span className="font-medium">Enter</span> to save.
            </p>
          </div>
          <Badge variant="accent" className="gap-1 text-[11px]">
            <Command className="h-3 w-3" />
            N = new task
          </Badge>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Add a task..."
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
            className="flex-1"
          />
          <Button
            onClick={handleQuickAdd}
            disabled={!quickAddTitle.trim() || createTask.isPending}
            className="sm:min-w-[120px]"
          >
            {createTask.isPending ? "Adding..." : "Add task"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickTemplates.map((template) => (
            <Button
              key={template}
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setQuickAddTitle(template)}
            >
              {template}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="xs" onClick={() => applyQuickDuePreset("today")}>
              Today
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => applyQuickDuePreset("tomorrow")}>
              Tomorrow
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => applyQuickDuePreset("next_week")}>
              Next week
            </Button>
          </div>
          <Input
            type="date"
            value={quickAddDueDate}
            onChange={(e) => setQuickAddDueDate(e.target.value)}
            className="h-8 w-[160px]"
          />
          <Select value={quickAddAssigneeId} onValueChange={setQuickAddAssigneeId}>
            <SelectTrigger className="h-8 w-[170px]">
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
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Normal</SelectItem>
              <SelectItem value="1">High</SelectItem>
              <SelectItem value="2">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Filters & view</h2>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="text-[11px]">
                {activeFiltersCount} active
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="mr-1 h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === "workflow" ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setViewMode("workflow")}
            >
              <Columns3 className="mr-1 h-4 w-4" />
              Workflow
            </Button>
            {notificationsReady ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleSendTestNotification}
                disabled={testNotificationLoading}
              >
                <Bell className="mr-1 h-4 w-4" />
                {testNotificationLoading ? "Sending..." : "Test alert"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleEnableNotifications}
                disabled={notificationLoading}
              >
                <Bell className="mr-1 h-4 w-4" />
                {notificationLoading ? "Enabling..." : "Enable alerts"}
              </Button>
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search tasks... (press / to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={themeId} onValueChange={setThemeId}>
            <SelectTrigger className="w-[150px]">
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
            <SelectTrigger className="w-[150px]">
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
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="0">Normal</SelectItem>
              <SelectItem value="1">High</SelectItem>
              <SelectItem value="2">Urgent</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dueFilter} onValueChange={setDueFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Due" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
            </SelectContent>
          </Select>

          <Select value={recurring} onValueChange={setRecurring}>
            <SelectTrigger className="w-[130px]">
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
            onClick={() => setHasDescription(!hasDescription)}
          >
            Has description
          </Button>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Reset filters
            </Button>
          )}
        </div>
      </section>

      {/* Status Tabs with counts */}
      {viewMode === "list" ? (
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="all">All {counts.all > 0 && <Badge variant="secondary" className="ml-1.5">{counts.all}</Badge>}</TabsTrigger>
            <TabsTrigger value="todo">To Do {counts.todo > 0 && <Badge variant="secondary" className="ml-1.5">{counts.todo}</Badge>}</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress {counts.in_progress > 0 && <Badge variant="info" className="ml-1.5">{counts.in_progress}</Badge>}</TabsTrigger>
            <TabsTrigger value="done">Done {counts.done > 0 && <Badge variant="success" className="ml-1.5">{counts.done}</Badge>}</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Columns3 className="h-4 w-4" />
          Workflow view groups all statuses into execution lanes.
        </div>
      )}

      {/* Task List */}
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
              listHref={listHref}
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
                <section key={column.id} className="rounded-xl border bg-card/70 p-3">
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
                          listHref={listHref}
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

    </div>
  );
}

function InsightTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border bg-background/80 px-3 py-3 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-32 animate-pulse rounded bg-muted" />
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
