import { generateObject, generateText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { db } from "@home/db";
import {
  conversations,
  conversationMessages,
  researchRuns,
  researchSources,
  researchFindings,
  researchReports,
  researchRunEvents,
  tasks,
  conversationLinks,
} from "@home/db/schema";
import {
  createResearchPlanSchema,
  runResearchSchema,
  createResearchTasksSchema,
  researchPlanSchema,
  researchPresentationSchema,
  type CreateResearchPlanInput,
  type ResearchEffort,
  type ResearchPlan,
  type RunResearchInput,
  type CreateResearchTasksInput,
  type ResearchPresentation,
} from "@home/shared";
import {
  buildDeepResearchPlanPrompt,
  buildDeepResearchExecutionPrompt,
  buildDeepResearchPresentationPrompt,
  searchWeb,
  fetchSource,
  extractEvidence,
  normalizeAnthropicWebSearchOutput,
  type ResearchSearchResult,
} from "@home/ai";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

type RunStatus =
  | "planning"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "canceled";

export interface ResearchBudget {
  maxSteps: number;
  maxRuntimeSeconds: number;
  minSources: number;
  maxRequeriesPerSubQuestion: number;
}

const EFFORT_BUDGETS: Record<ResearchEffort, ResearchBudget> = {
  quick: {
    maxSteps: 4,
    maxRuntimeSeconds: 30,
    minSources: 2,
    maxRequeriesPerSubQuestion: 1,
  },
  standard: {
    maxSteps: 8,
    maxRuntimeSeconds: 90,
    minSources: 4,
    maxRequeriesPerSubQuestion: 2,
  },
  deep: {
    maxSteps: 12,
    maxRuntimeSeconds: 180,
    minSources: 6,
    maxRequeriesPerSubQuestion: 3,
  },
};

const executionOutputSchema = z.object({
  findings: z.array(
    z.object({
      claim: z.string().min(1),
      confidence: z.number().min(0).max(1),
      sourceIds: z.array(z.string()).min(1),
      status: z.enum(["partial", "sufficient", "conflicted", "unknown"]),
      notes: z.string(),
    }),
  ),
  unknowns: z.array(z.string().min(1)),
  actions: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string(),
      relatedFindingSourceIds: z.array(z.string()),
    }),
  ),
});

const runEventStatusSchema = z.enum([
  "started",
  "progress",
  "completed",
  "failed",
  "info",
]);

type SynthesisResult = z.infer<typeof executionOutputSchema> & {
  fallbackUsed: boolean;
  fallbackReason?: string;
};

type FindingSummary = {
  id: string;
  subQuestion: string;
  claim: string;
  confidence: number;
  status: string;
  sourceIds: string[];
  evidence: FindingEvidence[];
  notes: string | null;
};

type QualityAssessment = {
  score: number;
  warnings: string[];
  fallbackFindingCount: number;
  unknownFindingCount: number;
  sourcedFindingCount: number;
  multiSourceFindingCount: number;
  answeredSubQuestionCount: number;
};

type FindingEvidence = {
  sourceId: string;
  excerpt: string | null;
  relevanceScore: number;
  url: string;
  title: string | null;
};

type RunEventStatus = z.infer<typeof runEventStatusSchema>;

type SearchProvider = "anthropic" | "openai" | "google" | "duckduckgo";

type SubQuestionExecutionResult = {
  subQuestion: string;
  stepCount: number;
  sourceCount: number;
  findingCount: number;
  findings: Array<{
    id: string;
    sourceIds: string[];
    evidence: FindingEvidence[];
  }>;
  unknowns: string[];
  actions: Array<{ title: string; description?: string; relatedFindingIds?: string[] }>;
  warnings: string[];
};

type FinalReportSynthesis = {
  executiveSummary: string;
  plainTextReport: string;
};

const finalReportSynthesisSchema = z.object({
  executiveSummary: z.string().min(1),
  plainTextReport: z.string().min(1),
});

function dedupeSearchResults(
  results: ResearchSearchResult[],
  limit: number,
): ResearchSearchResult[] {
  const seen = new Set<string>();
  const deduped: ResearchSearchResult[] = [];

  for (const result of results) {
    if (!result.url || seen.has(result.url)) continue;
    seen.add(result.url);
    deduped.push(result);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

function collectToolOutputs(
  value: unknown,
  toolNames: string[],
): unknown[] {
  const outputs: unknown[] = [];

  if (!value || typeof value !== "object") {
    return outputs;
  }

  const record = value as {
    steps?: Array<{
      toolResults?: Array<{
        toolName?: string;
        output?: unknown;
      }>;
    }>;
    toolResults?: Array<{
      toolName?: string;
      output?: unknown;
    }>;
    sources?: unknown;
  };

  if (record.sources) {
    outputs.push(record.sources);
  }

  for (const result of record.toolResults || []) {
    if (!result) continue;
    if (result.toolName && !toolNames.includes(result.toolName)) continue;
    outputs.push(result.output);
  }

  for (const step of record.steps || []) {
    for (const result of step.toolResults || []) {
      if (!result) continue;
      if (result.toolName && !toolNames.includes(result.toolName)) continue;
      outputs.push(result.output);
    }
  }

  return outputs;
}

function getSearchProviderOrder(): SearchProvider[] {
  const configured = process.env.RESEARCH_SEARCH_PROVIDER_ORDER
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean) || ["anthropic", "openai", "google", "duckduckgo"];

  const available = new Set<SearchProvider>();
  if (process.env.ANTHROPIC_API_KEY) available.add("anthropic");
  if (process.env.OPENAI_API_KEY) available.add("openai");

  const googleKey = process.env.GOOGLE_AI_API_KEY?.trim();
  if (googleKey && !googleKey.startsWith("your-google-ai-api-key")) {
    available.add("google");
  }

  available.add("duckduckgo");

  const order: SearchProvider[] = [];
  for (const provider of configured) {
    if (
      (provider === "anthropic" ||
        provider === "openai" ||
        provider === "google" ||
        provider === "duckduckgo") &&
      available.has(provider)
    ) {
      order.push(provider);
    }
  }

  if (order.length === 0) {
    return ["duckduckgo"];
  }

  return order;
}

function rotateProviders(
  providers: SearchProvider[],
  subQuestionIndex: number,
  retry: number,
): SearchProvider[] {
  if (providers.length <= 1) return providers;
  const offset = (subQuestionIndex + retry) % providers.length;
  return [...providers.slice(offset), ...providers.slice(0, offset)];
}

function normalizeSdkSources(
  sources: unknown,
  provider: string,
): ResearchSearchResult[] {
  if (!Array.isArray(sources)) return [];

  const out: ResearchSearchResult[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const row = source as {
      sourceType?: string;
      url?: string;
      title?: string;
      providerMetadata?: Record<string, unknown>;
    };
    if (row.sourceType !== "url" || !row.url || seen.has(row.url)) continue;
    seen.add(row.url);
    out.push({
      url: row.url,
      title: row.title || null,
      domain: (() => {
        try {
          return new URL(row.url).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })(),
      snippet: null,
      publishedAt: null,
      score: null,
      metadata: {
        provider,
        providerMetadata: row.providerMetadata,
      },
    });
  }

  return out;
}

async function searchWebViaProvider(params: {
  provider: SearchProvider;
  query: string;
  recencyDays: number | null;
  limit: number;
}): Promise<ResearchSearchResult[]> {
  if (params.provider === "duckduckgo") {
    try {
      return await searchWeb(params.query, params.recencyDays, params.limit);
    } catch (error) {
      console.error("[Research] DuckDuckGo web search failed:", error);
      return [];
    }
  }

  const recencyInstruction = params.recencyDays
    ? `Prefer sources from the last ${params.recencyDays} days when possible.`
    : "Use the most relevant current sources.";

  if (params.provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `Run a web search for this query and return sources only: ${params.query}. ${recencyInstruction}`,
        tools: {
          web_search: anthropic.tools.webSearch_20250305({
            maxUses: 1,
          }),
        },
        toolChoice: { type: "tool", toolName: "web_search" },
        stopWhen: stepCountIs(1),
      });

      const outputs = collectToolOutputs(result, ["web_search"]);
      const parsed = [
        ...normalizeSdkSources(result.sources, "anthropic_native_web_search"),
        ...outputs.flatMap((output) =>
          normalizeAnthropicWebSearchOutput(output),
        ),
      ];
      const deduped = dedupeSearchResults(parsed, params.limit);
      if (deduped.length > 0) {
        return deduped.map((item) => ({
          ...item,
          metadata: {
            ...(item.metadata || {}),
            provider: "anthropic_native_web_search",
          },
        }));
      }
    } catch (error) {
      console.error("[Research] Anthropic native web search failed:", error);
    }
  }

  if (params.provider === "openai" && process.env.OPENAI_API_KEY) {
    try {
      const result = await generateText({
        model: openai(process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5"),
        prompt: `Run a web search for this query and return high-quality sources only: ${params.query}. ${recencyInstruction}`,
        tools: {
          web_search: openai.tools.webSearch({
            externalWebAccess: true,
            searchContextSize: "high",
          }),
        },
        toolChoice: { type: "tool", toolName: "web_search" },
        stopWhen: stepCountIs(1),
      });

      const outputs = collectToolOutputs(result, ["web_search", "web_search_preview"]);
      const parsed = [
        ...normalizeSdkSources(result.sources, "openai_native_web_search"),
        ...outputs.flatMap((output) =>
          normalizeAnthropicWebSearchOutput(output),
        ),
      ];
      const deduped = dedupeSearchResults(parsed, params.limit);
      if (deduped.length > 0) {
        return deduped.map((item) => ({
          ...item,
          metadata: {
            ...(item.metadata || {}),
            provider: "openai_native_web_search",
          },
        }));
      }
    } catch (error) {
      console.error("[Research] OpenAI native web search failed:", error);
    }
  }

  if (params.provider === "google") {
    const googleKey = process.env.GOOGLE_AI_API_KEY?.trim();
    if (!googleKey || googleKey.startsWith("your-google-ai-api-key")) {
      return [];
    }

    try {
      const result = await generateText({
        model: google(process.env.GOOGLE_WEB_SEARCH_MODEL || "gemini-2.5-flash"),
        prompt: `Run a Google web search for this query and return high-quality sources only: ${params.query}. ${recencyInstruction}`,
        tools: {
          google_search: google.tools.googleSearch({ mode: "MODE_UNSPECIFIED" }),
        },
        toolChoice: { type: "tool", toolName: "google_search" },
        stopWhen: stepCountIs(1),
      });

      const outputs = collectToolOutputs(result, ["google_search"]);
      const parsed = [
        ...normalizeSdkSources(result.sources, "google_native_web_search"),
        ...outputs.flatMap((output) =>
          normalizeAnthropicWebSearchOutput(output),
        ),
      ];
      const deduped = dedupeSearchResults(parsed, params.limit);
      if (deduped.length > 0) {
        return deduped.map((item) => ({
          ...item,
          metadata: {
            ...(item.metadata || {}),
            provider: "google_native_web_search",
          },
        }));
      }
    } catch (error) {
      console.error("[Research] Google native web search failed:", error);
    }
  }

  return [];
}

async function searchWebBalanced(params: {
  query: string;
  recencyDays: number | null;
  limit: number;
  subQuestionIndex: number;
  retry: number;
}): Promise<ResearchSearchResult[]> {
  const providerOrder = rotateProviders(
    getSearchProviderOrder(),
    params.subQuestionIndex,
    params.retry,
  );

  const combined: ResearchSearchResult[] = [];

  for (const provider of providerOrder) {
    const rows = await searchWebViaProvider({
      provider,
      query: params.query,
      recencyDays: params.recencyDays,
      limit: params.limit,
    });

    if (rows.length > 0) {
      combined.push(...rows);
    }

    const deduped = dedupeSearchResults(combined, params.limit);
    if (deduped.length >= Math.min(params.limit, 6)) {
      return deduped;
    }
  }

  return dedupeSearchResults(combined, params.limit);
}

const plannerGenerationSchema = z.object({
  objective: z.string().min(1).max(500),
  subQuestions: z.array(z.string().min(1).max(500)).min(3).max(8),
  assumptions: z.array(z.string().min(1).max(500)).max(20),
  outputFormat: z.string().min(1).max(500),
  effortRationale: z.string().min(1).max(1500),
  stopCriteria: z.object({
    confidenceTarget: z.number().min(0).max(1),
    diminishingReturnsDelta: z.number().min(0).max(1),
    diminishingReturnsWindow: z.number().int().min(1).max(5),
  }),
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function getBudget(effort: ResearchEffort): ResearchBudget {
  return EFFORT_BUDGETS[effort] ?? EFFORT_BUDGETS.standard;
}

function buildFallbackSubQuestions(query: string): string[] {
  const trimmed = query.trim();
  const prefix = trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;

  return [
    `What is the current state of ${prefix}?`,
    `What are the most credible recent sources about ${prefix}?`,
    `What evidence supports or contradicts key claims about ${prefix}?`,
    `What open questions still remain for ${prefix}?`,
  ];
}

function fallbackPlan(input: CreateResearchPlanInput, budget: ResearchBudget): ResearchPlan {
  return {
    objective: `Research ${input.query.trim()} and produce evidence-backed conclusions.`,
    subQuestions: buildFallbackSubQuestions(input.query).slice(0, 8),
    assumptions: [
      "Publicly available web sources are representative of current information.",
      "Recent reporting may be incomplete for rapidly changing topics.",
    ],
    outputFormat: "Executive summary, findings with citations, unknowns, suggested actions, and source list.",
    effortRationale: `Using ${input.effort ?? "standard"} effort with budget ${budget.maxSteps} steps / ${budget.maxRuntimeSeconds}s.`,
    stopCriteria: {
      confidenceTarget: 0.75,
      diminishingReturnsDelta: 0.05,
      diminishingReturnsWindow: 2,
    },
  };
}

function pickModel() {
  if (process.env.OPENAI_API_KEY) {
    return openai.chat("gpt-4o-mini");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic("claude-sonnet-4-20250514");
  }
  return null;
}

type PlanGenerationResult = {
  plan: ResearchPlan | null;
  failureReason: string | null;
};

async function generatePlanWithModel(
  input: CreateResearchPlanInput,
  budget: ResearchBudget,
): Promise<PlanGenerationResult> {
  const model = pickModel();
  if (!model) {
    return {
      plan: null,
      failureReason: "No planner model/API key is configured on the server.",
    };
  }

  try {
    const { object } = await generateObject({
      model,
      schema: plannerGenerationSchema,
      prompt: buildDeepResearchPlanPrompt({
        query: input.query,
        effort: input.effort ?? "standard",
        recencyDays: input.recencyDays ?? null,
        budget,
      }),
    });

    const parsed = plannerGenerationSchema.parse(object);

    return {
      plan: researchPlanSchema.parse(parsed),
      failureReason: null,
    };
  } catch (error) {
    console.error("[Research] Plan generation failed, falling back:", error);
    const message = error instanceof Error ? error.message : "Unknown planner generation error";
    return {
      plan: null,
      failureReason: message,
    };
  }
}

function normalizePlan(plan: ResearchPlan, query: string): ResearchPlan {
  const objective = plan.objective.trim() || `Research ${query}`;
  const subQuestions = plan.subQuestions
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);

  const finalSubQuestions = subQuestions.length >= 3
    ? subQuestions
    : buildFallbackSubQuestions(query).slice(0, 4);

  return {
    ...plan,
    objective,
    subQuestions: finalSubQuestions,
    assumptions: plan.assumptions.map((value) => value.trim()).filter(Boolean),
  };
}

function buildSearchQuery(query: string, subQuestion: string, retry: number): string {
  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  const budgetMatch =
    normalizedQuery.match(/under\s+\$?\s*(\d{2,5})/i) ||
    normalizedQuery.match(/budget(?:\s+is|\s+of)?\s+\$?\s*(\d{2,5})/i) ||
    normalizedQuery.match(/\$+\s*(\d{2,5})/);
  const budgetHint = budgetMatch?.[1] ? `under $${budgetMatch[1]}` : "";

  const queryLower = normalizedQuery.toLowerCase();
  const intentTerms = [
    queryLower.includes("chair and a half") ? "\"chair and a half\"" : null,
    queryLower.includes("chaise") ? "chaise lounge" : null,
    queryLower.includes("cuddle") ? "cuddle chair" : null,
    queryLower.includes("reading") ? "reading chair" : null,
    queryLower.includes("bedroom") ? "bedroom" : null,
    "oversized chair",
  ]
    .filter((term): term is string => Boolean(term))
    .slice(0, 5)
    .join(" ");

  const exclusions = "-office -desk -gaming -computer";

  const variants = [
    `${subQuestion} ${intentTerms} ${budgetHint} ${exclusions}`.trim(),
    `${intentTerms} ${budgetHint} product dimensions materials comfort reviews ${subQuestion} ${exclusions}`.trim(),
    `${intentTerms} ${budgetHint} top options with specs and verified customer reviews ${subQuestion} ${exclusions}`.trim(),
  ];

  const selected = variants[Math.min(retry, variants.length - 1)] || variants[0] || subQuestion;
  return selected.slice(0, 320);
}

const TRUSTED_SOURCE_DOMAINS = new Set([
  "nytimes.com",
  "wirecutter.com",
  "consumerreports.org",
  "goodhousekeeping.com",
  "bhg.com",
  "wayfair.com",
  "allmodern.com",
  "crateandbarrel.com",
  "potterybarn.com",
  "westelm.com",
  "ikea.com",
  "article.com",
  "livingspaces.com",
]);

const LOW_QUALITY_DOMAIN_PATTERNS = [
  /blogspot\./i,
  /wordpress\./i,
  /aromatherapy/i,
  /chairlines/i,
  /zorkafurniture/i,
];

const RECOMMENDATION_QUERY_HINTS = [
  "best",
  "recommend",
  "options",
  "buy",
  "budget",
  "under $",
  "price",
  "review",
  "compare",
];

const LOW_SIGNAL_RECOMMENDATION_DOMAINS = new Set([
  "pinterest.com",
  "reddit.com",
]);

function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return domain.toLowerCase().replace(/^www\./, "");
}

function textContainsAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(term));
}

function isRecommendationQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return RECOMMENDATION_QUERY_HINTS.some((term) => lower.includes(term));
}

function isSearchLandingPage(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("/search?") ||
    lower.includes("keyword.php") ||
    lower.includes("?keyword=") ||
    lower.includes("/ideas/")
  );
}

function scoreSearchResult(
  result: ResearchSearchResult,
  query: string,
  subQuestion: string,
): number {
  let score = typeof result.score === "number" ? clamp(result.score, 0, 1) : 0.35;

  const domain = normalizeDomain(result.domain);
  const title = (result.title || "").toLowerCase();
  const snippet = (result.snippet || "").toLowerCase();
  const url = result.url.toLowerCase();
  const combined = `${title} ${snippet}`.trim();
  const context = `${query} ${subQuestion}`.toLowerCase();

  if (domain && TRUSTED_SOURCE_DOMAINS.has(domain)) {
    score += 0.2;
  }

  if (domain && LOW_QUALITY_DOMAIN_PATTERNS.some((pattern) => pattern.test(domain))) {
    score -= 0.35;
  }

  if (isSearchLandingPage(url)) {
    score -= 0.3;
  }

  if (
    textContainsAny(combined, ["office chair", "gaming chair", "desk chair", "computer chair"]) &&
    !textContainsAny(context, ["office", "gaming", "desk", "computer"])
  ) {
    score -= 0.45;
  }

  if (textContainsAny(combined, ["chair and a half", "chaise", "cuddle", "oversized", "bedroom", "reading"])) {
    score += 0.15;
  }

  if (textContainsAny(combined, ["top 10", "top 20", "best of", "sponsored"])) {
    score -= 0.1;
  }

  if (result.snippet && result.snippet.length > 40) {
    score += 0.05;
  }

  return clamp(score, 0, 1);
}

function selectSearchResults(
  results: ResearchSearchResult[],
  seenUrls: Set<string>,
  query: string,
  subQuestion: string,
  limit: number,
): Array<ResearchSearchResult & { qualityScore: number }> {
  const recommendationMode = isRecommendationQuery(query);

  const scored = results
    .filter((row) => row.url && !seenUrls.has(row.url))
    .map((row) => ({
      ...row,
      qualityScore: scoreSearchResult(row, query, subQuestion),
    }))
    .sort((a, b) => b.qualityScore - a.qualityScore);

  const selected: Array<ResearchSearchResult & { qualityScore: number }> = [];
  const domainCounts = new Map<string, number>();

  for (const candidate of scored) {
    const domain = normalizeDomain(candidate.domain) || "unknown";
    const existing = domainCounts.get(domain) || 0;
    if (existing >= 2) continue;
    if (recommendationMode && LOW_SIGNAL_RECOMMENDATION_DOMAINS.has(domain)) continue;
    if (recommendationMode && isSearchLandingPage(candidate.url)) continue;
    if (candidate.qualityScore < (recommendationMode ? 0.45 : 0.3)) continue;

    selected.push(candidate);
    domainCounts.set(domain, existing + 1);

    if (selected.length >= limit) break;
  }

  // If strict quality filtering removed everything, fall back to best available.
  if (selected.length === 0) {
    return scored.slice(0, limit);
  }

  return selected;
}

function assessRunQuality(input: {
  findings: FindingSummary[];
  sourceCount: number;
  totalSubQuestions: number;
  budget: ResearchBudget;
}): QualityAssessment {
  const fallbackFindingCount = input.findings.filter((finding) =>
    (finding.notes || "").toLowerCase().includes("fallback synthesis due to model error"),
  ).length;

  const unknownFindingCount = input.findings.filter(
    (finding) => finding.status === "unknown" || finding.confidence < 0.35,
  ).length;

  const sourcedFindings = input.findings.filter((finding) => finding.sourceIds.length > 0);
  const sourcedFindingCount = sourcedFindings.length;
  const multiSourceFindingCount = sourcedFindings.filter(
    (finding) => finding.sourceIds.length >= 2,
  ).length;

  const answeredSubQuestionCount = new Set(
    sourcedFindings
      .filter((finding) => finding.status !== "unknown")
      .map((finding) => finding.subQuestion),
  ).size;

  const warnings: string[] = [];
  const minExpectedSources = Math.max(3, Math.min(input.budget.minSources, 6));
  if (input.sourceCount < minExpectedSources) {
    warnings.push(
      `Only ${input.sourceCount} sources were collected; expected at least ${minExpectedSources} for this effort level.`,
    );
  }

  const minAnsweredSubQuestions = Math.max(2, Math.ceil(input.totalSubQuestions * 0.5));
  if (answeredSubQuestionCount < minAnsweredSubQuestions) {
    warnings.push(
      `Only ${answeredSubQuestionCount}/${input.totalSubQuestions} sub-questions were answered with cited evidence.`,
    );
  }

  if (multiSourceFindingCount === 0 && sourcedFindingCount > 0) {
    warnings.push("No findings were corroborated by at least two independent sources.");
  }

  if (fallbackFindingCount > 0) {
    warnings.push(
      `${fallbackFindingCount} finding(s) used synthesis fallback due to model output errors.`,
    );
  }

  if (input.findings.length > 0 && unknownFindingCount / input.findings.length > 0.5) {
    warnings.push("More than half of findings remained unknown or low-confidence.");
  }

  const coverageScore = input.totalSubQuestions > 0
    ? answeredSubQuestionCount / input.totalSubQuestions
    : 0;
  const corroborationScore = sourcedFindingCount > 0
    ? multiSourceFindingCount / sourcedFindingCount
    : 0;
  const unknownPenalty = input.findings.length > 0
    ? unknownFindingCount / input.findings.length
    : 1;
  const warningPenalty = Math.min(1, warnings.length * 0.12);

  const score = clamp(
    coverageScore * 0.45 +
      corroborationScore * 0.25 +
      (1 - unknownPenalty) * 0.2 +
      Math.min(1, input.sourceCount / Math.max(input.budget.minSources, 1)) * 0.1 -
      warningPenalty,
    0,
    1,
  );

  return {
    score,
    warnings,
    fallbackFindingCount,
    unknownFindingCount,
    sourcedFindingCount,
    multiSourceFindingCount,
    answeredSubQuestionCount,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  onResult?: (result: R, index: number) => Promise<void> | void,
): Promise<R[]> {
  if (items.length === 0) return [];

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        const mapped = await mapper(items[index]!, index);
        results[index] = mapped;
        if (onResult) {
          await onResult(mapped, index);
        }
      }
    }),
  );

  return results;
}

function buildReportMarkdown(input: {
  summary: string;
  findings: FindingSummary[];
  unknowns: string[];
  actions: Array<{ title: string; description?: string; relatedFindingIds?: string[] }>;
  sources: Array<{ id: string; title: string | null; url: string }>;
  qualityWarnings?: string[];
  analystNarrative?: string | null;
}): string {
  const sourceMap = new Map(input.sources.map((source) => [source.id, source]));

  const qualitySection = (input.qualityWarnings || []).length > 0
    ? [
        "## Quality warnings",
        ...(input.qualityWarnings || []).map((warning, index) => `${index + 1}. ${warning}`),
        "",
      ].join("\n")
    : "";

  const findingsSection = input.findings.length > 0
    ? input.findings
        .map((finding, index) => {
          const citations = finding.sourceIds.length > 0
            ? finding.sourceIds.map((sourceId) => `[${sourceId}]`).join(", ")
            : "No citations";
          const evidenceLines = finding.evidence
            .slice(0, 2)
            .map((evidence) => {
              const excerpt = evidence.excerpt?.replace(/\s+/g, " ").trim() || "No excerpt captured.";
              return `   - Evidence [${evidence.sourceId}]: "${excerpt.slice(0, 220)}"`;
            });

          return [
            `${index + 1}. **${finding.subQuestion}**`,
            `   - Claim: ${finding.claim}`,
            `   - Confidence: ${finding.confidence.toFixed(2)} (${finding.status})`,
            `   - Citations: ${citations}`,
            ...evidenceLines,
            finding.notes ? `   - Notes: ${finding.notes}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n")
    : "No findings were generated.";

  const unknownSection = input.unknowns.length > 0
    ? input.unknowns.map((unknown, index) => `${index + 1}. ${unknown}`).join("\n")
    : "No explicit unknowns recorded.";

  const actionSection = input.actions.length > 0
    ? input.actions
        .map((action, index) => `${index + 1}. ${action.title}${action.description ? ` - ${action.description}` : ""}`)
        .join("\n")
    : "No suggested actions.";

  const sourceSection = input.sources.length > 0
    ? input.sources
        .map((source) => {
          const label = source.title || source.url;
          return `- [${source.id}] [${label}](${source.url})`;
        })
        .join("\n")
    : "No sources collected.";

  return [
    "## Executive summary",
    input.summary,
    "",
    qualitySection,
    ...(input.analystNarrative
      ? [
          "## Analyst synthesis",
          input.analystNarrative,
          "",
        ]
      : []),
    "## Findings",
    findingsSection,
    "",
    "## Unknowns / evidence gaps",
    unknownSection,
    "",
    "## Suggested next actions",
    actionSection,
    "",
    "## Source list",
    sourceSection,
  ].join("\n");
}

function summarizeFindings(findings: Array<{ claim: string; confidence: number }>): string {
  if (findings.length === 0) {
    return "Research run completed with limited evidence; additional sources are recommended.";
  }

  const highConfidence = findings.filter((finding) => finding.confidence >= 0.75).length;
  return `Completed research with ${findings.length} findings (${highConfidence} high-confidence).`;
}

function buildChatReportMessage(input: {
  query: string;
  summary: string;
  findings: FindingSummary[];
  unknowns: string[];
  actions: Array<{ title: string; description?: string }>;
  sources: Array<{ id: string; title: string | null; url: string; domain: string | null }>;
  qualityWarnings?: string[];
  analystNarrative?: string | null;
}): string {
  const topFindings = input.findings.slice(0, 4);
  const topUnknowns = input.unknowns.slice(0, 3);
  const topActions = input.actions.slice(0, 4);
  const topSources = input.sources.slice(0, 8);
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));

  const findingsSection = topFindings.length > 0
    ? topFindings
        .map((finding, index) => {
          const confidence = `${Math.round(finding.confidence * 100)}%`;
          const citations = finding.sourceIds
            .slice(0, 3)
            .map((sourceId) => {
              const source = sourceById.get(sourceId);
              if (!source) return `[${sourceId}]`;
              const label = source.domain || source.title || sourceId;
              return `[${label}](${source.url})`;
            })
            .join(", ");
          const evidence = finding.evidence
            .slice(0, 1)
            .map((item) => item.excerpt?.replace(/\s+/g, " ").trim())
            .filter((value): value is string => Boolean(value))
            .map((value) => `"${value.slice(0, 180)}"`)
            .join(" ");

          return [
            `${index + 1}. ${finding.claim}`,
            `   - Confidence: ${confidence} (${finding.status})`,
            citations ? `   - Sources: ${citations}` : "",
            evidence ? `   - Evidence: ${evidence}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n")
    : "No strong findings were produced.";

  const unknownsSection = topUnknowns.length > 0
    ? topUnknowns.map((unknown) => `- ${unknown}`).join("\n")
    : "- No explicit unknowns were captured.";

  const actionsSection = topActions.length > 0
    ? topActions
        .map((action, index) => `${index + 1}. ${action.title}${action.description ? ` - ${action.description}` : ""}`)
        .join("\n")
    : "No follow-up actions suggested.";

  const sourceSection = topSources.length > 0
    ? topSources
        .map((source, index) => {
          const label = source.domain || source.title || source.url;
          return `${index + 1}. [${label}](${source.url})`;
        })
        .join("\n")
    : "No sources collected.";

  return [
    "Deep research has finished.",
    "",
    `**Query:** ${input.query}`,
    "",
    ...(input.qualityWarnings && input.qualityWarnings.length > 0
      ? [
          "### Quality warnings",
          ...input.qualityWarnings.map((warning) => `- ${warning}`),
          "",
        ]
      : []),
    "### Summary",
    input.summary,
    "",
    ...(input.analystNarrative
      ? [
          "### Analyst report",
          input.analystNarrative,
          "",
        ]
      : []),
    "### Key findings",
    findingsSection,
    "",
    "### Unknowns / gaps",
    unknownsSection,
    "",
    "### Suggested next actions",
    actionsSection,
    "",
    "### Traceable sources",
    sourceSection,
    "",
    "Reply with your preferences and constraints, and I can refine this into specific recommendations.",
  ].join("\n");
}

function computeRunMetrics(input: {
  budget: ResearchBudget;
  stepCount: number;
  sourceCount: number;
  findingCount: number;
  completedSubQuestions: number;
  totalSubQuestions: number;
  durationMs: number;
  phase: "planning" | "researching" | "synthesizing" | "complete" | "failed";
  failureReason?: string;
  qualityScore?: number;
}) {
  return {
    phase: input.phase,
    stepCount: input.stepCount,
    sourceCount: input.sourceCount,
    findingCount: input.findingCount,
    durationMs: input.durationMs,
    completedSubQuestions: input.completedSubQuestions,
    totalSubQuestions: input.totalSubQuestions,
    minSources: input.budget.minSources,
    maxSteps: input.budget.maxSteps,
    maxRuntimeSeconds: input.budget.maxRuntimeSeconds,
    maxRequeriesPerSubQuestion: input.budget.maxRequeriesPerSubQuestion,
    failureReason: input.failureReason,
    qualityScore: input.qualityScore,
  };
}

export class ResearchService {
  private async appendRunEvent(input: {
    runId: string;
    stage: string;
    status: RunEventStatus;
    subQuestion?: string | null;
    message?: string | null;
    payload?: Record<string, unknown> | null;
  }) {
    await db.insert(researchRunEvents).values({
      researchRunId: input.runId,
      stage: input.stage,
      status: input.status,
      subQuestion: input.subQuestion ?? null,
      message: input.message ?? null,
      payloadJson: input.payload ?? null,
    });
  }

  private async safeAppendRunEvent(input: {
    runId: string;
    stage: string;
    status: RunEventStatus;
    subQuestion?: string | null;
    message?: string | null;
    payload?: Record<string, unknown> | null;
  }) {
    try {
      await this.appendRunEvent(input);
    } catch (error) {
      console.error("[Research] Failed to persist run event:", error);
    }
  }

  private async loadRunAggregateCounts(runId: string) {
    const [sourceCountResult, findingCountResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(researchSources)
        .where(eq(researchSources.researchRunId, runId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(researchFindings)
        .where(eq(researchFindings.researchRunId, runId)),
    ]);

    return {
      sourceCount: Number(sourceCountResult[0]?.count ?? 0),
      findingCount: Number(findingCountResult[0]?.count ?? 0),
    };
  }

  private async updateRunMetrics(params: {
    runId: string;
    budget: ResearchBudget;
    phase: "planning" | "researching" | "synthesizing" | "complete" | "failed";
    stepCount: number;
    completedSubQuestions: number;
    totalSubQuestions: number;
    durationMs: number;
    failureReason?: string;
    qualityScore?: number;
  }) {
    const counts = await this.loadRunAggregateCounts(params.runId);

    await db
      .update(researchRuns)
      .set({
        metricsJson: computeRunMetrics({
          budget: params.budget,
          stepCount: params.stepCount,
          sourceCount: counts.sourceCount,
          findingCount: counts.findingCount,
          completedSubQuestions: params.completedSubQuestions,
          totalSubQuestions: params.totalSubQuestions,
          durationMs: params.durationMs,
          phase: params.phase,
          failureReason: params.failureReason,
          qualityScore: params.qualityScore,
        }),
        updatedAt: new Date(),
      })
      .where(eq(researchRuns.id, params.runId));
  }

  async createPlan(params: {
    conversationId: string;
    householdId: string;
    userId: string;
    input: CreateResearchPlanInput;
  }) {
    const parsedInput = createResearchPlanSchema.parse(params.input);

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, params.conversationId),
          eq(conversations.householdId, params.householdId),
        ),
      )
      .limit(1);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const effort = parsedInput.effort ?? "standard";
    const budget = getBudget(effort);

    const generatedPlanResult = await generatePlanWithModel(parsedInput, budget);
    const plannerStatus: "generated" | "fallback" = generatedPlanResult.plan
      ? "generated"
      : "fallback";
    const plannerReason = generatedPlanResult.failureReason;
    const plan = normalizePlan(
      generatedPlanResult.plan ?? fallbackPlan(parsedInput, budget),
      parsedInput.query,
    );

    const [run] = await db
      .insert(researchRuns)
      .values({
        conversationId: params.conversationId,
        householdId: params.householdId,
        createdById: params.userId,
        status: "planning",
        query: parsedInput.query,
        effort,
        recencyDays: parsedInput.recencyDays ?? null,
        planJson: plan,
        metricsJson: computeRunMetrics({
          budget,
          stepCount: 0,
          sourceCount: 0,
          findingCount: 0,
          completedSubQuestions: 0,
          totalSubQuestions: plan.subQuestions.length,
          durationMs: 0,
          phase: "planning",
          failureReason: plannerStatus === "fallback" ? plannerReason ?? "Planner generation failed" : undefined,
        }),
      })
      .returning();

    if (!run) {
      throw new Error("Failed to create research run");
    }

    const [latestSequence] = await db
      .select({ sequence: conversationMessages.sequence })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, params.conversationId))
      .orderBy(desc(conversationMessages.sequence))
      .limit(1);

    const nextSequence = (latestSequence?.sequence ?? 0) + 1;

    await db.insert(conversationMessages).values({
      conversationId: params.conversationId,
      role: "user",
      content: parsedInput.query,
      sequence: nextSequence,
      rawMessage: {
        type: "deep-research-request",
        researchRunId: run.id,
        effort,
        recencyDays: parsedInput.recencyDays ?? null,
      },
    });

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, params.conversationId));

    await this.safeAppendRunEvent({
      runId: run.id,
      stage: "planning",
      status: "completed",
      message: "Research plan generated and awaiting approval.",
      payload: {
        subQuestionCount: plan.subQuestions.length,
        effort,
        plannerStatus,
      },
    });

    return {
      runId: run.id,
      plan,
      budget,
      planner: {
        status: plannerStatus,
        reason: plannerStatus === "fallback"
          ? plannerReason ?? "Planner generation failed; using fallback template plan."
          : null,
      },
    };
  }

  async startRun(params: {
    conversationId: string;
    runId: string;
    householdId: string;
    userId: string;
    input: RunResearchInput;
  }) {
    const parsedInput = runResearchSchema.parse(params.input);

    const [run] = await db
      .select()
      .from(researchRuns)
      .where(
        and(
          eq(researchRuns.id, params.runId),
          eq(researchRuns.conversationId, params.conversationId),
          eq(researchRuns.householdId, params.householdId),
        ),
      )
      .limit(1);

    if (!run) {
      throw new Error("Research run not found");
    }

    if (run.status === "running") {
      const staleAfterMs = Math.max(getBudget(run.effort).maxRuntimeSeconds * 8_000, 1_200_000);
      const isStale = Date.now() - run.updatedAt.getTime() > staleAfterMs;
      if (!isStale) {
        return;
      }

      const staleMessage = "Previous research execution appeared stalled and was marked failed.";
      const existingMetrics = (run.metricsJson || {}) as Record<string, unknown>;

      await db
        .update(researchRuns)
        .set({
          status: "failed",
          error: staleMessage,
          completedAt: new Date(),
          metricsJson: computeRunMetrics({
            budget: getBudget(run.effort),
            stepCount: Math.max(0, Math.round(toNumber(existingMetrics.stepCount))),
            sourceCount: Math.max(0, Math.round(toNumber(existingMetrics.sourceCount))),
            findingCount: Math.max(0, Math.round(toNumber(existingMetrics.findingCount))),
            completedSubQuestions: Math.max(0, Math.round(toNumber(existingMetrics.completedSubQuestions))),
            totalSubQuestions: parsedInput.plan.subQuestions.length,
            durationMs: Math.max(0, Math.round(toNumber(existingMetrics.durationMs))),
            phase: "failed",
            failureReason: staleMessage,
          }),
          updatedAt: new Date(),
        })
        .where(eq(researchRuns.id, params.runId));

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "run",
        status: "failed",
        message: staleMessage,
      });
    }

    const normalizedPlan = normalizePlan(parsedInput.plan, run.query);
    const budget = getBudget(run.effort);

    await db
      .update(researchRuns)
      .set({
        status: "running",
        planJson: normalizedPlan,
        error: null,
        startedAt: new Date(),
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(researchRuns.id, params.runId));

    await this.safeAppendRunEvent({
      runId: params.runId,
      stage: "run",
      status: "started",
      message: "Research execution started.",
      payload: {
        effort: run.effort,
        recencyDays: run.recencyDays,
        subQuestionCount: normalizedPlan.subQuestions.length,
      },
    });

    await DBOS.startWorkflow(DeepResearchWorkflow, {
      workflowID: params.runId,
      timeoutMS: null,
    }).run({
      runId: params.runId,
      conversationId: params.conversationId,
      householdId: params.householdId,
      userId: params.userId,
      query: run.query,
      effort: run.effort,
      recencyDays: run.recencyDays,
      plan: normalizedPlan,
    });
  }

  private async synthesizeSubQuestion(
    objective: string,
    subQuestion: string,
    evidenceBlocks: Array<{
      sourceId: string;
      title: string | null;
      url: string;
      snippet: string | null;
      extractedText: string | null;
      relevanceScore: number;
    }>,
  ): Promise<SynthesisResult> {
    if (evidenceBlocks.length === 0) {
      return {
        findings: [
          {
            claim: "Insufficient evidence collected to confidently answer this sub-question.",
            confidence: 0.2,
            sourceIds: [],
            status: "unknown" as const,
            notes: "No relevant evidence extracted from available sources.",
          },
        ],
        unknowns: ["Additional targeted sources are required for this sub-question."],
        actions: [
          {
            title: `Gather additional sources for: ${subQuestion}`,
            description: "Target domain-specific sources and expert analyses.",
            relatedFindingSourceIds: [],
          },
        ],
        fallbackUsed: false,
      };
    }

    const model = pickModel();
    if (!model) {
      const top = [...evidenceBlocks].sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
      if (!top) {
        return {
          findings: [
            {
              claim: "Evidence collection returned no usable passages.",
              confidence: 0.2,
              sourceIds: [],
              status: "unknown" as const,
              notes: "No relevant evidence extracted from available sources.",
            },
          ],
          unknowns: ["Evidence quality was too low to produce a claim."],
          actions: [],
          fallbackUsed: false,
        };
      }
      const confidence = clamp(0.45 + top.relevanceScore * 0.45, 0.1, 0.9);
      return {
        findings: [
          {
            claim:
              top.extractedText ||
              top.snippet ||
              "Evidence indicates partial support, but more corroboration is needed.",
            confidence,
            sourceIds: [top.sourceId],
            status: confidence >= 0.75 ? ("sufficient" as const) : ("partial" as const),
            notes: "Generated from lexical evidence extraction fallback.",
          },
        ],
        unknowns: [],
        actions: [
          {
            title: `Validate evidence for: ${subQuestion}`,
            description: "Cross-check with an additional independent source.",
            relatedFindingSourceIds: [top.sourceId],
          },
        ],
        fallbackUsed: false,
      };
    }

    const prompt = buildDeepResearchExecutionPrompt({
      objective,
      subQuestion,
      evidenceBlocks: evidenceBlocks.map((block) => ({
        sourceId: block.sourceId,
        title: block.title,
        url: block.url,
        snippet: block.snippet,
        extractedText: block.extractedText,
      })),
    });

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const { object } = await generateObject({
          model,
          schema: executionOutputSchema,
          prompt: `${prompt}\n\nAttempt ${attempt}/2. Strictly satisfy the JSON schema.`,
        });

        const parsed = executionOutputSchema.parse(object);
        return {
          ...parsed,
          fallbackUsed: false,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown synthesis error";
        console.error(`[Research] Execution synthesis attempt ${attempt} failed:`, error);
        if (attempt < 2) continue;

        console.error("[Research] Execution synthesis failed, using fallback:", error);
        const top = [...evidenceBlocks].sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
        return {
          findings: [
            {
              claim:
                top?.extractedText ||
                top?.snippet ||
                "Evidence collected, but synthesis model was unavailable.",
              confidence: clamp(0.4 + (top?.relevanceScore ?? 0) * 0.4, 0.1, 0.8),
              sourceIds: top ? [top.sourceId] : [],
              status: "partial" as const,
              notes: "Fallback synthesis due to model error.",
            },
          ],
          unknowns: [],
          actions: [],
          fallbackUsed: true,
          fallbackReason: message,
        };
      }
    }

    const top = [...evidenceBlocks].sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
    return {
      findings: [
        {
          claim:
            top?.extractedText ||
            top?.snippet ||
            "Evidence collected, but synthesis model was unavailable.",
          confidence: clamp(0.4 + (top?.relevanceScore ?? 0) * 0.4, 0.1, 0.8),
          sourceIds: top ? [top.sourceId] : [],
          status: "partial" as const,
          notes: "Fallback synthesis due to model error.",
        },
      ],
      unknowns: [],
      actions: [],
      fallbackUsed: true,
      fallbackReason: "Unknown synthesis failure",
    };
  }

  private async executeSubQuestionWorker(params: {
    runId: string;
    query: string;
    recencyDays: number | null;
    plan: ResearchPlan;
    subQuestion: string;
    subQuestionIndex: number;
    budget: ResearchBudget;
    startedAt: number;
    runSeenUrls: Set<string>;
  }): Promise<SubQuestionExecutionResult> {
    const localSeenUrls = new Set<string>();
    const evidenceBlocks: Array<{
      sourceId: string;
      title: string | null;
      url: string;
      snippet: string | null;
      extractedText: string | null;
      relevanceScore: number;
    }> = [];

    const warnings: string[] = [];
    const confidenceHistory: number[] = [];
    let confidence = 0;
    let stepCount = 0;
    let sourceCount = 0;

    await this.safeAppendRunEvent({
      runId: params.runId,
      stage: "subquestion",
      status: "started",
      subQuestion: params.subQuestion,
      message: "Sub-question research started.",
    });

    for (let retry = 0; retry <= params.budget.maxRequeriesPerSubQuestion; retry += 1) {
      const searchQuery = buildSearchQuery(params.query, params.subQuestion, retry);
      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "search",
        status: "started",
        subQuestion: params.subQuestion,
        message: `Searching sources (attempt ${retry + 1}).`,
        payload: { searchQuery, retry },
      });

      const searchResults = await searchWebBalanced({
        query: searchQuery,
        recencyDays: params.recencyDays,
        limit: Math.max(8, params.budget.minSources + 2),
        subQuestionIndex: params.subQuestionIndex,
        retry,
      });

      const freshResults = selectSearchResults(
        searchResults,
        localSeenUrls,
        params.query,
        params.subQuestion,
        5,
      ).filter((row) => !params.runSeenUrls.has(row.url));

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "search",
        status: "progress",
        subQuestion: params.subQuestion,
        message: `Search produced ${freshResults.length} fresh candidates.`,
        payload: {
          retry,
          candidateCount: freshResults.length,
          topUrls: freshResults.slice(0, 3).map((row) => row.url),
        },
      });

      if (freshResults.length === 0) {
        confidenceHistory.push(confidence);
        stepCount += 1;
        continue;
      }

      for (const row of freshResults) {
        localSeenUrls.add(row.url);
        params.runSeenUrls.add(row.url);
      }

      const insertedSources = await db
        .insert(researchSources)
        .values(
          freshResults.map((row) => ({
            researchRunId: params.runId,
            url: row.url,
            title: row.title,
            domain: row.domain,
            snippet: row.snippet,
            publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
            score: row.score !== null ? String(row.score) : null,
            metadataJson: {
              ...row.metadata,
              searchQuery,
              retry,
              qualityScore: row.qualityScore,
            },
          })),
        )
        .onConflictDoNothing({
          target: [researchSources.researchRunId, researchSources.url],
        })
        .returning();

      sourceCount += insertedSources.length;

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "source-selection",
        status: "progress",
        subQuestion: params.subQuestion,
        message: `Persisted ${insertedSources.length} new sources.`,
        payload: {
          retry,
          sourceIds: insertedSources.map((source) => source.id),
        },
      });

      for (const source of insertedSources.slice(0, 3)) {
        const fetched = await fetchSource(source.url);
        const extracted = extractEvidence(
          fetched.text || source.snippet || "",
          params.subQuestion,
        );

        if (extracted.relevanceScore < 0.08) {
          continue;
        }

        evidenceBlocks.push({
          sourceId: source.id,
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          extractedText: extracted.excerpt,
          relevanceScore: extracted.relevanceScore,
        });
      }

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "evidence",
        status: "progress",
        subQuestion: params.subQuestion,
        message: `Evidence blocks captured: ${evidenceBlocks.length}`,
        payload: {
          retry,
          evidenceCount: evidenceBlocks.length,
        },
      });

      const avgRelevance = evidenceBlocks.length > 0
        ? evidenceBlocks.reduce((acc, row) => acc + row.relevanceScore, 0) / evidenceBlocks.length
        : 0;

      const distinctDomains = new Set(
        insertedSources.map((row) => row.domain).filter((value): value is string => Boolean(value)),
      ).size;

      confidence = clamp(
        Math.max(
          confidence,
          avgRelevance * 0.75 + Math.min(0.2, distinctDomains * 0.05),
        ),
        0,
        0.95,
      );

      confidenceHistory.push(confidence);
      stepCount += 1;

      const shouldStopForConfidence =
        confidence >= params.plan.stopCriteria.confidenceTarget &&
        sourceCount >= Math.min(params.budget.minSources, 4);

      const lastTwo = confidenceHistory.slice(-2);
      const hasDiminishingReturns =
        lastTwo.length === 2 &&
        Math.abs(lastTwo[1]! - lastTwo[0]!) <
          params.plan.stopCriteria.diminishingReturnsDelta;

      if (shouldStopForConfidence || hasDiminishingReturns) {
        await this.safeAppendRunEvent({
          runId: params.runId,
          stage: "search",
          status: "completed",
          subQuestion: params.subQuestion,
          message: shouldStopForConfidence
            ? "Stopped after reaching confidence target."
            : "Stopped due to diminishing returns.",
          payload: {
            confidence,
            sourceCount,
            stepCount,
          },
        });
        break;
      }
    }

    await this.safeAppendRunEvent({
      runId: params.runId,
      stage: "synthesis",
      status: "started",
      subQuestion: params.subQuestion,
      message: "Synthesizing findings for sub-question.",
      payload: { evidenceCount: evidenceBlocks.length },
    });

    const synthesis = await this.synthesizeSubQuestion(
      params.plan.objective,
      params.subQuestion,
      evidenceBlocks,
    );

    if (synthesis.fallbackUsed) {
      warnings.push(
        `Synthesis fallback triggered for "${params.subQuestion}"${synthesis.fallbackReason ? `: ${synthesis.fallbackReason}` : "."}`,
      );
    }

    const evidenceBySourceId = new Map(
      evidenceBlocks.map((block) => [block.sourceId, block]),
    );

    const filteredFindings = synthesis.findings.length > 0
      ? synthesis.findings
      : [
          {
            claim: "No clear conclusion could be supported for this sub-question.",
            confidence: confidence || 0.2,
            sourceIds: evidenceBlocks.slice(0, 2).map((block) => block.sourceId),
            status: "unknown" as const,
            notes: "Evidence remained insufficient after allotted budget.",
          },
        ];

    const insertedFindings = await db
      .insert(researchFindings)
      .values(
        filteredFindings.map((finding) => ({
          evidenceJson: finding.sourceIds
            .map((sourceId) => {
              const evidence = evidenceBySourceId.get(sourceId);
              if (!evidence) return null;
              return {
                sourceId,
                excerpt: evidence.extractedText,
                relevanceScore: clamp(evidence.relevanceScore, 0, 1),
                url: evidence.url,
                title: evidence.title,
              };
            })
            .filter((value): value is FindingEvidence => Boolean(value)),
          researchRunId: params.runId,
          subQuestion: params.subQuestion,
          claim: finding.claim,
          confidence: String(clamp(finding.confidence, 0, 1)),
          supportingSourceIds: finding.sourceIds,
          status: finding.status,
          notes: finding.notes,
        })),
      )
      .returning({
        id: researchFindings.id,
        supportingSourceIds: researchFindings.supportingSourceIds,
        evidenceJson: researchFindings.evidenceJson,
      });

    await this.safeAppendRunEvent({
      runId: params.runId,
      stage: "synthesis",
      status: "completed",
      subQuestion: params.subQuestion,
      message: `Generated ${insertedFindings.length} findings.`,
      payload: {
        findingCount: insertedFindings.length,
        warningCount: warnings.length,
      },
    });

    return {
      subQuestion: params.subQuestion,
      stepCount,
      sourceCount,
      findingCount: insertedFindings.length,
      findings: insertedFindings.map((finding) => ({
        id: finding.id,
        sourceIds: Array.isArray(finding.supportingSourceIds)
          ? finding.supportingSourceIds.filter((id): id is string => typeof id === "string")
          : [],
        evidence: Array.isArray(finding.evidenceJson)
          ? (finding.evidenceJson as FindingEvidence[])
          : [],
      })),
      unknowns: synthesis.unknowns,
      actions: synthesis.actions.map((action) => ({
        title: action.title,
        description: action.description,
        relatedFindingIds: action.relatedFindingSourceIds,
      })),
      warnings,
    };
  }

  private async synthesizeFinalReport(input: {
    query: string;
    objective: string;
    findings: FindingSummary[];
    sources: Array<{ id: string; title: string | null; url: string; domain: string | null }>;
    qualityWarnings: string[];
  }): Promise<FinalReportSynthesis | null> {
    const model = pickModel();
    if (!model) return null;
    const recommendationMode = isRecommendationQuery(input.query);

    const sourcesById = new Map(input.sources.map((source) => [source.id, source]));
    const compactFindings = input.findings.map((finding) => ({
      subQuestion: finding.subQuestion,
      claim: finding.claim,
      confidence: finding.confidence,
      status: finding.status,
      sources: finding.sourceIds.map((id) => {
        const source = sourcesById.get(id);
        return source
          ? { id, title: source.title, url: source.url, domain: source.domain }
          : { id, title: null, url: null, domain: null };
      }),
      notes: finding.notes,
    }));

    try {
      const { object } = await generateObject({
        model,
        schema: finalReportSynthesisSchema,
        prompt: [
          "You are the lead synthesis agent for a deep research run.",
          "Use the per-question findings to produce a high-quality end report that is concise and actionable.",
          "",
          `User query: ${input.query}`,
          `Objective: ${input.objective}`,
          "",
          "Quality warnings (must be reflected honestly):",
          JSON.stringify(input.qualityWarnings, null, 2),
          "",
          "Per-question findings with citations:",
          JSON.stringify(compactFindings, null, 2),
          "",
          "Return a JSON object with this shape:",
          JSON.stringify(
            {
              executiveSummary: "string",
              plainTextReport:
                "string markdown narrative with headings/format chosen based on what best answers the user query",
            },
            null,
            2,
          ),
          "",
          "Rules:",
          "- Optimize for usefulness: answer the user directly, then support with evidence.",
          "- Choose the report structure that best fits the query (comparison, recommendation, explainer, plan, etc.).",
          "- Be explicit about uncertainty and evidence limits.",
          "- Do not invent details not present in findings/sources.",
          "- Include actionable next steps when evidence is incomplete.",
          "- plainTextReport must be natural prose/markdown, not JSON.",
          ...(recommendationMode
            ? [
                "- Because this is a recommendation-style query, prioritize a practical shortlist with tradeoffs and direct links when evidence supports it.",
                "- If evidence is too thin for a confident shortlist, say that clearly and recommend the fastest path to close the gaps.",
              ]
            : []),
        ].join("\n"),
      });

      return finalReportSynthesisSchema.parse(object);
    } catch (error) {
      console.error("[Research] Final report synthesis failed:", error);
      return null;
    }
  }

  private async generatePresentation(input: {
    query: string;
    objective: string;
    executiveSummary: string;
    analystNarrative: string | null;
    findings: FindingSummary[];
    unknowns: string[];
    actions: Array<{ title: string; description?: string }>;
    sources: Array<{ id: string; title: string | null; url: string; domain: string | null }>;
    qualityWarnings: string[];
  }): Promise<ResearchPresentation | null> {
    const model = pickModel();
    if (!model) return null;

    const sourcesById = new Map(input.sources.map((source) => [source.id, source]));
    const compactFindings = input.findings.map((finding) => ({
      subQuestion: finding.subQuestion,
      claim: finding.claim,
      confidence: finding.confidence,
      status: finding.status,
      sources: finding.sourceIds.map((id) => {
        const source = sourcesById.get(id);
        return source
          ? { id, title: source.title, url: source.url, domain: source.domain }
          : null;
      }).filter((s): s is NonNullable<typeof s> => s !== null),
      notes: finding.notes,
    }));

    try {
      const { object } = await generateObject({
        model,
        schema: researchPresentationSchema,
        prompt: buildDeepResearchPresentationPrompt({
          query: input.query,
          objective: input.objective,
          executiveSummary: input.executiveSummary,
          analystNarrative: input.analystNarrative,
          findings: compactFindings,
          unknowns: input.unknowns,
          actions: input.actions,
          sources: input.sources,
          qualityWarnings: input.qualityWarnings,
        }),
      });

      return researchPresentationSchema.parse(object);
    } catch (error) {
      console.error("[Research] Presentation generation failed:", error);
      return null;
    }
  }

  async executeRun(params: {
    runId: string;
    conversationId: string;
    householdId: string;
    userId: string;
    query: string;
    effort: ResearchEffort;
    recencyDays: number | null;
    plan: ResearchPlan;
  }) {
    const budget = getBudget(params.effort);
    const startedAt = Date.now();

    let stepCount = 0;
    let completedSubQuestions = 0;
    const unknowns = new Set<string>();
    const actionItems: Array<{ title: string; description?: string; relatedFindingIds?: string[] }> = [];
    const qualityWarnings = new Set<string>();
    const runSeenUrls = new Set<string>();

    try {
      await this.updateRunMetrics({
        runId: params.runId,
        budget,
        phase: "researching",
        stepCount: 0,
        completedSubQuestions: 0,
        totalSubQuestions: params.plan.subQuestions.length,
        durationMs: 0,
      });

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "research",
        status: "started",
        message: "Parallel sub-question research has started.",
        payload: {
          totalSubQuestions: params.plan.subQuestions.length,
          effort: params.effort,
          recencyDays: params.recencyDays,
        },
      });

      await mapWithConcurrency(
        params.plan.subQuestions,
        3,
        async (subQuestion, subQuestionIndex) =>
          this.executeSubQuestionWorker({
            runId: params.runId,
            query: params.query,
            recencyDays: params.recencyDays,
            plan: params.plan,
            subQuestion,
            subQuestionIndex,
            budget,
            startedAt,
            runSeenUrls,
          }),
        async (result) => {
          stepCount += result.stepCount;
          completedSubQuestions += 1;

          for (const unknown of result.unknowns) {
            unknowns.add(unknown);
          }
          for (const action of result.actions) {
            actionItems.push(action);
          }
          for (const warning of result.warnings) {
            qualityWarnings.add(warning);
          }

          await this.updateRunMetrics({
            runId: params.runId,
            budget,
            phase: "researching",
            stepCount,
            completedSubQuestions,
            totalSubQuestions: params.plan.subQuestions.length,
            durationMs: Date.now() - startedAt,
          });

          await this.safeAppendRunEvent({
            runId: params.runId,
            stage: "subquestion",
            status: "completed",
            subQuestion: result.subQuestion,
            message: "Sub-question completed.",
            payload: {
              stepCount: result.stepCount,
              sourceCount: result.sourceCount,
              findingCount: result.findingCount,
              warningCount: result.warnings.length,
            },
          });
        },
      );

      await this.updateRunMetrics({
        runId: params.runId,
        budget,
        phase: "synthesizing",
        stepCount,
        completedSubQuestions,
        totalSubQuestions: params.plan.subQuestions.length,
        durationMs: Date.now() - startedAt,
      });

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "synthesis",
        status: "started",
        message: "Composing final report from all findings.",
      });

      const [allSources, allFindings] = await Promise.all([
        db
          .select()
          .from(researchSources)
          .where(eq(researchSources.researchRunId, params.runId)),
        db
          .select()
          .from(researchFindings)
          .where(eq(researchFindings.researchRunId, params.runId)),
      ]);

      const normalizedFindings = allFindings.map((finding) => ({
        id: finding.id,
        subQuestion: finding.subQuestion,
        claim: finding.claim,
        confidence: toNumber(finding.confidence),
        status: finding.status,
        sourceIds: Array.isArray(finding.supportingSourceIds)
          ? finding.supportingSourceIds.filter((id): id is string => typeof id === "string")
          : [],
        evidence: Array.isArray(finding.evidenceJson)
          ? (finding.evidenceJson as FindingEvidence[])
          : [],
        notes: finding.notes,
      }));

      const quality = assessRunQuality({
        findings: normalizedFindings,
        sourceCount: allSources.length,
        totalSubQuestions: params.plan.subQuestions.length,
        budget,
      });

      for (const warning of quality.warnings) {
        qualityWarnings.add(warning);
      }

      const qualityWarningList = [...qualityWarnings];
      const runStatus: RunStatus = qualityWarningList.length === 0
        ? "completed"
        : "completed_with_warnings";

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "quality-check",
        status: "completed",
        message:
          runStatus === "completed"
            ? "Quality checks passed."
            : "Quality checks passed with warnings.",
        payload: {
          qualityScore: quality.score,
          warningCount: qualityWarningList.length,
          warnings: qualityWarningList,
        },
      });

      const defaultSummary = runStatus === "completed"
        ? summarizeFindings(normalizedFindings)
        : `Research run completed with caveats. Quality checks produced ${qualityWarningList.length} warning${qualityWarningList.length === 1 ? "" : "s"}.`;

      const synthesizedReport = await this.synthesizeFinalReport({
        query: params.query,
        objective: params.plan.objective,
        findings: normalizedFindings,
        sources: allSources.map((source) => ({
          id: source.id,
          title: source.title,
          url: source.url,
          domain: source.domain,
        })),
        qualityWarnings: qualityWarningList,
      });

      const summary = synthesizedReport?.executiveSummary || defaultSummary;
      const dedupedActions: Array<{ title: string; description?: string; relatedFindingIds?: string[] }> = [];
      const actionTitles = new Set<string>();

      for (const action of actionItems) {
        const key = action.title.trim().toLowerCase();
        if (!key || actionTitles.has(key)) continue;
        actionTitles.add(key);
        dedupedActions.push(action);
      }

      const reportMarkdown = buildReportMarkdown({
        summary,
        findings: normalizedFindings,
        unknowns: [...unknowns, ...qualityWarnings],
        actions: dedupedActions,
        sources: allSources.map((source) => ({
          id: source.id,
          title: source.title,
          url: source.url,
        })),
        qualityWarnings: qualityWarningList,
        analystNarrative: synthesizedReport?.plainTextReport || null,
      });

      // Generate the model-driven presentation (optional display blocks + markdown)
      const sourcesForPresentation = allSources.map((source) => ({
        id: source.id,
        title: source.title,
        url: source.url,
        domain: source.domain,
      }));

      const presentation = await this.generatePresentation({
        query: params.query,
        objective: params.plan.objective,
        executiveSummary: summary,
        analystNarrative: synthesizedReport?.plainTextReport || null,
        findings: normalizedFindings,
        unknowns: [...unknowns],
        actions: dedupedActions,
        sources: sourcesForPresentation,
        qualityWarnings: qualityWarningList,
      });

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "presentation",
        status: presentation ? "completed" : "info",
        message: presentation
          ? `Presentation generated with ${presentation.blocks.length} display block(s).`
          : "Presentation generation skipped; using fallback markdown.",
      });

      await db
        .insert(researchReports)
        .values({
          researchRunId: params.runId,
          summary,
          reportMarkdown,
          actionsJson: dedupedActions,
          presentationJson: presentation || undefined,
        })
        .onConflictDoUpdate({
          target: researchReports.researchRunId,
          set: {
            summary,
            reportMarkdown,
            actionsJson: dedupedActions,
            presentationJson: presentation || undefined,
          },
        });

      // Use the presentation markdown for the chat message if available,
      // otherwise fall back to the legacy structured format.
      const chatReportMessage = presentation
        ? presentation.markdown
        : buildChatReportMessage({
            query: params.query,
            summary,
            findings: normalizedFindings,
            unknowns: [...unknowns],
            actions: dedupedActions,
            sources: sourcesForPresentation,
            qualityWarnings: qualityWarningList,
            analystNarrative: synthesizedReport?.plainTextReport || null,
          });

      const existingRunMessages = await db
        .select({
          id: conversationMessages.id,
          rawMessage: conversationMessages.rawMessage,
        })
        .from(conversationMessages)
        .where(
          and(
            eq(conversationMessages.conversationId, params.conversationId),
            eq(conversationMessages.role, "assistant"),
          ),
        );

      const hasExistingRunMessage = existingRunMessages.some((message) => {
        if (!message.rawMessage || typeof message.rawMessage !== "object") return false;
        const raw = message.rawMessage as Record<string, unknown>;
        return raw.type === "deep-research-report" && raw.researchRunId === params.runId;
      });

      if (!hasExistingRunMessage) {
        const [latestSequence] = await db
          .select({ sequence: conversationMessages.sequence })
          .from(conversationMessages)
          .where(eq(conversationMessages.conversationId, params.conversationId))
          .orderBy(desc(conversationMessages.sequence))
          .limit(1);

        const nextSequence = (latestSequence?.sequence ?? 0) + 1;

        await db.insert(conversationMessages).values({
          conversationId: params.conversationId,
          role: "assistant",
          content: chatReportMessage,
          sequence: nextSequence,
          rawMessage: {
            type: "deep-research-report",
            researchRunId: params.runId,
          },
        });
      }

      await db
        .update(researchRuns)
        .set({
          status: runStatus,
          qualityScore: quality.score.toFixed(4),
          error: null,
          completedAt: new Date(),
          metricsJson: computeRunMetrics({
            budget,
            stepCount,
            sourceCount: allSources.length,
            findingCount: allFindings.length,
            completedSubQuestions,
            totalSubQuestions: params.plan.subQuestions.length,
            durationMs: Date.now() - startedAt,
            phase: "complete",
            failureReason: undefined,
            qualityScore: quality.score,
          }),
          updatedAt: new Date(),
        })
        .where(eq(researchRuns.id, params.runId));

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "run",
        status: "completed",
        message:
          runStatus === "completed"
            ? "Research run completed successfully."
            : "Research run completed with quality warnings.",
        payload: {
          status: runStatus,
          qualityScore: quality.score,
          warningCount: qualityWarningList.length,
          sourceCount: allSources.length,
          findingCount: allFindings.length,
        },
      });

      console.log(
        `[Research] Run ${params.runId} ${runStatus}. sources=${allSources.length} findings=${allFindings.length} steps=${stepCount} quality=${quality.score.toFixed(3)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Research] Run ${params.runId} failed:`, error);
      const counts = await this.loadRunAggregateCounts(params.runId);

      await db
        .update(researchRuns)
        .set({
          status: "failed",
          error: message,
          qualityScore: null,
          completedAt: new Date(),
          metricsJson: computeRunMetrics({
            budget,
            stepCount,
            sourceCount: counts.sourceCount,
            findingCount: counts.findingCount,
            completedSubQuestions,
            totalSubQuestions: params.plan.subQuestions.length,
            durationMs: Date.now() - startedAt,
            phase: "failed",
            failureReason: message,
          }),
          updatedAt: new Date(),
        })
        .where(eq(researchRuns.id, params.runId));

      await this.safeAppendRunEvent({
        runId: params.runId,
        stage: "run",
        status: "failed",
        message,
      });
    }
  }

  async getRunStatus(params: {
    conversationId: string;
    runId: string;
    householdId: string;
  }) {
    const [run] = await db
      .select()
      .from(researchRuns)
      .where(
        and(
          eq(researchRuns.id, params.runId),
          eq(researchRuns.conversationId, params.conversationId),
          eq(researchRuns.householdId, params.householdId),
        ),
      )
      .limit(1);

    if (!run) {
      throw new Error("Research run not found");
    }

    const [sources, findings, report, events] = await Promise.all([
      db
        .select()
        .from(researchSources)
        .where(eq(researchSources.researchRunId, params.runId)),
      db
        .select()
        .from(researchFindings)
        .where(eq(researchFindings.researchRunId, params.runId)),
      db
        .select()
        .from(researchReports)
        .where(eq(researchReports.researchRunId, params.runId))
        .limit(1),
      db
        .select()
        .from(researchRunEvents)
        .where(eq(researchRunEvents.researchRunId, params.runId))
        .orderBy(desc(researchRunEvents.createdAt))
        .limit(80),
    ]);

    const budget = getBudget(run.effort);

    return {
      run: {
        runId: run.id,
        conversationId: run.conversationId,
        status: run.status as RunStatus,
        query: run.query,
        effort: run.effort,
        recencyDays: run.recencyDays,
        budget,
        plan: researchPlanSchema.parse(run.planJson),
        metrics: run.metricsJson || {},
        qualityScore: run.qualityScore === null ? null : clamp(toNumber(run.qualityScore), 0, 1),
        startedAt: toIsoOrNull(run.startedAt),
        completedAt: toIsoOrNull(run.completedAt),
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        error: run.error,
      },
      sources: sources.map((source) => ({
        id: source.id,
        url: source.url,
        title: source.title,
        domain: source.domain,
        snippet: source.snippet,
        publishedAt: toIsoOrNull(source.publishedAt),
        retrievedAt: source.retrievedAt.toISOString(),
        score: source.score === null ? null : toNumber(source.score),
        metadata: source.metadataJson || null,
      })),
      findings: findings.map((finding) => ({
        id: finding.id,
        subQuestion: finding.subQuestion,
        claim: finding.claim,
        confidence: clamp(toNumber(finding.confidence), 0, 1),
        supportingSourceIds: Array.isArray(finding.supportingSourceIds)
          ? finding.supportingSourceIds.filter((id): id is string => typeof id === "string")
          : [],
        evidence: Array.isArray(finding.evidenceJson)
          ? (finding.evidenceJson as FindingEvidence[])
          : [],
        status: finding.status,
        notes: finding.notes,
        createdAt: finding.createdAt.toISOString(),
      })),
      report: report[0]
        ? {
            id: report[0].id,
            summary: report[0].summary,
            reportMarkdown: report[0].reportMarkdown,
            actions: Array.isArray(report[0].actionsJson)
              ? report[0].actionsJson
              : [],
            presentation: report[0].presentationJson || null,
            createdAt: report[0].createdAt.toISOString(),
          }
        : null,
      events: events
        .slice()
        .reverse()
        .map((event) => ({
          id: event.id,
          runId: event.researchRunId,
          stage: event.stage,
          status: runEventStatusSchema.safeParse(event.status).success
            ? (event.status as RunEventStatus)
            : "info",
          subQuestion: event.subQuestion,
          message: event.message,
          payload: event.payloadJson
            ? (event.payloadJson as Record<string, unknown>)
            : null,
          createdAt: event.createdAt.toISOString(),
        })),
    };
  }

  async listRunsForConversation(params: { conversationId: string; householdId: string }) {
    const runs = await db
      .select({
        id: researchRuns.id,
        status: researchRuns.status,
        effort: researchRuns.effort,
        query: researchRuns.query,
        createdAt: researchRuns.createdAt,
        updatedAt: researchRuns.updatedAt,
      })
      .from(researchRuns)
      .where(
        and(
          eq(researchRuns.conversationId, params.conversationId),
          eq(researchRuns.householdId, params.householdId),
        ),
      )
      .orderBy(desc(researchRuns.createdAt));

    return runs.map((run) => ({
      id: run.id,
      status: run.status,
      effort: run.effort,
      query: run.query,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    }));
  }

  async createTasksFromRun(params: {
    conversationId: string;
    runId: string;
    householdId: string;
    userId: string;
    input: CreateResearchTasksInput;
  }) {
    const parsedInput = createResearchTasksSchema.parse(params.input);

    const [run] = await db
      .select()
      .from(researchRuns)
      .where(
        and(
          eq(researchRuns.id, params.runId),
          eq(researchRuns.conversationId, params.conversationId),
          eq(researchRuns.householdId, params.householdId),
        ),
      )
      .limit(1);

    if (!run) {
      throw new Error("Research run not found");
    }

    const findingRows = parsedInput.findingIds.length > 0
      ? await db
          .select()
          .from(researchFindings)
          .where(
            and(
              eq(researchFindings.researchRunId, params.runId),
              inArray(researchFindings.id, parsedInput.findingIds),
            ),
          )
      : [];

    const findingTaskInputs = findingRows.map((finding) => ({
      title: `Follow up: ${finding.subQuestion}`.slice(0, 500),
      description: `${finding.claim}\n\nConfidence: ${clamp(toNumber(finding.confidence), 0, 1).toFixed(2)}`,
      dueDate: undefined as Date | undefined,
      assignedToId: undefined as string | undefined,
      priority: 1,
    }));

    const actionTaskInputs = parsedInput.actionItems.map((action) => ({
      title: action.title,
      description: action.description,
      dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
      assignedToId: action.assignedToId,
      priority: action.priority ?? 0,
    }));

    const taskInputs = [
      ...findingTaskInputs,
      ...actionTaskInputs,
    ];

    if (taskInputs.length === 0) {
      return { createdTaskIds: [] };
    }

    const createdTasks = await db
      .insert(tasks)
      .values(
        taskInputs.map((taskInput) => ({
          householdId: params.householdId,
          createdById: params.userId,
          title: taskInput.title,
          description: taskInput.description,
          dueDate: taskInput.dueDate,
          assignedToId: taskInput.assignedToId,
          priority: taskInput.priority,
        })),
      )
      .returning({ id: tasks.id });

    if (createdTasks.length > 0) {
      await db.insert(conversationLinks).values(
        createdTasks.map((task) => ({
          conversationId: params.conversationId,
          entityType: "task" as const,
          entityId: task.id,
        })),
      );
    }

    const createdTaskIds = createdTasks.map((task) => task.id);
    const actionTaskIds = createdTaskIds.slice(findingTaskInputs.length);

    const [report] = await db
      .select()
      .from(researchReports)
      .where(eq(researchReports.researchRunId, params.runId))
      .limit(1);

    if (report && Array.isArray(report.actionsJson) && createdTaskIds.length > 0) {
      const actionTaskIdByTitle = new Map<string, string>();
      for (let index = 0; index < actionTaskInputs.length; index += 1) {
        const actionInput = actionTaskInputs[index];
        const taskId = actionTaskIds[index];
        if (!actionInput?.title || !taskId) continue;
        actionTaskIdByTitle.set(actionInput.title.trim().toLowerCase(), taskId);
      }

      const existingActions = report.actionsJson.filter(
        (action): action is { title: string; description?: string; relatedFindingIds?: string[]; createdTaskId?: string } =>
          Boolean(action) && typeof action === "object" && typeof (action as { title?: unknown }).title === "string",
      );

      const updatedActions = existingActions.map((action) => {
        if (typeof action.createdTaskId === "string") return action;

        const createdTaskId = actionTaskIdByTitle.get(action.title.trim().toLowerCase());
        if (!createdTaskId) return action;

        return {
          ...action,
          createdTaskId,
        };
      });

      await db
        .update(researchReports)
        .set({
          actionsJson: updatedActions,
        })
        .where(eq(researchReports.id, report.id));
    }

    return { createdTaskIds };
  }
}

export const researchService = new ResearchService();

class DeepResearchWorkflow {
  @DBOS.workflow()
  static async run(params: {
    runId: string;
    conversationId: string;
    householdId: string;
    userId: string;
    query: string;
    effort: ResearchEffort;
    recencyDays: number | null;
    plan: ResearchPlan;
  }) {
    await researchService.executeRun(params);
  }
}
