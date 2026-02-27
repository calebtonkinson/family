"use client";

import { useRef, useEffect, useState } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { getSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  Bot,
  User,
  Loader2,
  Wrench,
  Paperclip,
  X,
  Telescope,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPendingMessage, getPendingFiles, getPendingResearch } from "@/lib/pending-chat-message";
import ReactMarkdown from "react-markdown";
import {
  ToolInvocationCard,
  type ChatToolInvocation,
} from "@/components/chat/tool-invocation-card";
import { ResearchPresentationView } from "@/components/chat/research-blocks";
import {
  apiClient,
  type ResearchRunStatusResponse,
} from "@/lib/api-client";
import type { ResearchPresentation } from "@home/shared";
import { toast } from "@/hooks/use-toast";

interface ChatProps {
  conversationId: string;
  initialMessages?: UIMessage[];
  onConversationUpdated?: () => void;
  initialResearchStatus?: ResearchRunStatusResponse | null;
  initialPendingMessage?: string | null;
}

interface ToolPart {
  type: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  state?: string;
  errorText?: string;
  // Legacy fields
  args?: Record<string, unknown>;
  result?: unknown;
}

// Helper to extract text content from UIMessage
function getMessageText(message: UIMessage): string {
  if (!message.parts) return "";
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

// Helper to extract file parts from UIMessage
function getFileParts(message: UIMessage) {
  if (!message.parts) return [];
  return message.parts.filter(
    (part) => part.type === "file",
  ) as Array<{
    type: "file";
    url: string;
    mediaType: string;
    filename?: string;
  }>;
}

// Helper to check if message has tool parts
function getToolParts(message: UIMessage) {
  if (!message.parts) return [];
  return message.parts.filter((part) => part.type.startsWith("tool-"));
}

export function Chat({
  conversationId,
  initialMessages = [],
  onConversationUpdated,
  initialResearchStatus,
  initialPendingMessage,
}: ChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const [inputValue, setInputValue] = useState("");
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);

  const [researchStatus, setResearchStatus] = useState<ResearchRunStatusResponse | null>(
    initialResearchStatus || null,
  );
  const [activeRunId, setActiveRunId] = useState<string | null>(
    initialResearchStatus?.run.runId || null,
  );
  const [isResearchLoading, setIsResearchLoading] = useState(false);

  const { messages, setMessages, sendMessage, status } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/v1/ai/chat/${conversationId}`,
      headers: async () => {
        const session = await getSession();
        const accessToken = (session as unknown as { accessToken?: string } | null)
          ?.accessToken;

        const headers: Record<string, string> = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
        return headers;
      },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";
  const hasSentPendingPayload = useRef(false);
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;
  const prevStatusRef = useRef(status);

  useEffect(() => {
    setResearchStatus(initialResearchStatus || null);
    setActiveRunId(initialResearchStatus?.run.runId || null);
  }, [initialResearchStatus]);

  // Refresh sidebar when a response completes (title may have updated)
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      onConversationUpdated?.();
    }
    prevStatusRef.current = status;
  }, [status, onConversationUpdated]);

  // Check for and send pending message from new chat creation.
  // Uses a two-phase approach to survive React StrictMode double-invocation:
  // Phase 1 (first effect run): read and stash the pending payload, clear storage
  // Phase 2 (after mount settles): actually send the message (or start research)
  const pendingPayloadRef = useRef<{
    message: string | null;
    files: ReturnType<typeof getPendingFiles>;
    research: boolean;
  } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStartResearchRef = useRef<(query?: string) => Promise<void>>(null as any);

  useEffect(() => {
    if (hasSentPendingPayload.current) return;

    // Phase 1: capture pending payload (only on first run before send)
    if (!pendingPayloadRef.current) {
      const pendingMessage = getPendingMessage() ?? initialPendingMessage ?? null;
      const pendingFilesData = getPendingFiles();
      const pendingResearch = getPendingResearch();
      if (pendingMessage || (pendingFilesData && pendingFilesData.length > 0)) {
        pendingPayloadRef.current = { message: pendingMessage, files: pendingFilesData, research: pendingResearch };
      } else {
        return;
      }
    }

    // Phase 2: send the stashed payload
    const { message, files, research } = pendingPayloadRef.current;
    hasSentPendingPayload.current = true;

    if (research && message) {
      // Start deep research with this query
      void handleStartResearchRef.current(message);
    } else if (message && files?.length) {
      sendMessageRef.current({ text: message, files });
    } else if (files?.length) {
      sendMessageRef.current({ files });
    } else if (message) {
      sendMessageRef.current({ text: message });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPendingMessage]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({
      behavior: hasMountedRef.current ? "smooth" : "auto",
      block: "end",
    });
    hasMountedRef.current = true;
  }, [messages, isLoading, researchStatus]);

  // Poll active research run for progress
  useEffect(() => {
    if (!activeRunId) return;
    if (!researchStatus) return;
    if (researchStatus.run.status !== "running" && researchStatus.run.status !== "planning") {
      return;
    }

    let stopped = false;

    const refresh = async () => {
      try {
        const next = await apiClient.getResearchRun(conversationId, activeRunId);
        if (stopped) return;
        setResearchStatus(next);
        if (
          next.run.status === "completed" ||
          next.run.status === "completed_with_warnings" ||
          next.run.status === "failed" ||
          next.run.status === "canceled"
        ) {
          setIsResearchLoading(false);

          if (
            (next.run.status === "completed" ||
              next.run.status === "completed_with_warnings" ||
              next.run.status === "failed") &&
            next.report
          ) {
            const localMessageId = `research-report-${next.run.runId}`;
            const alreadyExists = messages.some((message) => message.id === localMessageId);
            if (!alreadyExists) {
              // Use presentation markdown if available, otherwise fall back to summary
              const presentation = next.presentation ?? null;
              const messageText = presentation?.markdown
                ?? next.report.summary
                ?? "Research complete.";

              setMessages((prev) => [
                ...prev,
                {
                  id: localMessageId,
                  role: "assistant",
                  parts: [{ type: "text", text: messageText }],
                  // Stash presentation data for rendering
                  ...( presentation ? { experimental_attachments: [{ name: "presentation", contentType: "application/json", url: `data:application/json,${encodeURIComponent(JSON.stringify(presentation))}` }] } : {}),
                } as UIMessage,
              ]);
            }
          }
        }
      } catch (error) {
        console.error("Failed to poll research run:", error);
      }
    };

    const interval = setInterval(() => {
      void refresh();
    }, 4000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [activeRunId, researchStatus, conversationId, messages, setMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const hasText = inputValue.trim().length > 0;
    if (!hasText && !pendingFiles) return;
    if (isLoading) return;

    if (pendingFiles && hasText) {
      sendMessage({ text: inputValue.trim(), files: pendingFiles });
    } else if (pendingFiles) {
      sendMessage({ files: pendingFiles });
    } else {
      sendMessage({ text: inputValue.trim() });
    }

    setInputValue("");
    setPendingFiles(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (isLoading || isResearchLoading) return;
    if (!inputValue.trim() && !pendingFiles) return;
    formRef.current?.requestSubmit();
  };

  // Auto-approve research: create plan + immediately start the run
  const handleStartResearch = async (queryOverride?: string) => {
    const queryText = (queryOverride ?? inputValue).trim();
    if (!queryText) return;
    if (pendingFiles) {
      toast({
        title: "Deep research does not support file attachments",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsResearchLoading(true);

      // Add user message to chat
      const localUserMessageId = `research-user-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: localUserMessageId,
          role: "user",
          parts: [{ type: "text", text: `🔭 ${queryText}` }],
        },
      ]);
      setInputValue("");

      // Step 1: Create the plan
      const planResponse = await apiClient.createResearchPlan(conversationId, {
        query: queryText,
        effort: "standard",
        recencyDays: null,
      });

      setActiveRunId(planResponse.runId);

      if (planResponse.planner.status === "fallback") {
        toast({
          title: "Using fallback research plan",
          description: planResponse.planner.reason || "The AI planner did not return a valid plan.",
          variant: "destructive",
        });
      }

      // Step 2: Immediately start the run (auto-approve)
      await apiClient.startResearchRun(conversationId, planResponse.runId, {
        plan: planResponse.plan,
      });

      // Step 3: Fetch initial status and begin polling
      const statusResponse = await apiClient.getResearchRun(conversationId, planResponse.runId);
      setResearchStatus(statusResponse);

      toast({ title: "Research started" });
    } catch (error) {
      console.error("Failed to start research:", error);
      setIsResearchLoading(false);
      toast({
        title: "Failed to start research",
        variant: "destructive",
      });
    }
  };
  handleStartResearchRef.current = handleStartResearch;

  // Try to extract presentation data from a research report message
  function getPresentationFromMessage(message: UIMessage): ResearchPresentation | null {
    try {
      const attachments = (message as unknown as Record<string, unknown>).experimental_attachments as
        | Array<{ name: string; contentType: string; url: string }>
        | undefined;
      if (!attachments) return null;
      const presentationAttachment = attachments.find((a) => a.name === "presentation");
      if (!presentationAttachment) return null;
      const json = decodeURIComponent(presentationAttachment.url.replace("data:application/json,", ""));
      return JSON.parse(json) as ResearchPresentation;
    } catch {
      return null;
    }
  }

  // Check if the active research run is still in progress
  const isResearchInProgress =
    researchStatus != null &&
    (researchStatus.run.status === "running" || researchStatus.run.status === "planning");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0 min-w-0">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 lg:max-w-5xl">
          {messages.map((message) => {
            const textContent = getMessageText(message);
            const toolParts = getToolParts(message);
            const fileParts = getFileParts(message);
            const presentation = getPresentationFromMessage(message);

            // Skip rendering empty messages
            if (!textContent && toolParts.length === 0 && fileParts.length === 0) {
              return null;
            }

            return (
              <div key={message.id} className="space-y-2">
                {/* Tool Invocations */}
                {toolParts.length > 0 && (
                  <div className="flex min-w-0 gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>
                        <Wrench className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-2">
                      {toolParts.map((tool, idx) => {
                        const toolPart = tool as unknown as ToolPart;
                        const toolName =
                          toolPart.toolName ||
                          toolPart.type.replace(/^tool-/, "") ||
                          "tool";

                        const normalizedTool: ChatToolInvocation = {
                          id: toolPart.toolCallId || `${message.id}-tool-${idx}`,
                          toolName,
                          state: toolPart.state,
                          input: toolPart.input || toolPart.args,
                          output: toolPart.output || toolPart.result,
                          errorText: toolPart.errorText,
                        };

                        return (
                          <ToolInvocationCard
                            key={normalizedTool.id}
                            tool={normalizedTool}
                            className="w-full max-w-full sm:max-w-[88%] lg:max-w-[92%]"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Message Content */}
                {(textContent || fileParts.length > 0) && (
                  <div
                    className={cn(
                      "flex min-w-0 gap-3",
                      message.role === "user" && "flex-row-reverse",
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback
                        className={cn(
                          message.role === "user" &&
                            "bg-primary text-primary-foreground",
                          message.role !== "user" && "bg-muted text-foreground",
                        )}
                      >
                        {message.role === "user" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <Card
                      className={cn(
                        "w-full min-w-0 max-w-[80%] overflow-x-hidden break-words px-4 py-3 space-y-3 lg:max-w-[90%]",
                        message.role === "user" &&
                          "bg-primary text-primary-foreground border-primary/50 shadow-md",
                        message.role !== "user" &&
                          "bg-card border-border shadow-sm",
                      )}
                    >
                      <div
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-wide",
                          message.role === "user"
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {message.role === "user" ? "You" : "Assistant"}
                      </div>
                      {fileParts.length > 0 && (
                        <div className="space-y-2">
                          {fileParts.map((file, idx) => (
                            <div key={`${file.url}-${idx}`} className="space-y-2">
                              {file.mediaType.startsWith("image/") ? (
                                <div className="space-y-1">
                                  <img
                                    src={file.url}
                                    alt={file.filename || "Uploaded image"}
                                    className="max-h-64 w-full rounded-md border object-contain"
                                  />
                                  {file.filename && (
                                    <div className={cn(
                                      "text-xs text-muted-foreground",
                                      message.role === "user" && "text-primary-foreground/80"
                                    )}>
                                      {file.filename}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <a
                                  href={file.url}
                                  download={file.filename}
                                  className={cn(
                                    "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs",
                                    message.role === "user"
                                      ? "border-primary-foreground/30"
                                      : "border-border"
                                  )}
                                >
                                  <span className="truncate">
                                    {file.filename || "Attachment"}
                                  </span>
                                  <span className={cn(
                                    "text-muted-foreground",
                                    message.role === "user" && "text-primary-foreground/80"
                                  )}>
                                    {file.mediaType}
                                  </span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* If this is a research report with presentation blocks, render them */}
                      {presentation && message.role === "assistant" ? (
                        <ResearchPresentationView presentation={presentation} />
                      ) : (
                        <div className={cn(
                          "text-sm prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                          "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5",
                          "prose-headings:mt-2 prose-headings:mb-1 prose-headings:font-semibold prose-headings:break-words prose-headings:[overflow-wrap:anywhere]",
                          "prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:[overflow-wrap:anywhere] prose-pre:bg-muted prose-pre:text-foreground",
                          "prose-code:text-foreground [&_p]:break-words [&_li]:break-words [&_a]:break-all [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-all [&_pre_code]:[overflow-wrap:anywhere]",
                          message.role === "user" && "prose-invert"
                        )}>
                          <ReactMarkdown>{textContent}</ReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-muted text-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <Card className="px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Card>
            </div>
          )}

          {/* Research in-progress indicator */}
          {isResearchInProgress && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-muted text-foreground">
                  <Telescope className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <Card className="flex items-center gap-3 px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">Researching&hellip;</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {researchStatus.run.query}
                  </div>
                  {researchStatus.run.metrics && (
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {typeof researchStatus.run.metrics.phase === "string" && (
                        <span className="capitalize">{researchStatus.run.metrics.phase}</span>
                      )}
                      {typeof researchStatus.run.metrics.sourceCount === "number" && (
                        <span>{researchStatus.run.metrics.sourceCount} sources</span>
                      )}
                      {typeof researchStatus.run.metrics.findingCount === "number" && (
                        <span>{researchStatus.run.metrics.findingCount} findings</span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Research completed status badge (non-running terminal states) */}
          {researchStatus &&
            !isResearchInProgress &&
            (researchStatus.run.status === "completed" ||
              researchStatus.run.status === "completed_with_warnings" ||
              researchStatus.run.status === "failed") && (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              {researchStatus.run.status === "completed" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              ) : researchStatus.run.status === "completed_with_warnings" ? (
                <CircleAlert className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <CircleAlert className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className="capitalize">
                Research {researchStatus.run.status.replace(/_/g, " ")}
              </span>
              {researchStatus.sources.length > 0 && (
                <span>&middot; {researchStatus.sources.length} sources</span>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 border-t p-4 shrink-0"
      >
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
                setPendingFiles(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove attachment</span>
            </Button>
          </div>
        )}

        <div className="flex min-w-0 gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => setPendingFiles(e.target.files)}
            disabled={isLoading || isResearchLoading}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isResearchLoading}
            className="shrink-0"
          >
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Attach file</span>
          </Button>
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask me anything about your household... (Shift+Enter for a new line)"
            disabled={isLoading || isResearchLoading}
            rows={1}
            className="min-w-0 flex-1 min-h-[44px] max-h-40 resize-none"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void handleStartResearch()}
            disabled={isLoading || isResearchLoading || !inputValue.trim()}
            title="Deep Research"
            className="shrink-0"
          >
            {isResearchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Telescope className="h-4 w-4" />
            )}
            <span className="sr-only">Deep Research</span>
          </Button>
          <Button
            type="submit"
            disabled={
              isLoading ||
              isResearchLoading ||
              (!inputValue.trim() && !pendingFiles)
            }
            className="shrink-0 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/30 disabled:text-primary-foreground/70 disabled:opacity-100"
          >
            <Send className="h-4 w-4" />
            <span className="hidden text-sm font-medium sm:inline">Send</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

