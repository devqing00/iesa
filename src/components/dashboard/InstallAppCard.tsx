"use client";

import { toast } from "sonner";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export default function InstallAppCard() {
  const {
    canInstall,
    isIosSafari,
    shouldShowInstallCard,
    promptInstall,
    snoozeInstallPrompt,
    dismissInstallPrompt,
  } = useInstallPrompt();

  if (!shouldShowInstallCard) return null;

  const onInstallClick = async () => {
    const result = await promptInstall();
    if (result.outcome === "accepted") {
      toast.success("App installed", {
        description: "IESA is now available on your home screen.",
      });
      return;
    }

    toast.info("Install prompt dismissed", {
      description: "You can install any time from this card.",
    });
    snoozeInstallPrompt(24);
  };

  return (
    <div className="mb-5 bg-lime-light border-4 border-navy rounded-3xl p-5 md:p-6 shadow-[6px_6px_0_0_#000] relative overflow-hidden">
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-lime/25 pointer-events-none" />
      <svg aria-hidden="true" className="absolute top-3 right-16 w-5 h-5 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      <div className="flex items-start gap-4 relative z-10">
        <div className="w-12 h-12 bg-snow border-[3px] border-navy rounded-2xl flex items-center justify-center shrink-0 shadow-[3px_3px_0_0_#000]">
          <svg aria-hidden="true" className="w-6 h-6 text-navy" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.75 5.25A2.25 2.25 0 0 1 6 3h12a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 18 21H6a2.25 2.25 0 0 1-2.25-2.25V5.25ZM12 18a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-black text-lg text-navy leading-tight">Install IESA App</h3>
          {canInstall ? (
            <p className="text-sm text-navy-muted mt-1">
              Add IESA to your home screen for faster access, full-screen experience, and better reliability.
            </p>
          ) : isIosSafari ? (
            <div className="text-sm text-navy-muted mt-1 space-y-1">
              <p>Install manually on iPhone/iPad:</p>
              <p>1. Tap the Share icon in Safari.</p>
              <p>2. Choose Add to Home Screen.</p>
              <p>3. Tap Add.</p>
            </div>
          ) : (
            <p className="text-sm text-navy-muted mt-1">Install is unavailable in this browser right now.</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {canInstall && (
              <button
                onClick={() => {
                  void onInstallClick();
                }}
                className="bg-lime border-[3px] border-navy px-5 py-2.5 rounded-xl font-display font-bold text-sm text-navy press-3 press-navy"
              >
                Install App
              </button>
            )}

            <button
              onClick={() => snoozeInstallPrompt(24)}
              className="bg-snow border-[3px] border-navy px-4 py-2 rounded-xl font-display font-bold text-xs text-navy press-2 press-black"
            >
              Remind me tomorrow
            </button>

            <button
              onClick={dismissInstallPrompt}
              className="bg-transparent border-2 border-navy px-4 py-2 rounded-xl font-display font-bold text-xs text-navy hover:bg-cloud transition-colors"
            >
              Don&apos;t show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
