"use client";

import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  apiClient,
  type CreateConversationInput,
  type Conversation,
  type PaginationMeta,
} from "@/lib/api-client";

type ConversationQueryParams = { page?: number; limit?: number };
type ConversationsResponse = { data: Conversation[]; meta: PaginationMeta };
type ConversationDetailResponse = { data: Conversation };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConversationsResponse(value: unknown): value is ConversationsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    isRecord(value.meta) &&
    typeof value.meta.total === "number"
  );
}

function isConversationDetailResponse(value: unknown): value is ConversationDetailResponse {
  return isRecord(value) && isRecord(value.data) && typeof value.data.id === "string";
}

export function useConversations(params?: ConversationQueryParams) {
  return useQuery({
    queryKey: ["conversations", params],
    queryFn: () => apiClient.getConversations(params),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["conversations", id],
    queryFn: () => apiClient.getConversation(id),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateConversationInput) => apiClient.createConversation(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"] });
      const previous = queryClient.getQueriesData({ queryKey: ["conversations"] });
      const now = new Date().toISOString();

      const optimisticConversation: Conversation = {
        id: `temp-${crypto.randomUUID()}`,
        householdId: "",
        startedById: "",
        title: data.title || "New conversation",
        summary: null,
        provider: data.provider || "openai",
        model: data.model || "gpt-5.1",
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      };

      previous.forEach(([queryKey, existing]) => {
        if (!isConversationsResponse(existing)) return;
        queryClient.setQueryData<ConversationsResponse>(queryKey, {
          ...existing,
          data: [optimisticConversation, ...existing.data],
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
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteConversation(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"] });
      await queryClient.cancelQueries({ queryKey: ["conversations", id] });
      const previous = queryClient.getQueriesData({ queryKey: ["conversations"] });

      previous.forEach(([queryKey, existing]) => {
        if (isConversationsResponse(existing)) {
          const nextData = existing.data.filter((conversation) => conversation.id !== id);
          queryClient.setQueryData<ConversationsResponse>(queryKey, {
            ...existing,
            data: nextData,
            meta: {
              ...existing.meta,
              total: Math.max(0, existing.meta.total - (existing.data.length - nextData.length)),
            },
          });
          return;
        }

        if (
          Array.isArray(queryKey) &&
          queryKey[0] === "conversations" &&
          queryKey[1] === id &&
          isConversationDetailResponse(existing)
        ) {
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
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
