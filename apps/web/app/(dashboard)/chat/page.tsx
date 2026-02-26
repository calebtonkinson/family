"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { setPendingFiles, setPendingMessage, setPendingResearch } from "@/lib/pending-chat-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Send, Bot, Loader2, Paperclip, X, Telescope } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [pendingFiles, setLocalPendingFiles] = useState<FileList | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleQuickAction = async (text: string) => {
    await startConversation(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <div className="max-w-md space-y-3 px-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Bot className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            What can I help you with?
          </p>
          {isCreating && (
            <div className="flex justify-center pt-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleQuickAction("Show me my tasks for today")}
            disabled={isCreating}
            className="h-7 text-xs"
          >
            Today&apos;s tasks
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleQuickAction("Create a new task")}
            disabled={isCreating}
            className="h-7 text-xs"
          >
            Create task
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleQuickAction("List all family members")}
            disabled={isCreating}
            className="h-7 text-xs"
          >
            Family members
          </Button>
        </div>
        {pendingFiles && pendingFiles.length > 0 && (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs text-muted-foreground">
            <span className="truncate">
              {pendingFiles.length === 1
                ? pendingFiles[0]?.name
                : `${pendingFiles.length} files attached`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setLocalPendingFiles(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              disabled={isCreating}
              className="h-7 w-7"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove attachment</span>
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => setLocalPendingFiles(e.target.files)}
            disabled={isCreating}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCreating}
            className="h-9 w-9 shrink-0"
          >
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Attach file</span>
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me anything about your household..."
            disabled={isCreating}
            className="flex-1 h-9 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void startConversation(inputValue, true)}
            disabled={isCreating || !inputValue.trim()}
            title="Deep Research"
            className="h-9 w-9 shrink-0"
          >
            <Telescope className="h-4 w-4" />
            <span className="sr-only">Deep Research</span>
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={isCreating || (!inputValue.trim() && !pendingFiles)}
            className="h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/30 disabled:text-primary-foreground/70 disabled:opacity-100"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
