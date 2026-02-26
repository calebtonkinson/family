"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { apiClient, type Conversation } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MessageSquare, Plus, Trash2, X } from "lucide-react";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        isActive ? "bg-primary/10" : "hover:bg-muted"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
      >
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug line-clamp-2">
            {conversation.title || "New conversation"}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            {formatDate(conversation.updatedAt)}
            {conversation.messageCount
              ? ` · ${conversation.messageCount} msgs`
              : ""}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={cn(
          "mt-0.5 rounded p-0.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        aria-label="Delete conversation"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ConversationList({
  conversations,
  isLoading,
  currentId,
  onSelect,
  onDelete,
}: {
  conversations: Conversation[];
  isLoading: boolean;
  currentId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-1 p-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-md px-2 py-1.5"
          >
            <Skeleton className="mt-0.5 h-3.5 w-3.5 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-center text-muted-foreground">
        <MessageSquare className="mb-2 h-6 w-6 opacity-40" />
        <p className="text-xs">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-1.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={currentId === conversation.id}
          onSelect={() => onSelect(conversation.id)}
          onDelete={() => onDelete(conversation.id)}
        />
      ))}
    </div>
  );
}

function SidebarInner({
  conversations,
  isLoading,
  currentId,
  onNewChat,
  onSelect,
  onDelete,
  showCloseButton = false,
}: {
  conversations: Conversation[];
  isLoading: boolean;
  currentId?: string;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  showCloseButton?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chats
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onNewChat}
            className="h-7 w-7"
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {showCloseButton && (
            <SheetClose asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          currentId={currentId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </ScrollArea>
    </div>
  );
}

interface ChatSidebarProps {
  className?: string;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function ChatSidebar({
  className,
  mobileOpen,
  onMobileOpenChange,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasFetched = useRef(false);

  const currentId = pathname.startsWith("/chat/")
    ? pathname.split("/")[2]
    : undefined;

  // Fetch once on mount, then only when we navigate to a *different* conversation
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    // Skip if same path (prevents re-fetch on re-renders)
    if (hasFetched.current && prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    // Only re-fetch on mount or when navigating between chat routes
    if (hasFetched.current && !pathname.startsWith("/chat")) return;

    let cancelled = false;
    async function load() {
      try {
        if (!hasFetched.current) setIsLoading(true);
        const result = await apiClient.getConversations({ limit: 50 });
        if (!cancelled) {
          setConversations(result.data);
          hasFetched.current = true;
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Close mobile sheet on navigation
  useEffect(() => {
    onMobileOpenChange(false);
  }, [pathname, onMobileOpenChange]);

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
    },
    [router]
  );

  const handleNewChat = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await apiClient.deleteConversation(deleteTarget);
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget));
      if (currentId === deleteTarget) {
        router.push("/chat");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, currentId, router]);

  const deleteTitle = deleteTarget
    ? conversations.find((c) => c.id === deleteTarget)?.title ||
      "this conversation"
    : "";

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden h-full w-64 shrink-0 flex-col border-r bg-card lg:flex",
          className
        )}
      >
        <SidebarInner
          conversations={conversations}
          isLoading={isLoading}
          currentId={currentId}
          onNewChat={handleNewChat}
          onSelect={handleSelect}
          onDelete={setDeleteTarget}
        />
      </aside>

      {/* Mobile */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-72 p-0 pt-[max(0.5rem,env(safe-area-inset-top))] [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <SidebarInner
            conversations={conversations}
            isLoading={isLoading}
            currentId={currentId}
            onNewChat={handleNewChat}
            onSelect={handleSelect}
            onDelete={setDeleteTarget}
            showCloseButton
          />
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTitle}&rdquo; and all its messages will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
