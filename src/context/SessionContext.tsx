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
import { getApiUrl, setSessionIdGetter } from "@/lib/api";

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
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [allSessions, setAllSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all available sessions
   */
  const fetchSessions = useCallback(async (token: string) => {
    try {
      const response = await fetch(getApiUrl("/api/v1/sessions/"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Sessions fetch failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
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
      const response = await fetch(getApiUrl("/api/v1/sessions/active"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch active session. Status: ${response.status}`, errorText);
        throw new Error(`Failed to fetch active session: ${response.status} ${response.statusText}`);
      }

      const activeSession: Session = await response.json();
      console.log("Active session loaded:", activeSession);
      
      // Ensure we have an 'id' field (handle both _id and id from backend)
      const normalizedSession: Session = {
        ...activeSession,
        id: activeSession.id || (activeSession as any)._id,
      };
      
      setCurrentSession(normalizedSession);

      // Store in localStorage for persistence
      localStorage.setItem("currentSessionId", normalizedSession.id);
    } catch (err) {
      console.error("Error fetching active session:", err);
      setError("No active academic session found. Please create and activate a session in the Sessions page.");
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
      // Guard against stale/invalid IDs
      if (!sessionId || sessionId === "undefined" || sessionId === "null") return;

      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) return;
        const response = await fetch(getApiUrl(`/api/v1/sessions/${sessionId}`), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch session");
        }

        const session: Session = await response.json();
        
        // Ensure we have an 'id' field (handle both _id and id from backend)
        const normalizedSession: Session = {
          ...session,
          id: session.id || (session as any)._id,
        };
        
        setCurrentSession(normalizedSession);

        // Store preference
        localStorage.setItem("currentSessionId", normalizedSession.id);
      } catch (err) {
        console.error("Error switching session:", err);
        setError("Failed to switch session");
      } finally {
        setIsLoading(false);
      }
    },
    [user, getAccessToken]
  );

  /**
   * Refresh sessions list AND active session details
   * (call after creating/editing sessions to ensure UI is in sync)
   */
  const refreshSessions = useCallback(async () => {
    if (!user) return;

    try {
      const token = await getAccessToken();
      if (!token) return;
      
      // Refresh the sessions list
      await fetchSessions(token);
      
      // If current session is the active one, refetch it to get updated details (dates, etc.)
      if (currentSession?.isActive) {
        // Refetch active session to get updated fields like dates
        try {
          const response = await fetch(getApiUrl("/api/v1/sessions/active"), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const activeSession: Session = await response.json();
            const normalizedSession: Session = {
              ...activeSession,
              id: activeSession.id || (activeSession as any)._id,
            };
            setCurrentSession(normalizedSession);
            localStorage.setItem("currentSessionId", normalizedSession.id);
          }
        } catch (err) {
          console.error("Error refetching active session during refresh:", err);
        }
      } else if (currentSession?.id) {
        // If viewing a non-active session, refetch that specific session
        try {
          const response = await fetch(getApiUrl(`/api/v1/sessions/${currentSession.id}`), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const session: Session = await response.json();
            const normalizedSession: Session = {
              ...session,
              id: session.id || (session as any)._id,
            };
            setCurrentSession(normalizedSession);
            localStorage.setItem("currentSessionId", normalizedSession.id);
          }
        } catch (err) {
          console.error("Error refetching session during refresh:", err);
        }
      }
    } catch (err) {
      console.error("Error refreshing sessions:", err);
    }
  }, [user, getAccessToken, fetchSessions, currentSession]);

  /**
   * Initialize session data when user logs in
   */
  useEffect(() => {
    const initializeSessions = async () => {
      if (!user || authLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) return;

        // Check if user had a preferred session stored
        const rawStoredId = localStorage.getItem("currentSessionId");
        // Guard against stale "undefined" / "null" strings saved in a previous bad state
        const storedSessionId =
          rawStoredId && rawStoredId !== "undefined" && rawStoredId !== "null"
            ? rawStoredId
            : null;

        if (storedSessionId) {
          // Try to load stored session first
          try {
            await switchSession(storedSessionId);
          } catch {
            // If stored session is invalid, clear it and fall back to active
            localStorage.removeItem("currentSessionId");
            await fetchActiveSession(token);
          }
        } else {
          // Clear any stale value
          if (rawStoredId) localStorage.removeItem("currentSessionId");
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

  // Wire session ID getter for API service layer
  useEffect(() => {
    setSessionIdGetter(() => currentSession?.id ?? null);
  }, [currentSession]);

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
