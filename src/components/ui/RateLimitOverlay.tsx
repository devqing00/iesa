"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function RateLimitOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [message, setMessage] = useState("Too many requests. Please slow down.");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handleRateLimit = (e: Event) => {
      const customEvent = e as CustomEvent<{ retryAfter: number; message?: string }>;
      const { retryAfter, message } = customEvent.detail;
      
      if (message) setMessage(message);
      setTimeLeft(retryAfter || 60);
      setIsOpen(true);
    };

    window.addEventListener("rate-limit-exceeded", handleRateLimit);
    return () => window.removeEventListener("rate-limit-exceeded", handleRateLimit);
  }, []);

  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsOpen(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
      <div className="bg-snow border-[4px] border-navy rounded-2xl shadow-[8px_8px_0_0_#000] p-6 max-w-sm w-full relative animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-coral-light border-[3px] border-navy flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="font-display font-black text-xl text-navy mb-2">Rate Limit Exceeded</h2>
          <p className="text-slate text-sm font-medium mb-6">
            {message}
          </p>

          <div className="w-full bg-ghost border-[3px] border-navy rounded-xl py-3 px-4 flex items-center justify-between">
            <span className="font-bold text-navy">Cooldown</span>
            <span className="font-display font-black text-2xl text-coral">{timeLeft}s</span>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="mt-6 w-full py-3 bg-navy text-snow font-bold border-[3px] border-navy hover:bg-snow hover:text-navy transition-colors rounded-xl shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-y-[2px]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
