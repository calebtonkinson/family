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
  const isDashboardHome = pathname === "/dashboard";

  return (
    <div className={cn("flex min-h-screen", isChat && "h-dvh overflow-hidden")}>
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Main content area */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col md:ml-72",
          isChat && "min-h-0",
        )}
      >
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col pb-[var(--mobile-nav-offset)] md:pb-6",
            isChat && "h-full overflow-hidden",
          )}
        >
          {isChat ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          ) : isDashboardHome ? (
            <div className="container mx-auto min-w-0 max-w-[1440px] px-3 pt-3 md:px-6 md:pt-6">
              {children}
            </div>
          ) : (
            <div className="container mx-auto min-w-0 max-w-[1440px] px-2 pt-2 md:px-6 md:pt-6">
              <div className="page-shell rounded-[1.5rem] p-1.5 md:rounded-[2rem] md:p-5">
                <div className="page-surface rounded-[1.35rem] px-3 pt-4 pb-[calc(var(--mobile-nav-offset)+0.85rem)] md:rounded-[1.75rem] md:px-6 md:py-6">
                  {children}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Mobile bottom nav */}
        <BottomNav className="md:hidden" />
      </div>
    </div>
  );
}
