"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  type BulkUpsertMealPlansInput,
  type MealSlot,
  type UpdateMealPlanInput,
} from "@/lib/api-client";

export function useMealPlans(params?: {
  startDate?: string;
  endDate?: string;
  mealSlot?: MealSlot;
}) {
  return useQuery({
    queryKey: ["meal-plans", params],
    queryFn: () => apiClient.getMealPlans(params),
  });
}

export function useBulkUpsertMealPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkUpsertMealPlansInput) => apiClient.bulkUpsertMealPlans(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
  });
}

export function useUpdateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMealPlanInput }) =>
      apiClient.updateMealPlan(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["meal-plans", variables.id] });
    },
  });
}

export function useDeleteMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteMealPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
  });
}
