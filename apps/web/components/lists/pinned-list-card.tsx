"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronRight, List } from "lucide-react";
import type { PinnedList } from "@/lib/api-client";

interface PinnedListCardProps {
  list: PinnedList;
  compact?: boolean;
}

export function PinnedListCard({
  list,
  compact = false,
}: PinnedListCardProps) {
  const activeItems = list.items.filter((i) => !i.markedOffAt);
  const displayItems = compact ? activeItems.slice(0, 3) : activeItems.slice(0, 5);

  return (
    <Link href={`/lists/${list.id}`} className="block">
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-primary shrink-0" />
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
                  <span className="w-4 h-4 shrink-0 rounded border border-muted" />
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
