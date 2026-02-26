"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isChat = pathname?.startsWith("/chat");

  return (
    <div className={cn("flex min-h-screen", isChat && "h-dvh overflow-hidden")}>
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Main content area */}
      <div className={cn("flex min-w-0 flex-1 flex-col md:ml-64", isChat && "min-h-0")}>
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col pb-[var(--mobile-nav-offset)] md:pb-0",
            isChat && "h-full overflow-hidden",
          )}
        >
          {isChat ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          ) : (
            <div className="container mx-auto min-w-0 max-w-full px-4 py-6">{children}</div>
          )}
        </main>

        {/* Mobile bottom nav */}
        <BottomNav className="md:hidden" />
      </div>
    </div>
  );
}
