"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, CheckSquare, List, Folder, Palette, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { buildNewTaskHrefFromLocation } from "@/lib/task-navigation";

const quickActions = [
  { label: "New Task", icon: CheckSquare, href: "/tasks/new" },
  { label: "New List", icon: List, href: "/lists" },
  { label: "New Project", icon: Folder, href: "/projects/new" },
  { label: "New Theme", icon: Palette, href: "/themes/new" },
  { label: "Add Family Member", icon: Users, href: "/family/new" },
];

export function FAB() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const newTaskHref = buildNewTaskHrefFromLocation(pathname, searchParams.toString());

  const handleAction = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className={cn(
            "fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg md:bottom-6",
            "transition-transform hover:scale-105"
          )}
        >
          <Plus className={cn("h-6 w-6 transition-transform", open && "rotate-45")} />
          <span className="sr-only">Quick actions</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle>Quick Actions</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-4 py-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const href = action.href === "/tasks/new" ? newTaskHref : action.href;
            return (
              <Button
                key={action.label}
                variant="outline"
                className="flex h-auto flex-col gap-2 py-6"
                onClick={() => handleAction(href)}
              >
                <Icon className="h-6 w-6" />
                <span>{action.label}</span>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
