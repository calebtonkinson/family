import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assessRunQuality,
  getSearchProviderOrder,
  selectSearchResults,
} from "./research-helpers.js";

describe("research helper quality scoring", () => {
  it("flags weak coverage and low sourcing", () => {
    const result = assessRunQuality({
      findings: [
        {
          id: "finding-1",
          subQuestion: "What is the best option?",
          claim: "Evidence is incomplete.",
          confidence: 0.2,
          status: "unknown",
          sourceIds: [],
          notes: "Fallback synthesis due to model error.",
        },
      ],
      sourceCount: 1,
      totalSubQuestions: 4,
      budget: {
        maxSteps: 8,
        maxRuntimeSeconds: 90,
        minSources: 4,
        maxRequeriesPerSubQuestion: 2,
      },
    });

    expect(result.score).toBeLessThan(0.5);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Only 1 sources were collected"),
        expect.stringContaining("Only 0/4 sub-questions were answered"),
        expect.stringContaining("used synthesis fallback"),
      ]),
    );
  });

  it("prefers trusted, non-duplicate recommendation sources", () => {
    const selected = selectSearchResults(
      [
        {
          url: "https://www.reddit.com/r/furniture/thread",
          title: "Best chair maybe",
          domain: "reddit.com",
          snippet: "Lots of opinions",
          publishedAt: null,
          score: 0.95,
          metadata: {},
        },
        {
          url: "https://www.wirecutter.com/reviews/best-reading-chair",
          title: "Best reading chairs",
          domain: "wirecutter.com",
          snippet: "Reviewed and tested options for reading chairs with support and comfort.",
          publishedAt: null,
          score: 0.6,
          metadata: {},
        },
        {
          url: "https://www.wirecutter.com/reviews/best-reading-chair-2",
          title: "Another chair guide",
          domain: "wirecutter.com",
          snippet: "A second guide from the same domain.",
          publishedAt: null,
          score: 0.55,
          metadata: {},
        },
      ],
      new Set<string>(),
      "best reading chair under $500",
      "Which options are best supported by evidence?",
      3,
    );

    expect(selected[0]?.domain).toBe("wirecutter.com");
    expect(selected.every((item) => item.domain !== "reddit.com")).toBe(true);
    expect(selected).toHaveLength(2);
  });
});

describe("research provider selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to duckduckgo when provider keys are unavailable", () => {
    vi.stubEnv("RESEARCH_SEARCH_PROVIDER_ORDER", "openai,anthropic,google,duckduckgo");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GOOGLE_AI_API_KEY", "");

    expect(getSearchProviderOrder()).toEqual(["duckduckgo"]);
  });
});
