"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type CreateThemeInput, type UpdateThemeInput } from "@/lib/api-client";

export function useThemes() {
  return useQuery({
    queryKey: ["themes"],
    queryFn: () => apiClient.getThemes(),
  });
}

export function useTheme(id: string) {
  return useQuery({
    queryKey: ["themes", id],
    queryFn: () => apiClient.getTheme(id),
    enabled: !!id,
  });
}

export function useCreateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateThemeInput) => apiClient.createTheme(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] });
    },
  });
}

export function useUpdateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateThemeInput }) =>
      apiClient.updateTheme(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["themes"] });
      queryClient.invalidateQueries({ queryKey: ["themes", id] });
    },
  });
}

export function useDeleteTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTheme(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] });
    },
  });
}
