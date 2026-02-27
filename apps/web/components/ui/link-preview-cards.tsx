import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TRAILING_PUNCTUATION = new Set([".", ",", "!", "?", ":", ";", ")"]);
const MARKDOWN_LINK_REGEX = /\[[^\]]+\]\(([^)\s]+)\)/g;
const BARE_URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;

function splitTrailingPunctuation(candidate: string) {
  let urlPart = candidate;

  while (urlPart.length > 0) {
    const lastChar = urlPart.at(-1);
    if (!lastChar || !TRAILING_PUNCTUATION.has(lastChar)) {
      break;
    }

    if (lastChar === ")") {
      const openingParens = (urlPart.match(/\(/g) ?? []).length;
      const closingParens = (urlPart.match(/\)/g) ?? []).length;
      if (closingParens <= openingParens) {
        break;
      }
    }

    urlPart = urlPart.slice(0, -1);
  }

  return urlPart;
}

function normalizeExternalUrl(candidate: string) {
  const withProtocol = candidate.toLowerCase().startsWith("www.")
    ? `https://${candidate}`
    : candidate;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface LinkPreviewItem {
  href: string;
  title: string;
  subtitle: string;
}

function extractLinkPreviewItems(text: string) {
  const items: LinkPreviewItem[] = [];
  const seen = new Set<string>();

  const addCandidate = (candidate: string) => {
    const urlPart = splitTrailingPunctuation(candidate);
    if (!urlPart) return;

    const parsed = normalizeExternalUrl(urlPart);
    if (!parsed) return;

    const href = parsed.toString();
    if (seen.has(href)) return;
    seen.add(href);

    const host = parsed.hostname.replace(/^www\./i, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const query = parsed.search || "";
    const shortPath = `${path}${query}`;

    items.push({
      href,
      title: host,
      subtitle: shortPath ? `${host}${shortPath}` : href,
    });
  };

  for (const match of text.matchAll(MARKDOWN_LINK_REGEX)) {
    addCandidate(match[1] ?? "");
  }

  for (const match of text.matchAll(BARE_URL_REGEX)) {
    addCandidate(match[1] ?? "");
  }

  return items;
}

interface LinkPreviewCardsProps {
  text: string;
  className?: string;
  maxCards?: number;
}

export function LinkPreviewCards({
  text,
  className,
  maxCards = 4,
}: LinkPreviewCardsProps) {
  const items = extractLinkPreviewItems(text);
  if (items.length === 0) return null;

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {items.slice(0, maxCards).map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "group flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2",
            "transition-colors hover:border-primary/40 hover:bg-accent/30",
          )}
        >
          <div className="min-w-0 flex items-center gap-2">
            <span className="rounded bg-primary/10 p-1 text-primary">
              <LinkIcon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
            </div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
        </a>
      ))}
      {items.length > maxCards && (
        <p className="text-xs text-muted-foreground">
          +{items.length - maxCards} more link{items.length - maxCards === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
