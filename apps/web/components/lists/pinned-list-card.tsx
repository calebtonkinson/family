"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronRight, List } from "lucide-react";
import type { PinnedList } from "@/lib/api-client";

interface PinnedListCardProps {
  list: PinnedList;
  compact?: boolean;
}

export function PinnedListCard({ list, compact = false }: PinnedListCardProps) {
  const activeItems = list.items.filter((i) => !i.markedOffAt);
  const displayItems = compact
    ? activeItems.slice(0, 2)
    : activeItems.slice(0, 4);

  return (
    <Link href={`/lists/${list.id}`} className="block">
      <Card className="feature-panel h-full overflow-hidden">
        <CardHeader className="pb-1.5 md:pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(180deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.08))] md:h-8 md:w-8 md:rounded-xl">
                <List className="h-4 w-4 shrink-0 text-primary" />
              </span>
              <h3 className="font-semibold text-sm truncate">{list.name}</h3>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {displayItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">All done!</p>
          ) : (
            <ul className="space-y-1">
              {displayItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="h-4 w-4 shrink-0 rounded-md border border-border/80 bg-background/80" />
                  <span className="truncate">{item.content}</span>
                </li>
              ))}
            </ul>
          )}
          {activeItems.length > displayItems.length && (
            <p className="text-xs text-muted-foreground mt-2">
              +{activeItems.length - displayItems.length} more
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
