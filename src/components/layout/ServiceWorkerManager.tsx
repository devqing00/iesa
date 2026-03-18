"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const SW_URL = "/push-sw.js";

export default function ServiceWorkerManager() {
  const updateToastShownRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const requestImmediateActivation = () => {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      } else {
        window.location.reload();
      }
    };

    const showUpdateToast = () => {
      if (updateToastShownRef.current) return;
      updateToastShownRef.current = true;
      toast.info("New version available", {
        description: "Refresh now to get the latest fixes and features.",
        duration: 15000,
        action: {
          label: "Refresh",
          onClick: requestImmediateActivation,
        },
      });
    };

    const watchRegistration = (reg: ServiceWorkerRegistration) => {
      registration = reg;

      if (reg.waiting) {
        showUpdateToast();
      }

      reg.addEventListener("updatefound", () => {
        const nextWorker = reg.installing;
        if (!nextWorker) return;
        nextWorker.addEventListener("statechange", () => {
          if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });
    };

    navigator.serviceWorker
      .register(SW_URL, { updateViaCache: "none" })
      .then((reg) => {
        watchRegistration(reg);
        return reg.update();
      })
      .catch(() => {
        // non-critical
      });

    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
