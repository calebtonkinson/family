import type { ResearchSearchResult } from "@home/ai";

export interface ResearchBudget {
  maxSteps: number;
  maxRuntimeSeconds: number;
  minSources: number;
  maxRequeriesPerSubQuestion: number;
}

export type QualityFindingSummary = {
  id: string;
  subQuestion: string;
  claim: string;
  confidence: number;
  status: string;
  sourceIds: string[];
  notes: string | null;
};

export type QualityAssessment = {
  score: number;
  warnings: string[];
  fallbackFindingCount: number;
  unknownFindingCount: number;
  sourcedFindingCount: number;
  multiSourceFindingCount: number;
  answeredSubQuestionCount: number;
};

export type SearchProvider = "anthropic" | "openai" | "google" | "duckduckgo";

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

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function dedupeSearchResults(
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

export function getSearchProviderOrder(): SearchProvider[] {
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

export function rotateProviders(
  providers: SearchProvider[],
  subQuestionIndex: number,
  retry: number,
): SearchProvider[] {
  if (providers.length <= 1) return providers;
  const offset = (subQuestionIndex + retry) % providers.length;
  return [...providers.slice(offset), ...providers.slice(0, offset)];
}

function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return domain.toLowerCase().replace(/^www\./, "");
}

function textContainsAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(term));
}

export function isRecommendationQuery(query: string): boolean {
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

export function selectSearchResults(
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

  if (selected.length === 0) {
    return scored.slice(0, limit);
  }

  return selected;
}

export function assessRunQuality(input: {
  findings: QualityFindingSummary[];
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
