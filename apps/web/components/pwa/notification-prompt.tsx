"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { X, Bell } from "lucide-react";
import {
  requestNotificationPermission,
  canSendNotifications,
  registerServiceWorker,
  subscribeToPush,
} from "@/lib/pwa";
import { useSession } from "next-auth/react";

export function NotificationPrompt() {
  const { data: session } = useSession();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!session) return;

    // Check if already permitted
    if (canSendNotifications()) {
      setShowPrompt(false);
      return;
    }

    // Check if notifications are supported
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    // Check if already dismissed recently
    const wasDismissed = localStorage.getItem("notification-prompt-dismissed");
    if (wasDismissed) {
      const dismissedDate = new Date(wasDismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setDismissed(true);
        return;
      }
    }

    // Show prompt if permission is default (not yet asked)
    if (Notification.permission === "default") {
      // Delay showing the prompt
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [session]);

  const handleEnable = async () => {
    const permission = await requestNotificationPermission();

    if (permission === "granted") {
      setShowPrompt(false);

      // Register service worker and subscribe to push
      const registration = await registerServiceWorker();
      if (registration) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (vapidKey) {
          const subscription = await subscribeToPush(registration, vapidKey);
          if (subscription) {
            // Send subscription to server (requires auth)
            const accessToken = (session as unknown as { accessToken?: string })
              ?.accessToken;

            if (!accessToken) {
              console.error(
                "[NotificationPrompt] No access token; cannot register push subscription with server",
              );
              return;
            }

            const response = await fetch("/api/v1/push/subscribe", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(subscription.toJSON()),
            });

            if (!response.ok) {
              console.error(
                "[NotificationPrompt] Failed to register push subscription:",
                response.status,
              );
            }
          }
        }
      }
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("notification-prompt-dismissed", new Date().toISOString());
  };

  if (!showPrompt || dismissed) {
    return null;
  }

  return (
    <Card className="fixed bottom-[calc(var(--mobile-nav-offset)+1rem)] left-4 right-4 z-50 shadow-lg md:bottom-4 md:left-auto md:right-4 md:w-80">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Enable Notifications</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-sm">
          Get reminders for tasks and stay on top of household responsibilities.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button onClick={handleEnable} className="w-full" size="sm">
          <Bell className="mr-2 h-4 w-4" />
          Enable Notifications
        </Button>
      </CardContent>
    </Card>
  );
}
