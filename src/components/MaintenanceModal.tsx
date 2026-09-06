"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Wrench, X } from "lucide-react";

export default function MaintenanceModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only show once per session so it's not overly annoying
    const hasSeenModal = sessionStorage.getItem("iesa_maintenance_seen");
    if (!hasSeenModal) {
      // Slight delay for better UX
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("iesa_maintenance_seen", "true");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 md:p-8 animate-in zoom-in-95 duration-300">
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Header */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full" />
            <div className="relative flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-full">
              <Wrench className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            We Are Back Live! 🎉
          </h2>
          <div className="space-y-4 text-gray-600 dark:text-gray-300 text-sm md:text-base leading-relaxed">
            <p>
              We sincerely apologize for the recent downtime. The platform was offline for the past few days due to unexpected technical issues and necessary server maintenance.
            </p>
            <p>
              Thank you so much for your patience during this time. We have resolved the hosting issues, and the platform is now fully restored and ready for you!
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="mt-8">
          <button 
            onClick={handleClose}
            className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-black text-white font-semibold rounded-xl transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
