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
    <Card className="cursor-pointer transition-colors hover:bg-muted/50 hover:shadow-lg h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm truncate">{list.name}</h3>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {previewItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet</p>
        ) : (
          <ul className="space-y-1">
            {previewItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-3.5 h-3.5 shrink-0 rounded border border-muted-foreground/30" />
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
