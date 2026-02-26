"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type UIMessage } from "@ai-sdk/react";
import { apiClient } from "@/lib/api-client";
import { Chat } from "@/components/chat";

function convertMessagesToUI(conversation: {
  messages: Array<{
    id: string;
    role: string;
    content: string | null;
    rawMessage?: Record<string, unknown> | null;
    toolCalls?: Array<{
      toolCallId: string;
      toolName: string;
      toolInput: Record<string, unknown>;
    }>;
  }>;
  toolResults?: Record<string, { result: unknown; isError: boolean | null }>;
}): UIMessage[] {
  const toolResults = conversation.toolResults || {};

  return conversation.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const rawParts = Array.isArray(
        (m.rawMessage as Record<string, unknown> | null)?.parts,
      )
        ? (m.rawMessage as Record<string, unknown>).parts
        : null;
      const textParts =
        rawParts && (rawParts as unknown[]).length > 0
          ? rawParts
          : m.content && m.content.trim()
            ? [{ type: "text" as const, text: m.content }]
            : [];

      const toolParts = (m.toolCalls || []).map((toolCall) => {
        const result = toolResults[toolCall.toolCallId];
        if (result?.isError) {
          return {
            type: `tool-${toolCall.toolName}`,
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            input: toolCall.toolInput,
            errorText:
              typeof result.result === "string"
                ? result.result
                : "Tool execution failed",
          };
        }
        if (result) {
          return {
            type: `tool-${toolCall.toolName}`,
            toolCallId: toolCall.toolCallId,
            state: "output-available",
            input: toolCall.toolInput,
            output: result.result,
          };
        }
        return {
          type: `tool-${toolCall.toolName}`,
          toolCallId: toolCall.toolCallId,
          state: "input-available",
          input: toolCall.toolInput,
        };
      });

      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [
          ...(textParts as {
            type: string;
            text?: string;
            url?: string;
            mediaType?: string;
            filename?: string;
          }[]),
          ...toolParts,
        ],
      };
    })
    .filter((m) => m.parts.length > 0) as UIMessage[];
}

export default function ChatConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [initialResearchRun, setInitialResearchRun] = useState<Awaited<
    ReturnType<typeof apiClient.getResearchRun>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queuedInitialMessage] = useState<string | null>(() => searchParams.get("q"));
  const [hasRemovedQueuedParam, setHasRemovedQueuedParam] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        const [result, runsResult] = await Promise.all([
          apiClient.getConversation(params.id),
          apiClient.listResearchRuns(params.id).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;

        if (runsResult.data.length > 0) {
          const latestRun = runsResult.data[0];
          if (latestRun?.id) {
            const runStatus = await apiClient
              .getResearchRun(params.id, latestRun.id)
              .catch(() => null);
            if (!cancelled) {
              setInitialResearchRun(runStatus);
            }
          }
        }

        setInitialMessages(convertMessagesToUI(result.data));
      } catch (error) {
        console.error("Failed to load conversation:", error);
        if (!cancelled) router.push("/chat");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id, router]);

  useEffect(() => {
    if (!queuedInitialMessage || hasRemovedQueuedParam) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("q");
    const nextQuery = nextParams.toString();
    setHasRemovedQueuedParam(true);
    router.replace(nextQuery ? `/chat/${params.id}?${nextQuery}` : `/chat/${params.id}`);
  }, [queuedInitialMessage, hasRemovedQueuedParam, searchParams, params.id, router]);

  if (isLoading || !initialMessages) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Chat */}
      <div className="min-h-0 flex-1">
        <Chat
          key={params.id}
          conversationId={params.id}
          initialMessages={initialMessages}
          initialResearchStatus={initialResearchRun}
          initialPendingMessage={queuedInitialMessage}
        />
      </div>
    </div>
  );
}
