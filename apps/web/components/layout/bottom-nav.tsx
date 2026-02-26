"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildNewTaskHrefFromLocation } from "@/lib/task-navigation";
import {
  Home,
  CheckSquare,
  List,
  MessageSquare,
  Plus,
  Folder,
  UtensilsCrossed,
  Users,
  Palette,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface BottomNavProps {
  className?: string;
}

const primaryNavItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

const createActions = [
  { href: "/tasks/new", label: "New Task", icon: CheckSquare },
  { href: "/projects/new", label: "New Project", icon: Folder },
  { href: "/family/new", label: "Add Family Member", icon: Users },
];

const moreLinks = [
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/family", label: "Family", icon: Users },
  { href: "/themes", label: "Themes", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const newTaskHref = buildNewTaskHrefFromLocation(pathname, searchParams.toString());

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border",
        "bg-background pb-[env(safe-area-inset-bottom)]",
        className,
      )}
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      <div className="grid h-16 grid-cols-5 items-center">
        {primaryNavItems.slice(0, 2).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center gap-1 px-2 py-2 text-xs text-primary"
              aria-label="Open quick actions"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <Plus className="h-5 w-5" />
              </span>
              <span>Add</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader className="text-left">
              <SheetTitle>Quick Actions</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-6">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Create
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {createActions.map((action) => {
                    const Icon = action.icon;
                    const href = action.href === "/tasks/new" ? newTaskHref : action.href;
                    return (
                      <Button
                        key={action.href}
                        asChild
                        variant="outline"
                        className="justify-start"
                        onClick={() => setOpen(false)}
                      >
                        <Link href={href}>
                          <Icon className="mr-2 h-4 w-4" />
                          {action.label}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Go To
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {moreLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.href}
                        asChild
                        variant="ghost"
                        className="justify-start"
                        onClick={() => setOpen(false)}
                      >
                        <Link href={item.href}>
                          <Icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </section>
            </div>
          </SheetContent>
        </Sheet>

        {primaryNavItems.slice(2).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
