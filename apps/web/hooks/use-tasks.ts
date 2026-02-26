"use client";

import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  apiClient,
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
  type PaginationMeta,
} from "@/lib/api-client";

type TaskQueryParams = {
  status?: string;
  themeId?: string;
  projectId?: string;
  assignedToId?: string;
  dueBefore?: string;
  dueAfter?: string;
  isRecurring?: boolean;
  page?: number;
  limit?: number;
};

type TaskListResponse = { data: Task[]; meta: PaginationMeta };
type TaskDetailResponse = { data: Task };

type UpdateTaskVariables = {
  id: string;
  data: UpdateTaskInput;
  invalidate?: boolean;
};

type DeleteTaskVariables = string | { id: string; invalidate?: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTaskListResponse(value: unknown): value is TaskListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    isRecord(value.meta) &&
    typeof value.meta.total === "number"
  );
}

function isTaskDetailResponse(value: unknown): value is TaskDetailResponse {
  return isRecord(value) && isRecord(value.data) && typeof value.data.id === "string";
}

function parseTaskQueryParams(queryKey: QueryKey): TaskQueryParams | undefined {
  if (!Array.isArray(queryKey) || queryKey.length < 2) return undefined;
  const maybeParams = queryKey[1];
  if (!isRecord(maybeParams)) return undefined;
  return maybeParams as TaskQueryParams;
}

function matchesTaskFilters(task: Task, params?: TaskQueryParams): boolean {
  if (!params) return true;
  if (params.status && task.status !== params.status) return false;
  if (params.themeId && task.themeId !== params.themeId) return false;
  if (params.projectId && task.projectId !== params.projectId) return false;
  if (params.assignedToId && task.assignedToId !== params.assignedToId) return false;
  if (typeof params.isRecurring === "boolean" && task.isRecurring !== params.isRecurring) {
    return false;
  }

  if (params.dueAfter || params.dueBefore) {
    if (!task.dueDate) return false;
    const dueDate = task.dueDate.slice(0, 10);
    if (params.dueAfter && dueDate < params.dueAfter) return false;
    if (params.dueBefore && dueDate > params.dueBefore) return false;
  }

  return true;
}

function normalizeDeleteVariables(variables: DeleteTaskVariables): { id: string; invalidate: boolean } {
  if (typeof variables === "string") {
    return { id: variables, invalidate: true };
  }
  return { id: variables.id, invalidate: variables.invalidate !== false };
}

export function useTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => apiClient.getTasks(params),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", id],
    queryFn: () => apiClient.getTask(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskInput) => apiClient.createTask(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previous = queryClient.getQueriesData({ queryKey: ["tasks"] });

      const now = new Date().toISOString();
      const optimisticTask: Task = {
        id: `temp-${crypto.randomUUID()}`,
        householdId: "",
        themeId: data.themeId || null,
        projectId: data.projectId || null,
        title: data.title,
        description: data.description || null,
        status: "todo",
        assignedToId: data.assignedToId || null,
        createdById: "",
        dueDate: data.dueDate || null,
        isRecurring: data.isRecurring || false,
        recurrenceType: data.recurrenceType || null,
        recurrenceInterval: data.recurrenceInterval || null,
        nextDueDate: null,
        lastCompletedAt: null,
        priority: data.priority ?? 0,
        createdAt: now,
        updatedAt: now,
      };

      previous.forEach(([queryKey, existing]) => {
        if (!isTaskListResponse(existing)) return;
        const params = parseTaskQueryParams(queryKey);
        if (!matchesTaskFilters(optimisticTask, params)) return;

        queryClient.setQueryData<TaskListResponse>(queryKey, {
          ...existing,
          data: [optimisticTask, ...existing.data],
          meta: { ...existing.meta, total: existing.meta.total + 1 },
        });
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateTaskVariables) => apiClient.updateTask(id, data),
    onMutate: async (variables) => {
      const { id, data } = variables;
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["tasks", id] });
      const previous = queryClient.getQueriesData({ queryKey: ["tasks"] });
      const now = new Date().toISOString();

      previous.forEach(([queryKey, existing]) => {
        if (isTaskListResponse(existing)) {
          const params = parseTaskQueryParams(queryKey);
          const nextData = existing.data
            .map((task) =>
              task.id === id
                ? { ...task, ...data, updatedAt: now }
                : task,
            )
            .filter((task) => matchesTaskFilters(task, params));

          queryClient.setQueryData<TaskListResponse>(queryKey, {
            ...existing,
            data: nextData,
          });
          return;
        }

        if (
          Array.isArray(queryKey) &&
          queryKey[0] === "tasks" &&
          queryKey[1] === id &&
          isTaskDetailResponse(existing)
        ) {
          queryClient.setQueryData<TaskDetailResponse>(queryKey, {
            data: { ...existing.data, ...data, updatedAt: now },
          });
        }
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: (_result, _error, variables) => {
      if (variables.invalidate === false) return;
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.id] });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.completeTask(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", id] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: DeleteTaskVariables) => {
      const { id } = normalizeDeleteVariables(variables);
      return apiClient.deleteTask(id);
    },
    onMutate: async (variables) => {
      const { id } = normalizeDeleteVariables(variables);
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["tasks", id] });
      const previous = queryClient.getQueriesData({ queryKey: ["tasks"] });

      previous.forEach(([queryKey, existing]) => {
        if (isTaskListResponse(existing)) {
          const nextData = existing.data.filter((task) => task.id !== id);
          queryClient.setQueryData<TaskListResponse>(queryKey, {
            ...existing,
            data: nextData,
            meta: {
              ...existing.meta,
              total: Math.max(0, existing.meta.total - (existing.data.length - nextData.length)),
            },
          });
          return;
        }

        if (Array.isArray(queryKey) && queryKey[0] === "tasks" && queryKey[1] === id) {
          queryClient.removeQueries({ queryKey: queryKey as QueryKey, exact: true });
        }
      });

      return { previous, id };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: (_result, _error, variables) => {
      const { id, invalidate } = normalizeDeleteVariables(variables);
      if (!invalidate) return;
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", id] });
    },
  });
}
