"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Home,
  CheckSquare,
  List,
  Folder,
  UtensilsCrossed,
  Palette,
  Users,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  className?: string;
}

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/themes", label: "Themes", icon: Palette },
  { href: "/family", label: "Family", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/80 bg-[linear-gradient(180deg,hsl(40_30%_97%/0.98),hsl(38_22%_93%/0.95))] shadow-[inset_-1px_0_0_hsl(var(--background)/0.8),20px_0_40px_-32px_hsl(var(--foreground)/0.18)] backdrop-blur-xl",
        className
      )}
    >
      {/* Logo */}
      <div className="border-b border-border/70 px-6 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(180deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.08))] shadow-[inset_0_1px_0_hsl(var(--card)/0.9)]">
            <Home className="h-5 w-5 text-primary" />
          </span>
          <span className="flex flex-col">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Household
            </span>
            <span className="text-xl font-semibold tracking-[-0.02em]">Home</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all duration-200",
                isActive
                  ? "bg-[linear-gradient(180deg,hsl(var(--card)/0.94),hsl(var(--card)/0.82))] text-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.9),0_18px_30px_-26px_hsl(var(--foreground)/0.38)] [&_svg]:text-primary"
                  : "text-muted-foreground hover:bg-[hsl(var(--foreground)/0.045)] hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-primary" />
              )}
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer with Settings and User */}
      <div className="space-y-2 border-t border-border/70 p-4">
        <Link
          href="/settings"
          className={cn(
            "relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all duration-200",
            pathname === "/settings"
              ? "bg-[linear-gradient(180deg,hsl(var(--card)/0.94),hsl(var(--card)/0.82))] text-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.9),0_18px_30px_-26px_hsl(var(--foreground)/0.38)] [&_svg]:text-primary"
              : "text-muted-foreground hover:bg-[hsl(var(--foreground)/0.045)] hover:text-foreground"
          )}
        >
          {pathname === "/settings" && (
            <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-primary" />
          )}
          <Settings className="h-5 w-5" />
          Settings
        </Link>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--card)/0.76))] px-3.5 py-3 text-sm font-medium text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.9)] transition-colors hover:text-foreground">
              <Avatar className="h-8 w-8 border border-border/70">
                <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || ""} />
                <AvatarFallback className="bg-[linear-gradient(180deg,hsl(var(--foreground)/0.92),hsl(var(--foreground)/0.74))] text-xs text-background">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-left text-foreground">{session?.user?.name || "User"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <div className="flex items-center gap-2 p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || ""} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{session?.user?.name}</span>
                <span className="text-xs text-muted-foreground">{session?.user?.email}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
