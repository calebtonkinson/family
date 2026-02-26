"use client";

import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  apiClient,
  type CreateProjectInput,
  type UpdateProjectInput,
  type Project,
  type PaginationMeta,
} from "@/lib/api-client";

type ProjectQueryParams = {
  themeId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
};

type ProjectsResponse = { data: Project[]; meta: PaginationMeta };
type ProjectDetailResponse = { data: Project };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProjectsResponse(value: unknown): value is ProjectsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    isRecord(value.meta) &&
    typeof value.meta.total === "number"
  );
}

function isProjectDetailResponse(value: unknown): value is ProjectDetailResponse {
  return isRecord(value) && isRecord(value.data) && typeof value.data.id === "string";
}

function parseProjectParams(queryKey: QueryKey): ProjectQueryParams | undefined {
  if (!Array.isArray(queryKey) || queryKey.length < 2) return undefined;
  const second = queryKey[1];
  if (!isRecord(second)) return undefined;
  return second as ProjectQueryParams;
}

function matchesProjectFilters(project: Project, params?: ProjectQueryParams) {
  if (!params) return true;
  if (params.themeId && project.themeId !== params.themeId) return false;
  if (typeof params.isActive === "boolean" && project.isActive !== params.isActive) return false;
  return true;
}

export function useProjects(params?: ProjectQueryParams) {
  return useQuery({
    queryKey: ["projects", params],
    queryFn: () => apiClient.getProjects(params),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => apiClient.getProject(id),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectInput) => apiClient.createProject(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const previous = queryClient.getQueriesData({ queryKey: ["projects"] });
      const now = new Date().toISOString();

      const optimisticProject: Project = {
        id: `temp-${crypto.randomUUID()}`,
        householdId: "",
        themeId: data.themeId || null,
        name: data.name,
        description: data.description || null,
        dueDate: data.dueDate || null,
        isActive: true,
        createdAt: now,
      };

      previous.forEach(([queryKey, existing]) => {
        if (!isProjectsResponse(existing)) return;
        const params = parseProjectParams(queryKey);
        if (!matchesProjectFilters(optimisticProject, params)) return;

        queryClient.setQueryData<ProjectsResponse>(queryKey, {
          ...existing,
          data: [optimisticProject, ...existing.data],
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
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
      apiClient.updateProject(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      await queryClient.cancelQueries({ queryKey: ["projects", id] });
      const previous = queryClient.getQueriesData({ queryKey: ["projects"] });

      previous.forEach(([queryKey, existing]) => {
        if (isProjectsResponse(existing)) {
          const nextData = existing.data
            .map((project) =>
              project.id === id
                ? { ...project, ...data }
                : project,
            )
            .filter((project) => matchesProjectFilters(project, parseProjectParams(queryKey)));

          queryClient.setQueryData<ProjectsResponse>(queryKey, {
            ...existing,
            data: nextData,
          });
          return;
        }

        if (
          Array.isArray(queryKey) &&
          queryKey[0] === "projects" &&
          queryKey[1] === id &&
          isProjectDetailResponse(existing)
        ) {
          queryClient.setQueryData<ProjectDetailResponse>(queryKey, {
            data: { ...existing.data, ...data },
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
    onSettled: (_result, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteProject(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      await queryClient.cancelQueries({ queryKey: ["projects", id] });
      const previous = queryClient.getQueriesData({ queryKey: ["projects"] });

      previous.forEach(([queryKey, existing]) => {
        if (isProjectsResponse(existing)) {
          const nextData = existing.data.filter((project) => project.id !== id);
          queryClient.setQueryData<ProjectsResponse>(queryKey, {
            ...existing,
            data: nextData,
            meta: {
              ...existing.meta,
              total: Math.max(0, existing.meta.total - (existing.data.length - nextData.length)),
            },
          });
          return;
        }

        if (Array.isArray(queryKey) && queryKey[0] === "projects" && queryKey[1] === id) {
          queryClient.removeQueries({ queryKey: queryKey as QueryKey, exact: true });
        }
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
