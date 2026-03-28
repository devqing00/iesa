"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type InstallOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
}

const INSTALL_DISMISSED_KEY = "iesa_install_prompt_dismissed_v1";
const INSTALL_SNOOZE_UNTIL_KEY = "iesa_install_prompt_snooze_until_v1";

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMatch = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(standaloneMatch || iosStandalone);
}

function isIosSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome|android/.test(ua);
  return isIOS && isSafari;
}

function readSnoozeUntil(): number {
  if (typeof window === "undefined") return 0;
  const value = window.localStorage.getItem(INSTALL_SNOOZE_UNTIL_KEY);
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSnoozed(): boolean {
  const now = Date.now();
  return readSnoozeUntil() > now;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneMode());
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  });
  const [isPromptSnoozed, setIsPromptSnoozed] = useState<boolean>(() => isSnoozed());
  const [isIosSafari] = useState<boolean>(() => isIosSafariBrowser());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (event: Event) => {
      const dismissed = window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
      const snoozed = isSnoozed();
      const installed = isStandaloneMode();

      // If the user already dismissed/snoozed/installed, don't intercept the
      // browser flow. This avoids the "preventDefault() called without prompt()"
      // warning and lets native behavior proceed.
      if (dismissed || snoozed || installed) {
        return;
      }

      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.localStorage.removeItem(INSTALL_SNOOZE_UNTIL_KEY);
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    };

    const onDisplayModeChange = () => {
      if (isStandaloneMode()) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", onAppInstalled);
    window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.matchMedia?.("(display-mode: standalone)")?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const canInstall = !!deferredPrompt && !isInstalled;

  const shouldShowInstallCard = useMemo(() => {
    if (isInstalled || isDismissed || isPromptSnoozed) return false;
    return canInstall || isIosSafari;
  }, [canInstall, isDismissed, isInstalled, isIosSafari, isPromptSnoozed]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "dismissed" as InstallOutcome };

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
        window.localStorage.removeItem(INSTALL_SNOOZE_UNTIL_KEY);
      }
    }

    setDeferredPrompt(null);
    return { outcome: choice.outcome };
  }, [deferredPrompt]);

  const snoozeInstallPrompt = useCallback((hours = 24) => {
    if (typeof window === "undefined") return;
    const until = Date.now() + hours * 60 * 60 * 1000;
    window.localStorage.setItem(INSTALL_SNOOZE_UNTIL_KEY, String(until));
    setIsPromptSnoozed(true);
  }, []);

  const dismissInstallPrompt = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setIsDismissed(true);
  }, []);

  return {
    canInstall,
    isInstalled,
    isIosSafari,
    shouldShowInstallCard,
    promptInstall,
    snoozeInstallPrompt,
    dismissInstallPrompt,
  };
}
