"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  type Recipe,
  type CreateRecipeInput,
  type UpdateRecipeInput,
} from "@/lib/api-client";

export function useRecipes(params?: {
  search?: string;
  tag?: string;
  tags?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["recipes", params],
    queryFn: () => apiClient.getRecipes(params),
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: ["recipes", id],
    queryFn: () => apiClient.getRecipe(id),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeInput) => apiClient.createRecipe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecipeInput }) =>
      apiClient.updateRecipe(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipes", id] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}
