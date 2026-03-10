"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatTopBarProps {
  title: string;
  subtitle?: string;
  onOpenSidebar: () => void;
  children?: React.ReactNode;
}

export function ChatTopBar({
  title,
  subtitle,
  onOpenSidebar,
  children,
}: ChatTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-h-15 items-center gap-2 px-3 py-2 lg:px-5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open chat list"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        {children ? (
          <div className="flex items-center gap-1.5">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
