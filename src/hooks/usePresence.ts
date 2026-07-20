"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

export function usePresence() {
  const { user, firebaseUser } = useAuth();

  useEffect(() => {
    if (!user || !firebaseUser) return;

    const pingPresence = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        await fetch(getApiUrl("/api/v1/users/me/presence"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Failed to update presence:", error);
      }
    };

    // Ping immediately on mount if logged in
    pingPresence();

    // Ping every 3 minutes while the tab is open
    const interval = setInterval(pingPresence, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, firebaseUser]);
}
