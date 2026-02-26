"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatTopBarProps {
  title: string;
  onOpenSidebar: () => void;
  children?: React.ReactNode;
}

export function ChatTopBar({ title, onOpenSidebar, children }: ChatTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-12 items-center gap-2 px-3 lg:px-4">
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

        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {title}
        </p>

        {children ? (
          <div className="flex items-center gap-1">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
