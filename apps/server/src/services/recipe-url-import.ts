type RecipeJsonLd = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  yieldServings: number | null;
  ingredients: string[];
  instructions: string[];
};

export type ExtractedRecipePage = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  textContent: string;
  recipeJsonLd: RecipeJsonLd | null;
};

const MAX_TEXT_LENGTH = 20_000;

const decodeHtmlEntities = (input: string) =>
  input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );

const normalizeWhitespace = (input: string) =>
  input
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const toAbsoluteUrl = (value: string | null | undefined, sourceUrl: string) => {
  if (!value) return null;

  try {
    return new URL(value, sourceUrl).toString();
  } catch {
    return null;
  }
};

const firstString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = decodeHtmlEntities(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstString(item);
      if (result) return result;
    }
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return (
      firstString(candidate.text) ??
      firstString(candidate.name) ??
      firstString(candidate.value)
    );
  }

  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (typeof value === "string") {
    const normalized = decodeHtmlEntities(value).trim();
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => toStringArray(item));
  }

  return [];
};

const extractInstructions = (value: unknown): string[] => {
  if (typeof value === "string") {
    const normalized = decodeHtmlEntities(value).trim();
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractInstructions(item));
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;

    if (candidate["@type"] === "HowToSection" && candidate.itemListElement) {
      return extractInstructions(candidate.itemListElement);
    }

    const text = extractInstructions(candidate.text);
    if (text.length > 0) return text;

    const itemList = extractInstructions(candidate.itemListElement);
    if (itemList.length > 0) return itemList;

    return extractInstructions(candidate.name);
  }

  return [];
};

const parseYieldServings = (value: unknown): number | null => {
  const raw = firstString(value);
  if (!raw) return null;

  const match = raw.match(/\d+/);
  if (!match) return null;

  const servings = Number.parseInt(match[0], 10);
  return Number.isFinite(servings) && servings > 0 ? servings : null;
};

const extractMetaContent = (
  html: string,
  attrName: "name" | "property",
  attrValue: string,
) => {
  const pattern = new RegExp(
    `<meta[^>]*${attrName}=["']${attrValue}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : null;
};

const extractTitle = (html: string) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : null;
};

const stripHtmlToText = (html: string) =>
  normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  ).slice(0, MAX_TEXT_LENGTH);

const normalizeJsonLd = (raw: string) =>
  raw
    .replace(/^\s*<!--/, "")
    .replace(/-->\s*$/, "")
    .trim();

const flattenJsonLdNodes = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenJsonLdNodes(item));
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;

    if (candidate["@graph"]) {
      return flattenJsonLdNodes(candidate["@graph"]);
    }

    return [candidate];
  }

  return [];
};

const isRecipeNode = (value: unknown) => {
  if (!value || typeof value !== "object") return false;

  const typeValue = (value as Record<string, unknown>)["@type"];
  const types = Array.isArray(typeValue) ? typeValue : [typeValue];

  return types.some(
    (item) => typeof item === "string" && item.includes("Recipe"),
  );
};

const extractRecipeJsonLd = (
  html: string,
  sourceUrl: string,
): RecipeJsonLd | null => {
  const matches = Array.from(
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  );

  for (const match of matches) {
    const normalized = normalizeJsonLd(match[1] ?? "");
    if (!normalized) continue;

    try {
      const parsed = JSON.parse(normalized) as unknown;
      const recipeNode = flattenJsonLdNodes(parsed).find(isRecipeNode) as
        | Record<string, unknown>
        | undefined;

      if (!recipeNode) continue;

      const title = firstString(recipeNode.name);
      const ingredients = toStringArray(recipeNode.recipeIngredient);
      const instructions = extractInstructions(recipeNode.recipeInstructions);

      if (!title || (ingredients.length === 0 && instructions.length === 0)) {
        continue;
      }

      return {
        title,
        description: firstString(recipeNode.description),
        imageUrl: toAbsoluteUrl(firstString(recipeNode.image), sourceUrl),
        yieldServings: parseYieldServings(recipeNode.recipeYield),
        ingredients,
        instructions,
      };
    } catch {
      continue;
    }
  }

  return null;
};

export function extractRecipePage(
  html: string,
  sourceUrl: string,
): ExtractedRecipePage {
  const title =
    extractMetaContent(html, "property", "og:title") ??
    extractMetaContent(html, "name", "twitter:title") ??
    extractTitle(html);

  const description =
    extractMetaContent(html, "property", "og:description") ??
    extractMetaContent(html, "name", "description") ??
    extractMetaContent(html, "name", "twitter:description");

  const imageUrl =
    toAbsoluteUrl(
      extractMetaContent(html, "property", "og:image"),
      sourceUrl,
    ) ??
    toAbsoluteUrl(extractMetaContent(html, "name", "twitter:image"), sourceUrl);

  const siteName =
    extractMetaContent(html, "property", "og:site_name") ??
    (() => {
      try {
        return new URL(sourceUrl).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })();

  const recipeJsonLd = extractRecipeJsonLd(html, sourceUrl);

  return {
    title,
    description,
    siteName,
    imageUrl: recipeJsonLd?.imageUrl ?? imageUrl,
    textContent: stripHtmlToText(html),
    recipeJsonLd,
  };
}
