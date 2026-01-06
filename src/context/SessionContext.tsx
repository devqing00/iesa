"use client";

/**
 * SessionContext - The Core of Time Travel Feature
 *
 * This context manages the "current session" state, enabling users to
 * switch between academic years and view historical data.
 *
 * Key Concepts:
 * 1. currentSession: The active session being viewed (defaults to active academic session)
 * 2. Time Travel: Switching sessions filters ALL data across the entire app
 * 3. Session-Aware APIs: All API calls automatically include currentSession.id
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { getApiUrl } from "@/lib/api";

// Session Type Definitions
export interface Session {
  id: string;
  name: string; // e.g., "2024/2025"
  isActive: boolean;
  currentSemester: 1 | 2;
  startDate: string;
  endDate: string;
}

export interface SessionSummary {
  id: string;
  name: string;
  isActive: boolean;
  currentSemester: number;
}

interface SessionContextType {
  currentSession: Session | null;
  allSessions: SessionSummary[];
  isLoading: boolean;
  error: string | null;
  switchSession: (sessionId: string) => void;
  refreshSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({
  children,
}) => {
  const { user, loading: authLoading } = useAuth();
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [allSessions, setAllSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all available sessions
   */
  const fetchSessions = useCallback(async (token: string) => {
    try {
      const response = await fetch(getApiUrl("/api/sessions"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const sessions: SessionSummary[] = await response.json();
      setAllSessions(sessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setError("Failed to load academic sessions");
    }
  }, []);

  /**
   * Fetch the active academic session (default)
   */
  const fetchActiveSession = useCallback(async (token: string) => {
    try {
      const response = await fetch(getApiUrl("/api/sessions/active"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch active session");
      }

      const activeSession: Session = await response.json();
      setCurrentSession(activeSession);

      // Store in localStorage for persistence
      localStorage.setItem("currentSessionId", activeSession.id);
    } catch (err) {
      console.error("Error fetching active session:", err);
      setError("No active academic session found");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Switch to a different session (Time Travel!)
   */
  const switchSession = useCallback(
    async (sessionId: string) => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch session");
        }

        const session: Session = await response.json();
        setCurrentSession(session);

        // Store preference
        localStorage.setItem("currentSessionId", session.id);
      } catch (err) {
        console.error("Error switching session:", err);
        setError("Failed to switch session");
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  /**
   * Refresh sessions list (call after creating new session)
   */
  const refreshSessions = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      await fetchSessions(token);
    } catch (err) {
      console.error("Error refreshing sessions:", err);
    }
  };

  /**
   * Initialize session data when user logs in
   */
  useEffect(() => {
    const initializeSessions = async () => {
      if (!user || authLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        const token = await user.getIdToken();

        // Check if user had a preferred session stored
        const storedSessionId = localStorage.getItem("currentSessionId");

        if (storedSessionId) {
          // Try to load stored session first
          try {
            await switchSession(storedSessionId);
          } catch {
            // If stored session is invalid, fall back to active
            await fetchActiveSession(token);
          }
        } else {
          // No stored preference, load active session
          await fetchActiveSession(token);
        }

        // Load all sessions for dropdown
        await fetchSessions(token);
      } catch (err) {
        console.error("Error initializing sessions:", err);
        setError("Failed to initialize sessions");
        setIsLoading(false);
      }
    };

    initializeSessions();
  }, [user, authLoading, fetchActiveSession, fetchSessions, switchSession]);

  const value: SessionContextType = {
    currentSession,
    allSessions,
    isLoading,
    error,
    switchSession,
    refreshSessions,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};
