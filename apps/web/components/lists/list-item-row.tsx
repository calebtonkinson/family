"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ListItem } from "@/lib/api-client";
import { Trash2 } from "lucide-react";

interface ListItemRowProps {
  item: ListItem;
  onToggle: (itemId: string, markedOff: boolean) => void;
  onDelete?: (itemId: string) => void;
  disabled?: boolean;
}

export function ListItemRow({ item, onToggle, onDelete, disabled }: ListItemRowProps) {
  const isMarkedOff = !!item.markedOffAt;

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors",
        "hover:bg-accent/30",
        disabled && "opacity-50",
        isMarkedOff && "opacity-70"
      )}
    >
      <label className={cn("flex min-w-0 flex-1 items-center gap-3", !disabled && "cursor-pointer")}>
        <Checkbox
          checked={isMarkedOff}
          onCheckedChange={(checked) =>
            onToggle(item.id, checked === true)
          }
          disabled={disabled}
        />
        <span
          className={cn(
            "flex-1 text-sm",
            isMarkedOff && "line-through text-muted-foreground"
          )}
        >
          {item.content}
        </span>
      </label>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          disabled={disabled}
          aria-label={`Delete ${item.content}`}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
            !disabled && "hover:bg-destructive/10 hover:text-destructive",
            disabled && "cursor-not-allowed"
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
