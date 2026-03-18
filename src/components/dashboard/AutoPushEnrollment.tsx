"use client";

import { useEffect, useRef, useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Modal } from "@/components/ui/Modal";

const DISMISS_KEY = "iesa_push_prompt_dismissed_v1";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

export default function AutoPushEnrollment() {
  const { supported, permission, subscribed, loading, error, subscribe } = usePushNotifications();
  const attemptedAutoEnrollRef = useRef(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DISMISS_KEY);
    if (!stored) {
      setDismissed(false);
      return;
    }

    if (stored === "1") {
      const now = Date.now();
      window.localStorage.setItem(DISMISS_KEY, String(now));
      setDismissed(true);
      return;
    }

    const dismissedAt = Number(stored);
    if (!Number.isFinite(dismissedAt)) {
      window.localStorage.removeItem(DISMISS_KEY);
      setDismissed(false);
      return;
    }

    const isWithinSnooze = Date.now() - dismissedAt < DISMISS_DURATION_MS;
    if (!isWithinSnooze) {
      window.localStorage.removeItem(DISMISS_KEY);
    }
    setDismissed(isWithinSnooze);
  }, []);

  useEffect(() => {
    if (!supported) return;
    if (permission !== "granted") return;
    if (subscribed || loading) return;
    if (attemptedAutoEnrollRef.current) return;

    attemptedAutoEnrollRef.current = true;
    void subscribe();
  }, [supported, permission, subscribed, loading, subscribe]);

  const hidePrompt = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };

  const showModal = supported && !subscribed && permission === "default" && !dismissed;
  if (!showModal) return null;

  const handleEnable = async () => {
    await subscribe();
  };

  return (
    <Modal isOpen={showModal} onClose={hidePrompt} title="Stay Updated Instantly" size="md">
      <div className="space-y-4">
        <p className="text-sm text-navy">
          Allow notifications so you never miss urgent announcements, payment deadlines, or timetable updates.
        </p>
        <div className="rounded-2xl border-2 border-navy bg-lime-light p-3 text-xs text-navy">
          You&apos;ll get alerts even when this tab is closed.
        </div>
        {error && (
          <div className="rounded-2xl border-2 border-coral bg-coral-light p-3 text-xs text-coral">
            {error}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="rounded-xl border-[3px] border-navy bg-lime px-4 py-2 font-display font-bold text-sm text-navy press-3 press-navy disabled:opacity-60"
          >
            {loading ? "Enabling..." : "Enable Notifications"}
          </button>
          <button
            type="button"
            onClick={hidePrompt}
            className="rounded-xl border-[3px] border-navy bg-snow px-4 py-2 font-display font-bold text-sm text-navy press-3 press-black"
          >
            Not now
          </button>
        </div>
      </div>
    </Modal>
  );
}
