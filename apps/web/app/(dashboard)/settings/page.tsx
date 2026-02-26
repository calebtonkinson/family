"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Bell, User, Home, Shield, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useMealPlanningPreferences,
  useUpdateMealPlanningPreferences,
} from "@/hooks/use-meal-planning-preferences";
import {
  requestNotificationPermission,
  canSendNotifications,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pwa";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [notificationsSupported, setNotificationsSupported] = useState(true);
  const [mealPhilosophy, setMealPhilosophy] = useState("");
  const { data: mealPreferencesData } = useMealPlanningPreferences();
  const updateMealPlanningPreferences = useUpdateMealPlanningPreferences();

  // Helper to make authenticated API calls
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const accessToken = (session as unknown as { accessToken?: string })
      ?.accessToken;
    if (!accessToken) {
      throw new Error("No access token available");
    }
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
  };

  // Check notification status on mount and ensure subscription is registered
  useEffect(() => {
    const checkAndRegisterSubscription = async () => {
      if (typeof window === "undefined") return;

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setNotificationsSupported(false);
        return;
      }

      const isEnabled = canSendNotifications();
      setNotificationsEnabled(isEnabled);

      // If notifications are enabled, ensure subscription is registered with server
      if (isEnabled && session) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            // Re-register with server to ensure it's saved
            const subJson = subscription.toJSON();
            console.log(
              "[Settings] Verifying subscription with server:",
              subJson,
            );
            const accessToken = (session as unknown as { accessToken?: string })
              ?.accessToken;
            if (accessToken) {
              const response = await fetch("/api/v1/push/subscribe", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(subJson),
              });
              console.log(
                "[Settings] Subscription verified, status:",
                response.status,
              );
            }
          } else {
            console.log("[Settings] No existing subscription found in browser");
          }
        } catch (error) {
          console.error("[Settings] Failed to verify subscription:", error);
        }
      }
    };

    checkAndRegisterSubscription();
  }, [session]);

  useEffect(() => {
    setMealPhilosophy(mealPreferencesData?.data?.notes ?? "");
  }, [mealPreferencesData?.data?.notes]);

  const handleNotificationToggle = async (enabled: boolean) => {
    setNotificationsLoading(true);
    try {
      if (enabled) {
        // Request permission
        const permission = await requestNotificationPermission();
        if (permission !== "granted") {
          toast({
            title: "Permission Denied",
            description:
              "Please enable notifications in your browser settings.",
            variant: "destructive",
          });
          setNotificationsLoading(false);
          return;
        }

        // Register service worker and subscribe
        const registration = await registerServiceWorker();
        if (!registration) {
          toast({
            title: "Error",
            description: "Failed to register service worker.",
            variant: "destructive",
          });
          setNotificationsLoading(false);
          return;
        }

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          toast({
            title: "Configuration Error",
            description: "Push notifications are not configured.",
            variant: "destructive",
          });
          setNotificationsLoading(false);
          return;
        }

        const subscription = await subscribeToPush(registration, vapidKey);
        if (subscription) {
          const subJson = subscription.toJSON();
          console.log("[Settings] Sending subscription to server:", subJson);
          try {
            const response = await authFetch("/api/v1/push/subscribe", {
              method: "POST",
              body: JSON.stringify(subJson),
            });
            console.log(
              "[Settings] Subscribe response status:",
              response.status,
            );
            if (response.ok) {
              setNotificationsEnabled(true);
              toast({
                title: "Notifications Enabled",
                description: "You will now receive push notifications.",
              });
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error("[Settings] Subscribe error:", errorData);
              toast({
                title: "Error",
                description: "Failed to register with server.",
                variant: "destructive",
              });
            }
          } catch (subError) {
            console.error("[Settings] Failed to save subscription:", subError);
            toast({
              title: "Error",
              description:
                "Failed to register with server. Check console for details.",
              variant: "destructive",
            });
          }
        }
      } else {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await authFetch("/api/v1/push/unsubscribe", {
            method: "POST",
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await unsubscribeFromPush(registration);
        }
        setNotificationsEnabled(false);
        toast({
          title: "Notifications Disabled",
          description: "You will no longer receive push notifications.",
        });
      }
    } catch (error) {
      console.error("Notification toggle error:", error);
      toast({
        title: "Error",
        description: "Failed to update notification settings.",
        variant: "destructive",
      });
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!notificationsEnabled) {
      toast({
        title: "Notifications Not Enabled",
        description: "Please enable notifications first.",
        variant: "destructive",
      });
      return;
    }

    setTestLoading(true);
    try {
      const response = await authFetch("/api/v1/push/test", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("[Settings] Test notification result:", result);

      if (result.sent > 0) {
        toast({
          title: "Test Sent",
          description: "Check for your notification!",
        });
      } else {
        toast({
          title: "No Subscriptions",
          description:
            "No push subscriptions found. Try toggling notifications off and on.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Test notification error:", error);
      toast({
        title: "Error",
        description: "Failed to send test notification.",
        variant: "destructive",
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSaveMealPhilosophy = async () => {
    try {
      await updateMealPlanningPreferences.mutateAsync({
        notes: mealPhilosophy.trim() || null,
      });
      toast({
        title: "Meal planning philosophy saved",
      });
    } catch (error) {
      console.error("Failed to save meal planning preferences:", error);
      toast({
        title: "Failed to save meal planning philosophy",
        variant: "destructive",
      });
    }
  };

  const initials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session?.user?.image || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{session?.user?.name}</p>
              <p className="text-sm text-muted-foreground">
                {session?.user?.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Household */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            <CardTitle>Household</CardTitle>
          </div>
          <CardDescription>Manage your household settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="householdName">Household Name</Label>
            <Input id="householdName" defaultValue="Tonkinson Family" />
          </div>
          <Button variant="outline">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meal Planning Philosophy</CardTitle>
          <CardDescription>
            Tell the assistant your meal strategy once so it can plan from a stable baseline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={mealPhilosophy}
            onChange={(event) => setMealPhilosophy(event.target.value)}
            placeholder="Example: Weeknights should be fast, kid-friendly, and mostly 30 minutes or less. We prefer leftovers on Fridays."
            rows={6}
          />
          <Button
            type="button"
            onClick={handleSaveMealPhilosophy}
            disabled={updateMealPlanningPreferences.isPending}
          >
            {updateMealPlanningPreferences.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save philosophy
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure your notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!notificationsSupported ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Push notifications are not supported in this browser.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-notifications">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications for task reminders
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={notificationsEnabled}
                  onCheckedChange={handleNotificationToggle}
                  disabled={notificationsLoading}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Test Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send a test notification to verify it&apos;s working
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  disabled={!notificationsEnabled || testLoading}
                >
                  {testLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Test
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Get a daily summary of your tasks
                  </p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Reminder Time</Label>
                <Input type="time" defaultValue="08:00" className="w-32" />
                <p className="text-xs text-muted-foreground">
                  When to send daily reminders
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Account</CardTitle>
          </div>
          <CardDescription>Manage your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm text-muted-foreground">
              This application is private and restricted to authorized family
              members only.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
