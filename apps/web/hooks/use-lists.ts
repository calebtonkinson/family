"use client";

import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  apiClient,
  type CreateListInput,
  type UpdateListInput,
  type List,
  type ListItem,
  type ListWithItems,
  type PinnedList,
  type PaginationMeta,
} from "@/lib/api-client";

type ListsParams = {
  search?: string;
  page?: number;
  limit?: number;
};

type ListsResponse = { data: List[]; meta: PaginationMeta };
type ListDetailResponse = { data: ListWithItems };
type PinnedListsResponse = { data: PinnedList[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isListsResponse(value: unknown): value is ListsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    isRecord(value.meta) &&
    typeof value.meta.total === "number"
  );
}

function isListDetailResponse(value: unknown): value is ListDetailResponse {
  return (
    isRecord(value) &&
    isRecord(value.data) &&
    typeof value.data.id === "string" &&
    Array.isArray(value.data.items)
  );
}

function isPinnedListsResponse(value: unknown): value is PinnedListsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    value.data.every(
      (item) =>
        isRecord(item) &&
        typeof item.pinId === "string" &&
        typeof item.position === "number" &&
        Array.isArray(item.items),
    )
  );
}

function parseListParams(queryKey: QueryKey): ListsParams | undefined {
  if (!Array.isArray(queryKey) || queryKey.length < 2) return undefined;
  const second = queryKey[1];
  if (!isRecord(second)) return undefined;
  return second as ListsParams;
}

function listMatchesSearch(list: List, params?: ListsParams): boolean {
  if (!params?.search) return true;
  return list.name.toLowerCase().includes(params.search.toLowerCase());
}

function applyListItemUpdate(item: ListItem, data: { content?: string; markedOff?: boolean }) {
  const now = new Date().toISOString();
  return {
    ...item,
    content: data.content ?? item.content,
    markedOffAt:
      data.markedOff === undefined
        ? item.markedOffAt
        : data.markedOff
          ? now
          : null,
  };
}

function findListSnapshot(data: [QueryKey, unknown][], listId: string): ListWithItems | undefined {
  for (const [, queryData] of data) {
    if (isListDetailResponse(queryData) && queryData.data.id === listId) {
      return queryData.data;
    }
  }

  for (const [, queryData] of data) {
    if (!isListsResponse(queryData)) continue;
    const list = queryData.data.find((entry) => entry.id === listId);
    if (list) {
      return {
        ...list,
        items: [],
      };
    }
  }

  return undefined;
}

export function useLists(params?: ListsParams) {
  return useQuery({
    queryKey: ["lists", params],
    queryFn: () => apiClient.getLists(params),
  });
}

export function useList(id: string, includeMarkedOff?: boolean) {
  return useQuery({
    queryKey: ["lists", id, includeMarkedOff],
    queryFn: () => apiClient.getList(id, includeMarkedOff),
    enabled: !!id,
  });
}

export function usePinnedLists() {
  return useQuery({
    queryKey: ["lists", "pinned"],
    queryFn: () => apiClient.getPinnedLists(),
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateListInput) => apiClient.createList(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });
      const now = new Date().toISOString();

      const optimisticList: List = {
        id: `temp-${crypto.randomUUID()}`,
        householdId: "",
        createdById: null,
        name: data.name,
        createdAt: now,
        updatedAt: now,
      };

      previous.forEach(([queryKey, existing]) => {
        if (!isListsResponse(existing)) return;
        const params = parseListParams(queryKey);
        if (!listMatchesSearch(optimisticList, params)) return;

        queryClient.setQueryData<ListsResponse>(queryKey, {
          ...existing,
          data: [optimisticList, ...existing.data],
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
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateListInput }) =>
      apiClient.updateList(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });
      const now = new Date().toISOString();

      previous.forEach(([queryKey, existing]) => {
        if (isListsResponse(existing)) {
          queryClient.setQueryData<ListsResponse>(queryKey, {
            ...existing,
            data: existing.data
              .map((list) =>
                list.id === id
                  ? { ...list, ...data, updatedAt: now }
                  : list,
              )
              .filter((list) => listMatchesSearch(list, parseListParams(queryKey))),
          });
          return;
        }

        if (isListDetailResponse(existing) && existing.data.id === id) {
          queryClient.setQueryData<ListDetailResponse>(queryKey, {
            data: { ...existing.data, ...data, updatedAt: now },
          });
          return;
        }

        if (isPinnedListsResponse(existing)) {
          queryClient.setQueryData<PinnedListsResponse>(queryKey, {
            data: existing.data.map((list) =>
              list.id === id
                ? { ...list, ...data, updatedAt: now }
                : list,
            ),
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
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", id] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteList(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });

      previous.forEach(([queryKey, existing]) => {
        if (isListsResponse(existing)) {
          const nextData = existing.data.filter((list) => list.id !== id);
          queryClient.setQueryData<ListsResponse>(queryKey, {
            ...existing,
            data: nextData,
            meta: {
              ...existing.meta,
              total: Math.max(0, existing.meta.total - (existing.data.length - nextData.length)),
            },
          });
          return;
        }

        if (isPinnedListsResponse(existing)) {
          queryClient.setQueryData<PinnedListsResponse>(queryKey, {
            data: existing.data.filter((list) => list.id !== id),
          });
          return;
        }

        if (
          isListDetailResponse(existing) &&
          existing.data.id === id &&
          Array.isArray(queryKey)
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
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}

export function usePinList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.pinList(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });
      const now = new Date().toISOString();
      const sourceList = findListSnapshot(previous, id);

      previous.forEach(([queryKey, existing]) => {
        if (!isPinnedListsResponse(existing)) return;
        if (existing.data.some((list) => list.id === id)) return;

        const optimisticPinned: PinnedList = sourceList
          ? {
              ...sourceList,
              pinId: `temp-pin-${id}`,
              position: existing.data.length,
            }
          : {
              id,
              householdId: "",
              createdById: null,
              name: "List",
              createdAt: now,
              updatedAt: now,
              items: [],
              pinId: `temp-pin-${id}`,
              position: existing.data.length,
            };

        queryClient.setQueryData<PinnedListsResponse>(queryKey, {
          data: [...existing.data, optimisticPinned],
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
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}

export function useUnpinList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.unpinList(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });

      previous.forEach(([queryKey, existing]) => {
        if (!isPinnedListsResponse(existing)) return;
        queryClient.setQueryData<PinnedListsResponse>(queryKey, {
          data: existing.data.filter((list) => list.id !== id),
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
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}

export function useAddListItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => apiClient.addListItem(listId, content),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });
      const now = new Date().toISOString();
      const optimisticItem: ListItem = {
        id: `temp-item-${crypto.randomUUID()}`,
        listId,
        content,
        addedAt: now,
        markedOffAt: null,
      };

      previous.forEach(([queryKey, existing]) => {
        if (isListDetailResponse(existing) && existing.data.id === listId) {
          queryClient.setQueryData<ListDetailResponse>(queryKey, {
            data: {
              ...existing.data,
              items: [...existing.data.items, optimisticItem],
              updatedAt: now,
            },
          });
          return;
        }

        if (isPinnedListsResponse(existing)) {
          queryClient.setQueryData<PinnedListsResponse>(queryKey, {
            data: existing.data.map((list) => {
              if (list.id !== listId || !Array.isArray((list as PinnedList).items))
                return list;
              return {
                ...list,
                items: [...(list as PinnedList).items, optimisticItem],
                updatedAt: now,
              };
            }),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}

export function useUpdateListItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: string;
      data: { content?: string; markedOff?: boolean };
    }) => apiClient.updateListItem(listId, itemId, data),
    onMutate: async ({ itemId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });

      previous.forEach(([queryKey, existing]) => {
        if (isListDetailResponse(existing) && existing.data.id === listId) {
          queryClient.setQueryData<ListDetailResponse>(queryKey, {
            data: {
              ...existing.data,
              items: existing.data.items.map((item) =>
                item.id === itemId
                  ? applyListItemUpdate(item, data)
                  : item,
              ),
            },
          });
          return;
        }

        if (isPinnedListsResponse(existing)) {
          queryClient.setQueryData<PinnedListsResponse>(queryKey, {
            data: existing.data.map((list) => {
              if (list.id !== listId || !Array.isArray((list as PinnedList).items))
                return list;
              return {
                ...list,
                items: (list as PinnedList).items.map((item) =>
                  item.id === itemId
                    ? applyListItemUpdate(item, data)
                    : item,
                ),
              };
            }),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}

export function useDeleteListItem(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => apiClient.deleteListItem(listId, itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });

      previous.forEach(([queryKey, existing]) => {
        if (isListDetailResponse(existing) && existing.data.id === listId) {
          queryClient.setQueryData<ListDetailResponse>(queryKey, {
            data: {
              ...existing.data,
              items: existing.data.items.filter((item) => item.id !== itemId),
            },
          });
          return;
        }

        if (isPinnedListsResponse(existing)) {
          queryClient.setQueryData<PinnedListsResponse>(queryKey, {
            data: existing.data.map((list) => {
              if (list.id !== listId || !Array.isArray((list as PinnedList).items))
                return list;
              return {
                ...list,
                items: (list as PinnedList).items.filter((item) => item.id !== itemId),
              };
            }),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}

export function useHouseholdUsers() {
  return useQuery({
    queryKey: ["household", "users"],
    queryFn: () => apiClient.getHouseholdUsers(),
  });
}

export function useUpdateListShares(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: string[]) =>
      apiClient.updateListShares(listId, userIds),
    onMutate: async (userIds) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });

      previous.forEach(([queryKey, existing]) => {
        if (isListDetailResponse(existing) && existing.data.id === listId) {
          queryClient.setQueryData<ListDetailResponse>(queryKey, {
            data: { ...existing.data, sharedUserIds: userIds },
          });
          return;
        }

        if (isListsResponse(existing)) {
          queryClient.setQueryData<ListsResponse>(queryKey, {
            ...existing,
            data: existing.data.map((list) =>
              list.id === listId
                ? { ...list, sharedUserIds: userIds }
                : list,
            ),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}

export function useMarkOffListItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      listId,
      itemId,
      markedOff,
    }: {
      listId: string;
      itemId: string;
      markedOff: boolean;
    }) => apiClient.updateListItem(listId, itemId, { markedOff }),
    onMutate: async ({ listId, itemId, markedOff }) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previous = queryClient.getQueriesData({ queryKey: ["lists"] });

      previous.forEach(([queryKey, existing]) => {
        if (isListDetailResponse(existing) && existing.data.id === listId) {
          queryClient.setQueryData<ListDetailResponse>(queryKey, {
            data: {
              ...existing.data,
              items: existing.data.items.map((item) =>
                item.id === itemId
                  ? applyListItemUpdate(item, { markedOff })
                  : item,
              ),
            },
          });
          return;
        }

        if (isPinnedListsResponse(existing)) {
          queryClient.setQueryData<PinnedListsResponse>(queryKey, {
            data: existing.data.map((list) => {
              if (list.id !== listId || !Array.isArray((list as PinnedList).items))
                return list;
              return {
                ...list,
                items: (list as PinnedList).items.map((item) =>
                  item.id === itemId
                    ? applyListItemUpdate(item, { markedOff })
                    : item,
                ),
              };
            }),
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
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists", variables.listId] });
      queryClient.invalidateQueries({ queryKey: ["lists", "pinned"] });
    },
  });
}
