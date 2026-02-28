"use client";

import { useState } from "react";
import { format, addDays, startOfWeek, addWeeks, isPast, isToday, isTomorrow } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  RefreshCw,
  MoreHorizontal,
  Circle,
  Clock,
  CheckCircle2,
  Trash2,
  Pencil,
  Calendar,
  CalendarRange,
  UserPlus,
  User,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, FamilyMember } from "@/lib/api-client";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { TaskEditSheet } from "./task-edit-sheet";

interface TaskCardProps {
  task: Task;
  showProject?: boolean;
  showTheme?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  listHref?: string;
  assignees?: FamilyMember[];
}

export function TaskCard({
  task,
  showProject = true,
  showTheme = true,
  selectable,
  selected,
  onSelectionChange,
  listHref,
  assignees = [],
}: TaskCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const taskHref = listHref ? `/tasks/${task.id}?from=${encodeURIComponent(listHref)}` : `/tasks/${task.id}`;

  const handleStatusChange = (status: Task["status"]) => {
    updateTask.mutate({ id: task.id, data: { status } });
  };

  const handleReschedule = (dueDate: string) => {
    updateTask.mutate({ id: task.id, data: { dueDate } });
  };

  const handleClearDueDate = () => {
    updateTask.mutate({ id: task.id, data: { dueDate: null } });
  };

  const handleAssign = (assignedToId: string | null) => {
    updateTask.mutate({ id: task.id, data: { assignedToId } });
  };

  const getRescheduleOptions = () => {
    const today = new Date();
    return [
      { label: "Today", date: format(today, "yyyy-MM-dd") },
      { label: "Tomorrow", date: format(addDays(today, 1), "yyyy-MM-dd") },
      { label: "Next week", date: format(addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1), "yyyy-MM-dd") },
    ];
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate(task.id);
    }
  };

  const handleCompleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (task.status === "done") {
      handleStatusChange("todo");
    } else {
      handleStatusChange("done");
    }
  };

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && task.status !== "done";

  const getDueDateLabel = () => {
    if (!dueDate) return null;
    if (isToday(dueDate)) return "Today";
    if (isTomorrow(dueDate)) return "Tomorrow";
    return format(dueDate, "MMM d");
  };

  const dueDateLabel = getDueDateLabel();

  const assigneeInitials = task.assignedTo
    ? `${task.assignedTo.firstName[0]}${task.assignedTo.lastName?.[0] || ""}`
    : null;
  const assigneeName = task.assignedTo
    ? `${task.assignedTo.firstName} ${task.assignedTo.lastName || ""}`.trim()
    : "Unassigned";

  const renderStatusBadge = () => {
    if (task.status === "done") return <Badge variant="success">Done</Badge>;
    if (task.status === "in_progress") return <Badge variant="info">In Progress</Badge>;
    return <Badge variant="secondary">To Do</Badge>;
  };

  const renderPriorityBadge = () => {
    if (task.priority === 2) return <Badge variant="destructive">Urgent</Badge>;
    if (task.priority === 1) return <Badge variant="warning">High</Badge>;
    return <Badge variant="outline">Normal</Badge>;
  };

  const renderStatusMenu = (align: "start" | "end" = "end") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="shrink-0" onClick={(e) => e.preventDefault()}>
          {renderStatusBadge()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuItem onClick={() => handleStatusChange("todo")} disabled={task.status === "todo"}>
          <Circle className="mr-2 h-4 w-4" />
          To Do
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("in_progress")} disabled={task.status === "in_progress"}>
          <Clock className="mr-2 h-4 w-4" />
          In Progress
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("done")} disabled={task.status === "done"}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Done
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderPriorityMenu = (align: "start" | "end" = "end") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="shrink-0" onClick={(e) => e.preventDefault()}>
          {renderPriorityBadge()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuItem onClick={() => updateTask.mutate({ id: task.id, data: { priority: 0 } })}>
          Normal
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateTask.mutate({ id: task.id, data: { priority: 1 } })}>
          High
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateTask.mutate({ id: task.id, data: { priority: 2 } })}>
          Urgent
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderAssigneeMenu = (align: "start" | "end" = "end") => (
    assignees.length === 0 ? (
      task.assignedTo ? (
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className="text-[10px] font-medium">{assigneeInitials}</AvatarFallback>
        </Avatar>
      ) : null
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-full transition-colors hover:bg-muted/80"
            onClick={(e) => e.preventDefault()}
            aria-label={`Assignee: ${assigneeName}`}
          >
            {task.assignedTo ? (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] font-medium">{assigneeInitials}</AvatarFallback>
              </Avatar>
            ) : (
              <Badge variant="outline" className="gap-1.5 px-2 py-1 text-[11px] font-medium">
                <UserPlus className="h-3 w-3" />
                Assign
              </Badge>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          <DropdownMenuItem onClick={() => handleAssign(null)}>
            <Eraser className="mr-2 h-4 w-4" />
            Unassigned
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {assignees.map((member) => (
            <DropdownMenuItem key={member.id} onClick={() => handleAssign(member.id)}>
              <User className="mr-2 h-4 w-4" />
              {member.firstName} {member.lastName || ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  );

  return (
    <div
      className={cn(
        "group min-w-0 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/30 hover:bg-muted/40 sm:rounded-none sm:border-0 sm:bg-transparent",
        task.status === "done" && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:hidden">
        <div className="flex min-w-0 items-start gap-3">
          {selectable ? (
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <button
              type="button"
              onClick={handleCompleteClick}
              className="mt-0.5 shrink-0 rounded p-0.5 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              aria-label={task.status === "done" ? "Mark as to do" : "Mark as done"}
            >
              {task.status === "done" ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              )}
            </button>
          )}

          <Link href={taskHref} className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "text-sm font-medium leading-5 break-words",
                  task.status === "done" && "line-through text-muted-foreground",
                )}
              >
                {task.title}
              </span>
              {task.isRecurring && <RefreshCw className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}
            </div>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {task.description}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {dueDateLabel && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 px-2 text-[11px] font-normal",
                    isOverdue && "border-destructive/30 text-destructive",
                    isToday(dueDate as Date) && !isOverdue && "border-primary/40 text-primary",
                  )}
                >
                  {isOverdue && <AlertCircle className="mr-1 h-3 w-3" />}
                  Due {dueDateLabel}
                </Badge>
              )}

              {showTheme && task.theme && (
                <Badge
                  variant="accent"
                  className="h-5 px-2 text-[11px]"
                  style={{
                    backgroundColor: task.theme.color ? `${task.theme.color}20` : undefined,
                    color: task.theme.color || undefined,
                    borderColor: task.theme.color ? `${task.theme.color}40` : undefined,
                  }}
                >
                  {task.theme.name}
                </Badge>
              )}

              {showProject && task.project && (
                <Badge variant="outline" className="h-5 px-2 text-[11px] font-normal">
                  Project: {task.project.name}
                </Badge>
              )}

              {task.assignedTo && (
                <Badge variant="outline" className="h-5 px-2 text-[11px] font-normal">
                  Assigned: {assigneeInitials}
                </Badge>
              )}
            </div>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {renderStatusMenu("start")}
            {renderPriorityMenu("start")}
            {renderAssigneeMenu("start")}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {task.status === "todo" && (
                  <DropdownMenuItem onClick={() => handleStatusChange("in_progress")}>
                    <Clock className="mr-2 h-4 w-4" />
                    Start now
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {getRescheduleOptions().map((opt) => (
                  <DropdownMenuItem key={opt.label} onClick={() => handleReschedule(opt.date)}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Reschedule: {opt.label}
                  </DropdownMenuItem>
                ))}
                {task.dueDate && (
                  <DropdownMenuItem onClick={handleClearDueDate}>
                    <Eraser className="mr-2 h-4 w-4" />
                    Clear due date
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="hidden min-w-0 items-center gap-3 sm:flex">
        {selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        ) : (
          <button
            type="button"
            onClick={handleCompleteClick}
            className="shrink-0 rounded p-0.5 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            aria-label={task.status === "done" ? "Mark as to do" : "Mark as done"}
          >
            {task.status === "done" ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        )}

        <Link href={taskHref} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0">
            <span
              className={cn(
                "block truncate font-medium",
                task.status === "done" && "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </span>
            {task.description && (
              <span className="mt-0.5 hidden max-w-[42ch] truncate text-xs text-muted-foreground xl:block">
                {task.description}
              </span>
            )}
          </div>

          {task.isRecurring && <RefreshCw className="h-3 w-3 shrink-0 text-muted-foreground" />}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DropdownMenu open={dateMenuOpen} onOpenChange={setDateMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-1 -mx-1 shrink-0 rounded px-1 transition-colors hover:bg-muted/80",
                    dueDate
                      ? cn(
                          isOverdue && "text-destructive",
                          isToday(dueDate) && !isOverdue && "font-medium text-primary",
                        )
                      : "text-muted-foreground",
                  )}
                  aria-label={dueDate ? `Due ${dueDateLabel}` : "Set due date"}
                >
                  {dueDate ? (
                    <>
                      {isOverdue && <AlertCircle className="h-3 w-3" />}
                      {dueDateLabel}
                    </>
                  ) : (
                    <Calendar className="h-3 w-3" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                {getRescheduleOptions().map((opt) => (
                  <DropdownMenuItem
                    key={opt.label}
                    onClick={() => {
                      handleReschedule(opt.date);
                      setDateMenuOpen(false);
                    }}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
                {task.dueDate && (
                  <DropdownMenuItem
                    onClick={() => {
                      handleClearDueDate();
                      setDateMenuOpen(false);
                    }}
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    Clear due date
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <CalendarRange className="mr-2 h-4 w-4" />
                    Custom...
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <div className="p-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="date"
                        defaultValue={task.dueDate?.split("T")[0]}
                        className="h-8 w-full"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleReschedule(val);
                            setDateMenuOpen(false);
                          }
                        }}
                      />
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {showTheme && task.theme && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <Badge
                  variant="accent"
                  className="shrink-0 text-[10px]"
                  style={{
                    backgroundColor: task.theme.color ? `${task.theme.color}20` : undefined,
                    color: task.theme.color || undefined,
                    borderColor: task.theme.color ? `${task.theme.color}40` : undefined,
                  }}
                >
                  {task.theme.name}
                </Badge>
              </>
            )}

            {showProject && task.project && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="truncate text-xs">{task.project.name}</span>
              </>
            )}
          </div>
        </Link>

        {renderStatusMenu()}
        {renderPriorityMenu()}
        {renderAssigneeMenu()}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 md:opacity-0 md:group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            setEditOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            handleDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 md:opacity-0 md:group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {task.status === "todo" && (
              <DropdownMenuItem onClick={() => handleStatusChange("in_progress")}>
                <Clock className="mr-2 h-4 w-4" />
                Start now
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {getRescheduleOptions().map((opt) => (
              <DropdownMenuItem key={opt.label} onClick={() => handleReschedule(opt.date)}>
                <Calendar className="mr-2 h-4 w-4" />
                Reschedule: {opt.label}
              </DropdownMenuItem>
            ))}
            {task.dueDate && (
              <DropdownMenuItem onClick={handleClearDueDate}>
                <Eraser className="mr-2 h-4 w-4" />
                Clear due date
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      <TaskEditSheet task={task} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
