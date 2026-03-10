"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  setPendingFiles,
  setPendingMessage,
  setPendingResearch,
} from "@/lib/pending-chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Bot,
  CornerDownLeft,
  FileText,
  ImageIcon,
  ListTodo,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Telescope,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";

const starterPrompts = [
  {
    title: "Tasks and planning",
    description: "Review today, assign work, or turn a rough idea into a task.",
    prompt: "Show me my tasks for today and call out what needs attention first",
    icon: ListTodo,
  },
  {
    title: "Family context",
    description: "Pull family details and household context into one focused thread.",
    prompt: "List all family members and summarize who owns what right now",
    icon: Users,
  },
  {
    title: "Meals and recipes",
    description: "Plan dinners, build a menu, or shape a recipe from a photo.",
    prompt: "Plan three easy dinners for this week based on what we usually make",
    icon: UtensilsCrossed,
  },
];

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-5 lg:px-6 lg:py-8">
        <div className="w-full max-w-6xl space-y-4">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="chat-hero-panel rounded-[2rem] p-6 md:p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(180deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.08))] shadow-[inset_0_1px_0_hsl(var(--card)/0.9)]">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <p className="mt-5 text-[clamp(1.9rem,3vw,3.1rem)] font-semibold tracking-[-0.04em] text-foreground">
                Household help that feels editorial, not transactional.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Ask naturally, pull household context into one place, attach files, or kick off
                deep research when you need a fuller answer.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleQuickAction("Show me my tasks for today")}
                  disabled={isCreating}
                  className="rounded-full"
                >
                  Today&apos;s tasks
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void handleQuickAction(
                      "Create a task for cleaning the kitchen tomorrow",
                    )
                  }
                  disabled={isCreating}
                  className="rounded-full"
                >
                  Create task
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleQuickAction("Plan dinners for the next three nights")}
                  disabled={isCreating}
                  className="rounded-full"
                >
                  Dinner plan
                </Button>
              </div>
            </div>

            <div className="feature-panel hidden rounded-[2rem] p-5 lg:block md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Works best for
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-border/70 bg-background/72 p-4">
                  <p className="text-sm font-semibold text-foreground">Quick household operations</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Create tasks, look up family details, and shape plans without switching screens.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/72 p-4">
                  <p className="text-sm font-semibold text-foreground">Context-rich follow-ups</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Keep a thread open while the assistant stays grounded in your household.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/72 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Research when the answer matters
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Use deep research for decisions that need sources, synthesis, and a cleaner brief.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
            {starterPrompts.map((starter) => {
              const Icon = starter.icon;

              return (
                <button
                  key={starter.title}
                  type="button"
                  onClick={() => void handleQuickAction(starter.prompt)}
                  disabled={isCreating}
                  className="feature-panel min-w-[16.5rem] rounded-[1.65rem] p-5 text-left transition hover:-translate-y-0.5 lg:min-w-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-base font-semibold tracking-[-0.02em] text-foreground">
                    {starter.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {starter.description}
                  </p>
                </button>
              );
            })}
          </section>

          {isCreating ? (
            <div className="flex justify-center pt-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting your conversation
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/70 bg-background/70 px-4 pb-4 pt-3 backdrop-blur">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-4xl space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(event) => setLocalPendingFiles(event.target.files)}
            disabled={isCreating}
          />
          {pendingFileArray.length > 0 ? (
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
              {pendingFileArray.length > 2 ? (
                <span className="text-xs text-muted-foreground">
                  +{pendingFileArray.length - 2} more
                </span>
              ) : null}
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
          ) : null}
          <div className="chat-input-dock rounded-[1.65rem] p-2.5 transition focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
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
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask me anything about your household..."
                disabled={isCreating}
                rows={1}
                className="!min-h-[44px] min-w-0 max-h-40 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                className="shrink-0 gap-2 rounded-xl bg-primary text-white hover:bg-primary/90 disabled:bg-primary/30 disabled:text-white/70 disabled:opacity-100 [&_svg]:text-white"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden text-sm font-medium sm:inline">Start chat</span>
              </Button>
            </div>
            <div className="mt-1 flex items-center justify-between px-2 pb-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <CornerDownLeft className="h-3.5 w-3.5" />
                Enter sends · Shift+Enter for new line
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
