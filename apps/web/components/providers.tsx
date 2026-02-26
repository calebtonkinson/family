"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { NotificationPrompt } from "@/components/pwa/notification-prompt";
import { registerServiceWorker, setupInstallPrompt } from "@/lib/pwa";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  // Initialize PWA functionality
  useEffect(() => {
    setupInstallPrompt();
    registerServiceWorker();
  }, []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
        <InstallPrompt />
        <NotificationPrompt />
      </QueryClientProvider>
    </SessionProvider>
  );
}
