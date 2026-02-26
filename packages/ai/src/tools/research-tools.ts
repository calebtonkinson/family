export interface ResearchSearchResult {
  url: string;
  title: string | null;
  domain: string | null;
  snippet: string | null;
  publishedAt: string | null;
  score: number | null;
  metadata?: Record<string, unknown>;
}

export interface FetchedSource {
  url: string;
  title: string | null;
  text: string | null;
  retrievedAt: string;
}

export interface ExtractedEvidence {
  excerpt: string | null;
  relevanceScore: number;
  notes: string;
}

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function stripHtml(input: string): string {
  return decodeHtml(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function chooseRecencyToken(recencyDays?: number | null): string | undefined {
  if (!recencyDays) return undefined;
  if (recencyDays <= 7) return "d";
  if (recencyDays <= 30) return "w";
  if (recencyDays <= 120) return "m";
  return "y";
}

export async function searchWeb(
  query: string,
  recencyDays?: number | null,
  limit = 8,
): Promise<ResearchSearchResult[]> {
  const searchUrl = new URL("https://duckduckgo.com/html/");
  searchUrl.searchParams.set("q", query);

  const recencyToken = chooseRecencyToken(recencyDays);
  if (recencyToken) {
    searchUrl.searchParams.set("df", recencyToken);
  }

  const response = await fetch(searchUrl.toString(), {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Web search failed: ${response.status}`);
  }

  const html = await response.text();
  const resultRegex = /<a[^>]*class=\"result__a\"[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class=\"result__snippet\"[^>]*>([\s\S]*?)<\/a>/gi;

  const output: ResearchSearchResult[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(resultRegex)) {
    const rawUrl = decodeHtml(match[1] || "").trim();
    if (!rawUrl || seen.has(rawUrl)) continue;
    seen.add(rawUrl);

    const title = stripHtml(match[2] || "") || null;
    const snippet = stripHtml(match[3] || "") || null;

    output.push({
      url: rawUrl,
      title,
      domain: safeDomain(rawUrl),
      snippet,
      publishedAt: null,
      score: null,
      metadata: { provider: "duckduckgo_html" },
    });

    if (output.length >= limit) break;
  }

  return output;
}

export async function fetchSource(url: string): Promise<FetchedSource> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return {
        url,
        title: null,
        text: null,
        retrievedAt: new Date().toISOString(),
      };
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1] ? stripHtml(titleMatch[1]) : null;
    const text = stripHtml(html).slice(0, 12_000);

    return {
      url,
      title,
      text: text || null,
      retrievedAt: new Date().toISOString(),
    };
  } catch {
    return {
      url,
      title: null,
      text: null,
      retrievedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function extractEvidence(text: string, subQuestion: string): ExtractedEvidence {
  const sourceTokens = tokenize(text);
  const questionTokens = new Set(tokenize(subQuestion));

  if (sourceTokens.length === 0 || questionTokens.size === 0) {
    return {
      excerpt: null,
      relevanceScore: 0,
      notes: "No usable evidence extracted",
    };
  }

  let overlapCount = 0;
  for (const token of sourceTokens) {
    if (questionTokens.has(token)) overlapCount += 1;
  }

  const relevanceScore = Math.min(1, overlapCount / Math.max(6, questionTokens.size * 3));

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const excerpt =
    sentences.find((sentence) => {
      const lower = sentence.toLowerCase();
      for (const token of questionTokens) {
        if (lower.includes(token)) return true;
      }
      return false;
    }) || sentences[0] || null;

  return {
    excerpt: excerpt ? excerpt.slice(0, 400) : null,
    relevanceScore,
    notes:
      relevanceScore >= 0.7
        ? "High lexical overlap with sub-question"
        : relevanceScore >= 0.4
          ? "Moderate lexical overlap with sub-question"
          : "Weak lexical overlap with sub-question",
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  const record = toRecord(value);
  if (!record) return [];

  // Common wrappers returned by native provider tool outputs.
  const nestedCandidates = [
    "results",
    "sources",
    "items",
    "data",
    "value",
  ];

  for (const key of nestedCandidates) {
    if (key in record) {
      const nested = toRecordArray(record[key]);
      if (nested.length > 0) return nested;
    }
  }

  return [record];
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function normalizeAnthropicWebSearchOutput(output: unknown): ResearchSearchResult[] {
  const rows = toRecordArray(output);
  const results: ResearchSearchResult[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const url = firstString(row, ["url", "link", "href"]);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const title = firstString(row, ["title", "name"]);
    const snippet = firstString(row, ["snippet", "description", "text"]);
    const publishedAt = firstString(row, ["publishedAt", "published_at", "pageAge", "date"]);
    const score = firstNumber(row, ["score", "relevance", "rank"]);

    results.push({
      url,
      title,
      domain: safeDomain(url),
      snippet,
      publishedAt,
      score,
      metadata: {
        provider: "native_web_search",
        raw: row,
      },
    });
  }

  return results;
}
