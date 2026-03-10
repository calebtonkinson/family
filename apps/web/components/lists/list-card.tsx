"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { List } from "lucide-react";
import type { List as ListType } from "@/lib/api-client";

interface ListCardProps {
  list: ListType;
}

export function ListCard({ list }: ListCardProps) {
  const previewItems = list.previewItems ?? [];

  return (
    <Card className="feature-panel h-full cursor-pointer">
      <CardHeader className="pb-1.5 md:pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(180deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.08))] md:h-8 md:w-8 md:rounded-xl">
            <List className="h-4 w-4 shrink-0 text-primary" />
          </span>
          <h3 className="font-semibold text-sm truncate">{list.name}</h3>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {previewItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet</p>
        ) : (
          <ul className="space-y-1">
            {previewItems.slice(0, 3).map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <span className="h-3.5 w-3.5 shrink-0 rounded-md border border-border/80 bg-background/80" />
                <span className="truncate text-muted-foreground">
                  {item.content}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
