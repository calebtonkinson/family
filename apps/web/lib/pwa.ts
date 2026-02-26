"use client";

/**
 * Register the service worker for PWA functionality.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.log("[PWA] Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    console.log("[PWA] Service worker registered:", registration.scope);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Every hour

    return registration;
  } catch (error) {
    console.error("[PWA] Service worker registration failed:", error);
    return null;
  }
}

/**
 * Subscribe to push notifications.
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  try {
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      return existingSubscription;
    }

    // Subscribe with VAPID key
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    console.log("[PWA] Push subscription created");
    return subscription;
  } catch (error) {
    console.error("[PWA] Failed to subscribe to push:", error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log("[PWA] Push subscription removed");
      return true;
    }
    return false;
  } catch (error) {
    console.error("[PWA] Failed to unsubscribe from push:", error);
    return false;
  }
}

/**
 * Check if the app is installed as a PWA.
 */
export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;

  // Check if running in standalone mode
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  // iOS Safari specific check
  const isIOSStandalone = "standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone;

  return isStandalone || Boolean(isIOSStandalone);
}

/**
 * Prompt user to install the PWA.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function setupInstallPrompt() {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log("[PWA] Install prompt available");
  });

  window.addEventListener("appinstalled", () => {
    console.log("[PWA] App installed");
    deferredPrompt = null;
  });
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    console.log("[PWA] No install prompt available");
    return false;
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("[PWA] Install prompt outcome:", outcome);
    deferredPrompt = null;
    return outcome === "accepted";
  } catch (error) {
    console.error("[PWA] Install prompt failed:", error);
    return false;
  }
}

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Convert VAPID key from base64 to Uint8Array.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Request notification permission.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  const result = await Notification.requestPermission();
  return result;
}

/**
 * Check if notifications are supported and permitted.
 */
export function canSendNotifications(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && Notification.permission === "granted";
}
