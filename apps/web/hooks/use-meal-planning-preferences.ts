"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  type UpdateMealPlanningPreferencesInput,
} from "@/lib/api-client";

export function useMealPlanningPreferences() {
  return useQuery({
    queryKey: ["meal-planning-preferences"],
    queryFn: () => apiClient.getMealPlanningPreferences(),
  });
}

export function useUpdateMealPlanningPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateMealPlanningPreferencesInput) =>
      apiClient.updateMealPlanningPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-planning-preferences"] });
    },
  });
}
