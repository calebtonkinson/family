import { describe, expect, it } from "vitest";
import {
  buildFallbackConversationTitle,
  extractTitleSource,
  sanitizeConversationTitle,
} from "./conversation-title";

describe("conversation title helpers", () => {
  it("strips attachment-only lines from the title source", () => {
    expect(
      extractTitleSource("Show me a dinner plan\n\nAttachment: menu.jpg"),
    ).toBe("Show me a dinner plan");
  });

  it("removes chatty prefixes in the fallback title", () => {
    expect(
      buildFallbackConversationTitle("Can you show me my tasks for today?"),
    ).toBe("My tasks for today");
  });

  it("sanitizes quotes and punctuation from generated titles", () => {
    expect(sanitizeConversationTitle('"Dinner plan for next week."')).toBe(
      "Dinner plan for next week",
    );
  });
});
