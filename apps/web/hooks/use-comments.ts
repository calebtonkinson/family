"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useComments(taskId: string, options?: { pollingInterval?: number }) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => apiClient.getComments(taskId),
    enabled: !!taskId,
    refetchInterval: options?.pollingInterval,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      content,
      mentionedFamilyMemberIds,
    }: {
      taskId: string;
      content: string;
      mentionedFamilyMemberIds?: string[];
    }) =>
      apiClient.createComment(taskId, {
        content,
        mentionedFamilyMemberIds,
      }),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      apiClient.deleteComment(taskId, commentId),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
    },
  });
}
