"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useThemes } from "@/hooks/use-themes";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, CheckSquare, Trash2, X } from "lucide-react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import { buildNewTaskHref } from "@/lib/task-navigation";

function TasksPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Initialize from URL
  const [status, setStatus] = useState<string>(() => searchParams.get("status") || "todo");
  const [themeId, setThemeId] = useState<string>(() => searchParams.get("themeId") || "all");
  const [assigneeId, setAssigneeId] = useState<string>(() => searchParams.get("assigneeId") || "all");
  const [priority, setPriority] = useState<string>(() => searchParams.get("priority") || "all");
  const [dueFilter, setDueFilter] = useState<string>(() => searchParams.get("due") || "all");
  const [recurring, setRecurring] = useState<string>(() => searchParams.get("recurring") || "all");
  const [hasDescription, setHasDescription] = useState<boolean>(() => searchParams.get("hasDesc") === "1");
  const [search, setSearch] = useState("");
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Sync URL with filters
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "todo") params.set("status", status);
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
  }, [status, themeId, assigneeId, priority, dueFilter, recurring, hasDescription]);

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
    status: status === "all" ? undefined : status,
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

  const handleQuickAdd = async () => {
    const title = quickAddTitle.trim();
    if (!title) return;
    try {
      await createTask.mutateAsync({ title });
      setQuickAddTitle("");
      toast({ title: "Task created" });
    } catch {
      toast({ title: "Failed to create task", variant: "destructive" });
    }
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

  const activeFiltersCount = [themeId, assigneeId, priority, dueFilter, recurring].filter((f) => f !== "all").length + (hasDescription ? 1 : 0);

  const listHref = useMemo(() => {
    const p = new URLSearchParams();
    if (status !== "todo") p.set("status", status);
    if (themeId !== "all") p.set("themeId", themeId);
    if (assigneeId !== "all") p.set("assigneeId", assigneeId);
    if (priority !== "all") p.set("priority", priority);
    if (dueFilter !== "all") p.set("due", dueFilter);
    if (recurring !== "all") p.set("recurring", recurring);
    if (hasDescription) p.set("hasDesc", "1");
    const q = p.toString();
    return q ? `/tasks?${q}` : "/tasks";
  }, [status, themeId, assigneeId, priority, dueFilter, recurring, hasDescription]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectMode(!selectMode)}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Select
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href={buildNewTaskHref({ returnTo: listHref })}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Add */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a task..."
          value={quickAddTitle}
          onChange={(e) => setQuickAddTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          className="flex-1"
        />
        <Button onClick={handleQuickAdd} disabled={!quickAddTitle.trim() || createTask.isPending}>
          Add
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={themeId} onValueChange={setThemeId}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All themes</SelectItem>
              {themes.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {family.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.firstName}</SelectItem>
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
            <SelectTrigger className="w-[120px]">
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
        </div>
      </div>

      {/* Status Tabs with counts */}
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="all">All {counts.all > 0 && <Badge variant="secondary" className="ml-1.5">{counts.all}</Badge>}</TabsTrigger>
          <TabsTrigger value="todo">To Do {counts.todo > 0 && <Badge variant="secondary" className="ml-1.5">{counts.todo}</Badge>}</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress {counts.in_progress > 0 && <Badge variant="info" className="ml-1.5">{counts.in_progress}</Badge>}</TabsTrigger>
          <TabsTrigger value="done">Done {counts.done > 0 && <Badge variant="success" className="ml-1.5">{counts.done}</Badge>}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Task List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          emptyMessage={search || activeFiltersCount > 0 ? "No tasks match your filters" : "No tasks found"}
          selectable={selectMode}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          listHref={listHref}
          bulkToolbar={
            selectMode && selectedIds.size > 0 ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 mb-2">
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
      )}

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
