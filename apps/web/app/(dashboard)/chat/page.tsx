"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { setPendingFiles, setPendingMessage, setPendingResearch } from "@/lib/pending-chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Send,
  Bot,
  Loader2,
  Paperclip,
  X,
  Telescope,
  Sparkles,
  FileText,
  ImageIcon,
  CornerDownLeft,
} from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [pendingFiles, setLocalPendingFiles] = useState<FileList | null>(null);
  const pendingFileArray = pendingFiles ? Array.from(pendingFiles) : [];
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${Math.max(44, nextHeight)}px`;
  }, [inputValue]);

  const startConversation = async (initialMessage: string, research = false) => {
    const trimmedMessage = initialMessage.trim();
    const hasText = trimmedMessage.length > 0;
    const hasFiles = Boolean(pendingFiles && pendingFiles.length > 0);
    if ((!hasText && !hasFiles) || isCreating) return;

    if (research && hasFiles) {
      toast({
        title: "Deep research does not support file attachments",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      if (hasText) {
        setPendingMessage(trimmedMessage);
      }
      if (research) {
        setPendingResearch(true);
      }
      if (hasFiles && pendingFiles) {
        await setPendingFiles(pendingFiles);
      }
      const result = await apiClient.createConversation({
        provider: "openai",
        model: "gpt-5.1",
      });
      if (hasText) {
        const params = new URLSearchParams({ q: trimmedMessage });
        router.push(`/chat/${result.data.id}?${params.toString()}`);
      } else {
        router.push(`/chat/${result.data.id}`);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast({ title: "Failed to start chat", variant: "destructive" });
      setIsCreating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await startConversation(inputValue);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (isCreating || (!inputValue.trim() && !pendingFiles)) return;
    void startConversation(inputValue);
  };

  const handleQuickAction = async (text: string) => {
    await startConversation(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <div className="w-full max-w-3xl space-y-4 px-6">
          <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-background via-card to-muted/25 p-6 text-center shadow-sm">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 text-base font-semibold">What can I help you with today?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask naturally, attach files, or kick off deep research.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleQuickAction("Show me my tasks for today")}
                disabled={isCreating}
                className="rounded-full"
              >
                Today&apos;s tasks
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleQuickAction("Create a new task")}
                disabled={isCreating}
                className="rounded-full"
              >
                Create task
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleQuickAction("List all family members")}
                disabled={isCreating}
                className="rounded-full"
              >
                Family members
              </Button>
            </div>
          </div>
          {isCreating && (
            <div className="flex justify-center pt-1">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 pb-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-4xl space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => setLocalPendingFiles(e.target.files)}
            disabled={isCreating}
          />
          {pendingFileArray.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/35 px-3 py-2">
              {pendingFileArray.slice(0, 2).map((file) => (
                <span
                  key={`${file.name}-${file.lastModified}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background/80 px-2 py-1 text-xs"
                >
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{file.name}</span>
                </span>
              ))}
              {pendingFileArray.length > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{pendingFileArray.length - 2} more
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setLocalPendingFiles(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                disabled={isCreating}
                className="ml-auto"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Remove attachment</span>
              </Button>
            </div>
          )}
          <div className="rounded-2xl border border-border/70 bg-card/80 p-2 shadow-sm transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
            <div className="flex min-w-0 items-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCreating}
                className="shrink-0 border border-border/70 bg-background/90"
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach file</span>
              </Button>
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask me anything about your household..."
                disabled={isCreating}
                rows={1}
                className="!min-h-[44px] min-w-0 flex-1 max-h-40 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void startConversation(inputValue, true)}
                disabled={isCreating || !inputValue.trim()}
                title="Deep Research"
                className="shrink-0 border border-border/70 bg-background/90"
              >
                <Telescope className="h-4 w-4" />
                <span className="sr-only">Deep Research</span>
              </Button>
              <Button
                type="submit"
                disabled={isCreating || (!inputValue.trim() && !pendingFiles)}
                className="shrink-0 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/30 disabled:text-primary-foreground/70 disabled:opacity-100"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="hidden text-sm font-medium sm:inline">Start chat</span>
              </Button>
            </div>
            <div className="mt-1 flex items-center justify-between px-2 pb-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <CornerDownLeft className="h-3.5 w-3.5" />
                Enter sends &middot; Shift+Enter for new line
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Deep research is one click away
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
