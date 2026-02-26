"use client";

import { useState } from "react";
import { useLists, useCreateList } from "@/hooks/use-lists";
import { ListList } from "@/components/lists";
import { ListDetailSheet } from "@/components/lists/list-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ListsPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const { data, isLoading } = useLists({
    search: search.trim() || undefined,
  });
  const createList = useCreateList();

  const lists = data?.data || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) {
      toast({ title: "List name is required", variant: "destructive" });
      return;
    }
    try {
      await createList.mutateAsync({ name });
      toast({ title: "List created" });
      setShowCreate(false);
      setNewListName("");
    } catch {
      toast({ title: "Failed to create list", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lists</h1>
        <Button onClick={() => setShowCreate((prev) => !prev)}>
          {showCreate ? (
            <X className="mr-2 h-4 w-4" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {showCreate ? "Close" : "New list"}
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lists..."
          className="pl-9"
        />
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="List name"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={createList.isPending}>
              Create list
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setNewListName("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Loading lists...
        </div>
      ) : (
        <ListList
          lists={lists}
          emptyMessage={
            search.trim() ? "No lists match your search" : "No lists yet"
          }
          onCreateClick={() => setShowCreate(true)}
          onListClick={(listId) => setSelectedListId(listId)}
        />
      )}

      <ListDetailSheet
        listId={selectedListId}
        open={selectedListId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedListId(null);
        }}
      />
    </div>
  );
}
