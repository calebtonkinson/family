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
import { X, Download, Smartphone } from "lucide-react";
import { canInstall, promptInstall, isPwaInstalled } from "@/lib/pwa";

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    setIsInstalled(isPwaInstalled());

    // Check localStorage for dismissed state
    const wasDismissed = localStorage.getItem("pwa-install-dismissed");
    if (wasDismissed) {
      const dismissedDate = new Date(wasDismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      setDismissed(daysSinceDismissed < 7);
    }

    // Check if install is available
    const checkInstall = () => {
      setShowPrompt(canInstall());
    };

    checkInstall();

    // Listen for install prompt availability
    window.addEventListener("beforeinstallprompt", checkInstall);
    return () => window.removeEventListener("beforeinstallprompt", checkInstall);
  }, []);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowPrompt(false);
      setIsInstalled(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
  };

  // Don't show if already installed, not available, or dismissed
  if (isInstalled || !showPrompt || dismissed) {
    return null;
  }

  return (
    <Card className="fixed bottom-[calc(var(--mobile-nav-offset)+1rem)] left-4 right-4 z-50 shadow-lg md:bottom-4 md:left-auto md:right-4 md:w-80">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Install App</CardTitle>
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
          Install Home Management for a better experience with offline access and push notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button onClick={handleInstall} className="w-full" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Install
        </Button>
      </CardContent>
    </Card>
  );
}
