"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for PWA/offline support.
 * Include this component once in the app tree (e.g., inside Providers).
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("SW registration failed:", err);
        });
    }
  }, []);

  return null;
}
