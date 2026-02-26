"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  useList,
  useDeleteList,
  usePinList,
  useUnpinList,
  useAddListItem,
  useUpdateListItem,
  useDeleteListItem,
  usePinnedLists,
  useHouseholdUsers,
  useUpdateListShares,
} from "@/hooks/use-lists";
import { ListItemRow } from "./list-item-row";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Pin, PinOff, Plus, Trash2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ListDetailSheetProps {
  listId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ListDetailSheet({
  listId,
  open,
  onOpenChange,
}: ListDetailSheetProps) {
  const [newItemContent, setNewItemContent] = useState("");
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());

  const { data: session } = useSession();
  const { data, isLoading } = useList(listId ?? "", true);
  const { data: pinnedData } = usePinnedLists();
  const { data: householdUsersData } = useHouseholdUsers();
  const deleteList = useDeleteList();
  const pinList = usePinList();
  const unpinList = useUnpinList();
  const addItem = useAddListItem(listId ?? "");
  const updateItem = useUpdateListItem(listId ?? "");
  const deleteItem = useDeleteListItem(listId ?? "");
  const updateShares = useUpdateListShares(listId ?? "");

  const list = data?.data;
  const currentUserId = (session?.user as { id?: string })?.id;
  const isOwner =
    list?.createdById != null && list.createdById === currentUserId;
  // Legacy lists (no owner) can be claimed by anyone with access - show share UI
  const canManageShares =
    isOwner || (list?.createdById == null && !!currentUserId);
  const householdUsers = householdUsersData?.data ?? [];
  const shareableUsers = householdUsers.filter((u) => u.id !== currentUserId);
  const pinnedLists = pinnedData?.data || [];
  const isPinned = list ? pinnedLists.some((p) => p.id === list.id) : false;

  const activeItems = list?.items.filter((i) => !i.markedOffAt) || [];
  const markedOffItems = list?.items.filter((i) => i.markedOffAt) || [];

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newItemContent.trim();
    if (!content || !listId) return;
    try {
      await addItem.mutateAsync(content);
      setNewItemContent("");
    } catch {
      toast({ title: "Failed to add item", variant: "destructive" });
    }
  };

  const handleToggleItem = async (itemId: string, markedOff: boolean) => {
    setPendingItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      await updateItem.mutateAsync({ itemId, data: { markedOff } });
    } catch {
      toast({ title: "Failed to update item", variant: "destructive" });
    } finally {
      setPendingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setPendingItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      await deleteItem.mutateAsync(itemId);
    } catch {
      toast({ title: "Failed to delete item", variant: "destructive" });
    } finally {
      setPendingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (!listId) return;
    try {
      await deleteList.mutateAsync(listId);
      toast({ title: "List deleted" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to delete list", variant: "destructive" });
    }
  };

  const handlePinToggle = async () => {
    if (!listId) return;
    try {
      if (isPinned) {
        await unpinList.mutateAsync(listId);
        toast({ title: "List unpinned" });
      } else {
        await pinList.mutateAsync(listId);
        toast({ title: "List pinned to home" });
      }
    } catch {
      toast({
        title: isPinned ? "Failed to unpin" : "Failed to pin",
        variant: "destructive",
      });
    }
  };

  const handleShareToggle = async (userId: string, checked: boolean) => {
    if (!listId) return;
    const current = list?.sharedUserIds ?? [];
    const nextIds = checked
      ? [...current, userId]
      : current.filter((id) => id !== userId);
    try {
      await updateShares.mutateAsync(nextIds);
      toast({ title: "Sharing updated" });
    } catch {
      toast({ title: "Failed to update sharing", variant: "destructive" });
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNewItemContent("");
      setPendingItemIds(new Set());
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>{list?.name ?? "List"}</SheetTitle>
        </SheetHeader>

        {isLoading || !list ? (
          <div className="space-y-6 pt-8">
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">{list.name}</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePinToggle}
                  title={isPinned ? "Unpin from home" : "Pin to home"}
                >
                  {isPinned ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete list?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete &quot;{list.name}&quot; and
                        all its items. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <form onSubmit={handleAddItem} className="flex gap-2">
              <Input
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                placeholder="Add an item..."
                disabled={addItem.isPending || !listId}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={addItem.isPending || !newItemContent.trim() || !listId}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </form>

            <div className="rounded-lg border bg-card divide-y divide-border">
              {activeItems.length === 0 && markedOffItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No items yet. Add one above!
                </div>
              ) : (
                <>
                  {activeItems.map((item) => (
                    <ListItemRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggleItem}
                      onDelete={handleDeleteItem}
                      disabled={pendingItemIds.has(item.id)}
                    />
                  ))}
                  {markedOffItems.length > 0 && (
                    <div className="border-t border-border pt-2">
                      <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">
                        Marked off
                      </p>
                      {markedOffItems.map((item) => (
                        <ListItemRow
                          key={item.id}
                          item={item}
                          onToggle={handleToggleItem}
                          onDelete={handleDeleteItem}
                          disabled={pendingItemIds.has(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {canManageShares && (
              <div className="space-y-2 rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Share with
                </div>
                {shareableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No other household members to share with.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {shareableUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex cursor-pointer items-center gap-3 text-sm"
                      >
                        <Checkbox
                          checked={
                            list?.sharedUserIds?.includes(user.id) ?? false
                          }
                          onCheckedChange={(checked) =>
                            handleShareToggle(user.id, checked === true)
                          }
                          disabled={updateShares.isPending}
                        />
                        <span>
                          {user.name || user.email}
                          {user.name && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({user.email})
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
