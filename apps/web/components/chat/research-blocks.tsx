"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import type { PresentationBlock, ResearchPresentation } from "@home/shared";

function ProseBlock({ block }: { block: Extract<PresentationBlock, { type: "prose" }> }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown>{block.markdown}</ReactMarkdown>
    </div>
  );
}

function ComparisonTableBlock({
  block,
}: {
  block: Extract<PresentationBlock, { type: "comparison_table" }>;
}) {
  return (
    <div className="my-3 overflow-x-auto">
      {block.caption && (
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          {block.caption}
        </div>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground" />
            {block.columns.map((col: string) => (
              <th
                key={col}
                className="border-b px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row: { label: string; values: string[] }) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium">{row.label}</td>
              {row.values.map((val: string, i: number) => (
                <td key={`${row.label}-${i}`} className="px-3 py-2 text-muted-foreground">
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankedListBlock({
  block,
}: {
  block: Extract<PresentationBlock, { type: "ranked_list" }>;
}) {
  return (
    <div className="my-3 space-y-2">
      {block.title && (
        <div className="text-sm font-medium">{block.title}</div>
      )}
      <ol className="space-y-2">
        {block.items.map((item: { title: string; subtitle?: string; detail?: string; url?: string }, index: number) => (
          <li key={item.title} className="flex gap-3 rounded-lg border p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 space-y-0.5">
              <div className="font-medium text-sm">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline inline-flex items-center gap-1"
                  >
                    {item.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  item.title
                )}
              </div>
              {item.subtitle && (
                <div className="text-xs text-muted-foreground">{item.subtitle}</div>
              )}
              {item.detail && (
                <div className="text-sm text-muted-foreground">{item.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SourcesBlock({
  block,
}: {
  block: Extract<PresentationBlock, { type: "sources" }>;
}) {
  const [open, setOpen] = useState(false);

  if (block.items.length === 0) return null;

  return (
    <div className="my-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {block.items.length} source{block.items.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-5">
          {block.items.map((source: { label: string; url: string }) => (
            <li key={source.url} className="text-xs">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-1"
              >
                {source.label}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CalloutBlock({
  block,
}: {
  block: Extract<PresentationBlock, { type: "callout" }>;
}) {
  const variantConfig = {
    info: {
      icon: Info,
      border: "border-blue-500/30",
      bg: "bg-blue-500/10",
      text: "text-blue-800 dark:text-blue-300",
    },
    warning: {
      icon: AlertTriangle,
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      text: "text-amber-800 dark:text-amber-300",
    },
    tip: {
      icon: Lightbulb,
      border: "border-green-500/30",
      bg: "bg-green-500/10",
      text: "text-green-800 dark:text-green-300",
    },
  } as const;

  const config = variantConfig[block.variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "my-3 flex gap-2.5 rounded-lg border p-3 text-sm",
        config.border,
        config.bg,
        config.text,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{block.content}</div>
    </div>
  );
}

function ActionItemsBlock({
  block,
}: {
  block: Extract<PresentationBlock, { type: "action_items" }>;
}) {
  return (
    <div className="my-3">
      {block.title && (
        <div className="mb-1.5 text-sm font-medium">{block.title}</div>
      )}
      <ul className="space-y-1.5">
        {block.items.map((item: { text: string; detail?: string }) => (
          <li key={item.text} className="flex gap-2 text-sm">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <div>
              <div>{item.text}</div>
              {item.detail && (
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PresentationBlockRenderer({ block }: { block: PresentationBlock }) {
  switch (block.type) {
    case "prose":
      return <ProseBlock block={block} />;
    case "comparison_table":
      return <ComparisonTableBlock block={block} />;
    case "ranked_list":
      return <RankedListBlock block={block} />;
    case "sources":
      return <SourcesBlock block={block} />;
    case "callout":
      return <CalloutBlock block={block} />;
    case "action_items":
      return <ActionItemsBlock block={block} />;
    default:
      return null;
  }
}

export function ResearchPresentationView({
  presentation,
}: {
  presentation: ResearchPresentation;
}) {
  return (
    <div className="space-y-1">
      {/* Main markdown response */}
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{presentation.markdown}</ReactMarkdown>
      </div>

      {/* Optional display blocks */}
      {presentation.blocks.length > 0 && (
        <div className="space-y-1">
          {presentation.blocks.map((block: PresentationBlock, index: number) => (
            <PresentationBlockRenderer key={`${block.type}-${index}`} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
