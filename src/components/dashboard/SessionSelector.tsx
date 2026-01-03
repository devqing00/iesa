"use client";

/**
 * SessionSelector Component
 * 
 * Dropdown to switch between academic sessions.
 * This enables the "time travel" feature.
 */

import React, { useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { ChevronDown, Calendar, Check } from 'lucide-react';

export const SessionSelector: React.FC = () => {
  const { currentSession, allSessions, switchSession, isLoading } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading || !currentSession) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] animate-pulse">
        <Calendar className="h-4 w-4 text-[var(--foreground)]/50" />
        <span className="text-sm text-[var(--foreground)]/50">Loading...</span>
      </div>
    );
  }

  const handleSessionChange = (sessionId: string) => {
    switchSession(sessionId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] hover:border-[var(--primary)] transition-all duration-200 group"
        aria-label="Select academic session"
      >
        <Calendar className="h-4 w-4 text-[var(--primary)]" />
        <span className="text-sm font-medium text-[var(--foreground)]">
          {currentSession.name}
        </span>
        {currentSession.isActive && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--primary)] text-white">
            Active
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-[var(--foreground)]/50 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] shadow-lg z-50 overflow-hidden">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-[var(--foreground)]/50 uppercase tracking-wide">
                Academic Sessions
              </div>
              
              {allSessions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-[var(--foreground)]/50 text-center">
                  No sessions available
                </div>
              ) : (
                <div className="space-y-1">
                  {allSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSessionChange(session.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-150 ${
                        session.id === currentSession.id
                          ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                          : 'hover:bg-[var(--foreground)]/5 text-[var(--foreground)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{session.name}</span>
                        {session.isActive && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-[var(--primary)]/20 text-[var(--primary)]">
                            Active
                          </span>
                        )}
                      </div>
                      
                      {session.id === currentSession.id && (
                        <Check className="h-4 w-4 text-[var(--primary)]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info Footer */}
            <div className="px-4 py-3 bg-[var(--foreground)]/5 border-t border-[var(--glass-border)]">
              <p className="text-xs text-[var(--foreground)]/50">
                Switching sessions filters all data across the dashboard
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
