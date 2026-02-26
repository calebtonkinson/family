"use client";

import { List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListCard } from "./list-card";
import type { List as ListType } from "@/lib/api-client";

interface ListListProps {
  lists: ListType[];
  emptyMessage?: string;
  onCreateClick?: () => void;
  onListClick?: (listId: string) => void;
}

export function ListList({
  lists,
  emptyMessage = "No lists yet",
  onCreateClick,
  onListClick,
}: ListListProps) {
  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <List className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="mb-2 text-muted-foreground">{emptyMessage}</p>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Create your first list
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((list) => (
        <div
          key={list.id}
          onClick={() => onListClick?.(list.id)}
          className="block"
        >
          <ListCard list={list} />
        </div>
      ))}
    </div>
  );
}
