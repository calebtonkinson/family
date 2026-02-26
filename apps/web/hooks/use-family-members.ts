"use client";

import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  apiClient,
  type CreateFamilyMemberInput,
  type UpdateFamilyMemberInput,
  type FamilyMember,
} from "@/lib/api-client";

type FamilyMembersResponse = { data: FamilyMember[] };
type FamilyMemberDetailResponse = { data: FamilyMember };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFamilyMembersResponse(value: unknown): value is FamilyMembersResponse {
  return isRecord(value) && Array.isArray(value.data);
}

function isFamilyMemberDetailResponse(value: unknown): value is FamilyMemberDetailResponse {
  return isRecord(value) && isRecord(value.data) && typeof value.data.id === "string";
}

export function useFamilyMembers() {
  return useQuery({
    queryKey: ["family-members"],
    queryFn: () => apiClient.getFamilyMembers(),
  });
}

export function useFamilyMember(id: string) {
  return useQuery({
    queryKey: ["family-members", id],
    queryFn: () => apiClient.getFamilyMember(id),
    enabled: !!id,
  });
}

export function useCreateFamilyMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFamilyMemberInput) => apiClient.createFamilyMember(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["family-members"] });
      const previous = queryClient.getQueriesData({ queryKey: ["family-members"] });
      const now = new Date().toISOString();

      const optimisticMember: FamilyMember = {
        id: `temp-${crypto.randomUUID()}`,
        householdId: "",
        firstName: data.firstName,
        lastName: data.lastName || null,
        nickname: data.nickname || null,
        birthday: data.birthday || null,
        gender: data.gender || null,
        avatarUrl: data.avatarUrl || null,
        profileData: data.profileData || null,
        createdAt: now,
        updatedAt: now,
        assignedTaskCount: 0,
      };

      previous.forEach(([queryKey, existing]) => {
        if (!isFamilyMembersResponse(existing)) return;
        queryClient.setQueryData<FamilyMembersResponse>(queryKey, {
          data: [optimisticMember, ...existing.data],
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
      queryClient.invalidateQueries({ queryKey: ["family-members"] });
    },
  });
}

export function useUpdateFamilyMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFamilyMemberInput }) =>
      apiClient.updateFamilyMember(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["family-members"] });
      await queryClient.cancelQueries({ queryKey: ["family-members", id] });
      const previous = queryClient.getQueriesData({ queryKey: ["family-members"] });
      const now = new Date().toISOString();

      previous.forEach(([queryKey, existing]) => {
        if (isFamilyMembersResponse(existing)) {
          queryClient.setQueryData<FamilyMembersResponse>(queryKey, {
            data: existing.data.map((member) =>
              member.id === id
                ? { ...member, ...data, updatedAt: now }
                : member,
            ),
          });
          return;
        }

        if (
          Array.isArray(queryKey) &&
          queryKey[0] === "family-members" &&
          queryKey[1] === id &&
          isFamilyMemberDetailResponse(existing)
        ) {
          queryClient.setQueryData<FamilyMemberDetailResponse>(queryKey, {
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
    onSettled: (_result, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["family-members"] });
      queryClient.invalidateQueries({ queryKey: ["family-members", id] });
    },
  });
}

export function useDeleteFamilyMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteFamilyMember(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["family-members"] });
      await queryClient.cancelQueries({ queryKey: ["family-members", id] });
      const previous = queryClient.getQueriesData({ queryKey: ["family-members"] });

      previous.forEach(([queryKey, existing]) => {
        if (isFamilyMembersResponse(existing)) {
          queryClient.setQueryData<FamilyMembersResponse>(queryKey, {
            data: existing.data.filter((member) => member.id !== id),
          });
          return;
        }

        if (Array.isArray(queryKey) && queryKey[0] === "family-members" && queryKey[1] === id) {
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
      queryClient.invalidateQueries({ queryKey: ["family-members"] });
    },
  });
}
