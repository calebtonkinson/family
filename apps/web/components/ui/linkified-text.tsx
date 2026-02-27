import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TRAILING_PUNCTUATION = new Set([".", ",", "!", "?", ":", ";", ")"]);

function splitTrailingPunctuation(candidate: string) {
  let urlPart = candidate;
  let trailingText = "";

  while (urlPart.length > 0) {
    const lastChar = urlPart[urlPart.length - 1];
    if (!TRAILING_PUNCTUATION.has(lastChar)) {
      break;
    }

    if (lastChar === ")") {
      const openingParens = (urlPart.match(/\(/g) ?? []).length;
      const closingParens = (urlPart.match(/\)/g) ?? []).length;
      if (closingParens <= openingParens) {
        break;
      }
    }

    trailingText = `${lastChar}${trailingText}`;
    urlPart = urlPart.slice(0, -1);
  }

  return { urlPart, trailingText };
}

function normalizeExternalHref(urlText: string) {
  const withProtocol = urlText.toLowerCase().startsWith("www.")
    ? `https://${urlText}`
    : urlText;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

export function LinkifiedText({
  text,
  className,
  linkClassName,
}: LinkifiedTextProps) {
  const segments: ReactNode[] = [];
  const urlRegex = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
  let lastIndex = 0;

  for (const match of text.matchAll(urlRegex)) {
    const rawMatch = match[0];
    const startIndex = match.index ?? 0;

    if (startIndex > lastIndex) {
      segments.push(text.slice(lastIndex, startIndex));
    }

    const { urlPart, trailingText } = splitTrailingPunctuation(rawMatch);
    const href = normalizeExternalHref(urlPart);

    if (href) {
      segments.push(
        <a
          key={`url-${startIndex}`}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "text-primary underline underline-offset-2 hover:no-underline break-all",
            linkClassName,
          )}
        >
          {urlPart}
        </a>,
      );
      if (trailingText) {
        segments.push(trailingText);
      }
    } else {
      segments.push(rawMatch);
    }

    lastIndex = startIndex + rawMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return <span className={className}>{segments}</span>;
}
