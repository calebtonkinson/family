import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const generatedConversationTitleSchema = z.object({
  title: z.string().min(3).max(60),
});

const leadingPromptPhrases = [
  /^please\s+/i,
  /^(can|could|would|will)\s+you\s+/i,
  /^help\s+me\s+(?:with\s+)?/i,
  /^i\s+need\s+(?:help\s+with\s+)?/i,
  /^show\s+me\s+/i,
  /^tell\s+me\s+/i,
  /^give\s+me\s+/i,
  /^create\s+(?:me\s+)?/i,
  /^make\s+(?:me\s+)?/i,
  /^list\s+/i,
  /^find\s+/i,
];

function getModel(provider: "anthropic" | "openai" | "google", modelName: string) {
  switch (provider) {
    case "anthropic":
      return anthropic(modelName);
    case "google":
      return google(modelName);
    case "openai":
      return openai.chat(modelName);
    default:
      return openai.chat("gpt-4o");
  }
}

function truncateTitle(value: string) {
  return value.length <= 60 ? value : `${value.slice(0, 57).trimEnd()}...`;
}

export function extractTitleSource(message: string) {
  const cleaned = message
    .replace(/^🔭\s*/u, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("Attachment:"))
    .join(" ");

  return cleaned.replace(/\s+/g, " ").trim();
}

export function sanitizeConversationTitle(value: string) {
  const sanitized = value
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return "";
  return truncateTitle(`${sanitized.charAt(0).toUpperCase()}${sanitized.slice(1)}`);
}

export function buildFallbackConversationTitle(message: string) {
  const source = extractTitleSource(message);
  if (!source) return null;

  let normalized = source;
  for (const pattern of leadingPromptPhrases) {
    normalized = normalized.replace(pattern, "");
  }

  normalized = normalized
    .replace(/^(what(?:'s|\s+is)\s+)/i, "")
    .replace(/^(how\s+(?:do|can)\s+i\s+)/i, "")
    .replace(/^(is\s+there\s+)/i, "")
    .trim();

  const fallback = normalized || source;
  const words = fallback.split(/\s+/).filter(Boolean);
  const shortened = words.length > 8 ? words.slice(0, 8).join(" ") : fallback;

  return sanitizeConversationTitle(shortened);
}

export async function generateConversationTitle(input: {
  provider: "anthropic" | "openai" | "google";
  modelName: string;
  userMessage: string;
  assistantMessage?: string | null;
}) {
  const titleSource = extractTitleSource(input.userMessage);
  if (!titleSource) return null;

  const fallbackTitle = buildFallbackConversationTitle(titleSource);
  if (!fallbackTitle) return null;

  try {
    const { object } = await generateObject({
      model: getModel(input.provider, input.modelName),
      schema: generatedConversationTitleSchema,
      prompt: [
        "Write a concise conversation title for this household assistant thread.",
        "Requirements:",
        "- 3 to 7 words when possible",
        "- sentence case",
        "- specific to the user's goal",
        "- no quotes, punctuation suffixes, or generic labels like 'Help request'",
        "",
        `User message: ${titleSource}`,
        input.assistantMessage?.trim()
          ? `Assistant response: ${input.assistantMessage.trim().slice(0, 240)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const generatedTitle = sanitizeConversationTitle(object.title);
    return generatedTitle || fallbackTitle;
  } catch (error) {
    console.error("[AI] Failed to generate conversation title:", error);
    return fallbackTitle;
  }
}
