"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { apiClient, type Conversation } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Clock3, MessageSquare, Plus, Search, Trash2, X } from "lucide-react";

function formatConversationDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildConversationPreview(conversation: Conversation) {
  if (conversation.previewText?.trim()) return conversation.previewText.trim();
  if (conversation.summary?.trim()) return conversation.summary.trim();
  if (!conversation.messageCount) return "Ready for the first message";
  if (conversation.messageCount === 1) return "Started, waiting on the assistant reply";
  return "Conversation in progress";
}

function groupConversations(conversations: Conversation[]) {
  const groups = {
    Today: [] as Conversation[],
    "Last 7 days": [] as Conversation[],
    Older: [] as Conversation[],
  };

  for (const conversation of conversations) {
    const updatedAt = new Date(conversation.updatedAt);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) {
      groups.Today.push(conversation);
    } else if (diffDays < 7) {
      groups["Last 7 days"].push(conversation);
    } else {
      groups.Older.push(conversation);
    }
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0);
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
  const preview = buildConversationPreview(conversation);

  return (
    <div
      className={cn(
        "group rounded-2xl border px-3 py-3 transition-all",
        isActive
          ? "border-primary/30 bg-primary/8 shadow-[0_16px_32px_-28px_hsl(var(--primary)/0.6)]"
          : "border-transparent bg-background/55 hover:border-border/80 hover:bg-background/92",
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
              isActive
                ? "border-primary/35 bg-primary/12 text-primary"
                : "border-border/70 bg-muted/45 text-muted-foreground",
            )}
          >
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
              {conversation.title || "New conversation"}
            </p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
              {preview}
            </p>
          </div>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className={cn(
            "mt-0.5 text-muted-foreground transition-opacity hover:bg-destructive/10 hover:text-destructive",
            isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100",
          )}
          aria-label="Delete conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1">
          <Clock3 className="h-3 w-3" />
          {formatConversationDate(conversation.updatedAt)}
        </span>
        <span className="rounded-full bg-muted/60 px-2 py-1">
          {conversation.messageCount || 0} {conversation.messageCount === 1 ? "message" : "messages"}
        </span>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  isLoading,
  currentId,
  query,
  onSelect,
  onDelete,
}: {
  conversations: Conversation[];
  isLoading: boolean;
  currentId?: string;
  query: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)]">
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border/60 bg-background/60 px-3 py-3"
          >
            <div className="flex items-start gap-2.5">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-10 pb-[calc(env(safe-area-inset-bottom)+0.85rem)]">
        <div className="rounded-[1.75rem] border border-dashed border-border bg-background/65 px-5 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {query ? "No chats match that search" : "No conversations yet"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {query
              ? "Try a different keyword or start a fresh conversation."
              : "Your recent household conversations will show up here."}
          </p>
        </div>
      </div>
    );
  }

  const grouped = groupConversations(conversations);

  return (
    <div className="space-y-5 p-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)]">
      {grouped.map(([label, items]) => (
        <section key={label} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <span className="text-[11px] text-muted-foreground">{items.length}</span>
          </div>
          <div className="space-y-2">
            {items.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={currentId === conversation.id}
                onSelect={() => onSelect(conversation.id)}
                onDelete={() => onDelete(conversation.id)}
              />
            ))}
          </div>
        </section>
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
  query,
  onQueryChange,
  showCloseButton = false,
}: {
  conversations: Conversation[];
  isLoading: boolean;
  currentId?: string;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  showCloseButton?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/70 px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Household assistant
            </p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">
              Chats
            </p>
          </div>
          {showCloseButton ? (
            <SheetClose asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="mt-0.5"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={onNewChat}
          className="mt-3 w-full justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search conversations"
            className="pl-9"
          />
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {conversations.length} recent conversation{conversations.length === 1 ? "" : "s"}
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          currentId={currentId}
          query={query}
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
  const [query, setQuery] = useState("");
  const hasFetched = useRef(false);

  const currentId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : undefined;

  const filteredConversations = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return conversations;

    return conversations.filter((conversation) => {
      const haystack = [
        conversation.title,
        conversation.summary,
        buildConversationPreview(conversation),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(trimmedQuery);
    });
  }, [conversations, query]);

  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (hasFetched.current && prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

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

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    onMobileOpenChange(false);
  }, [pathname, onMobileOpenChange]);

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
    },
    [router],
  );

  const handleNewChat = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await apiClient.deleteConversation(deleteTarget);
      setConversations((prev) => prev.filter((conversation) => conversation.id !== deleteTarget));
      if (currentId === deleteTarget) {
        router.push("/chat");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [currentId, deleteTarget, router]);

  const deleteTitle = deleteTarget
    ? conversations.find((conversation) => conversation.id === deleteTarget)?.title ||
      "this conversation"
    : "";

  return (
    <>
      <aside
        className={cn(
          "chat-sidebar-panel hidden h-full w-[20rem] shrink-0 flex-col lg:flex",
          className,
        )}
      >
        <SidebarInner
          conversations={filteredConversations}
          isLoading={isLoading}
          currentId={currentId}
          onNewChat={handleNewChat}
          onSelect={handleSelect}
          onDelete={setDeleteTarget}
          query={query}
          onQueryChange={setQuery}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="chat-sidebar-panel w-[22rem] p-0 pt-[max(0.5rem,env(safe-area-inset-top))] [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <SidebarInner
            conversations={filteredConversations}
            isLoading={isLoading}
            currentId={currentId}
            onNewChat={handleNewChat}
            onSelect={handleSelect}
            onDelete={setDeleteTarget}
            query={query}
            onQueryChange={setQuery}
            showCloseButton
          />
        </SheetContent>
      </Sheet>

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
              &ldquo;{deleteTitle}&rdquo; and all its messages will be permanently deleted.
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
