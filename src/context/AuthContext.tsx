"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl, setTokenGetter } from "@/lib/api";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  matricNumber?: string;
  department: string;
  role: "student" | "admin" | "exco";
  phone?: string;
  bio?: string;
  profilePictureUrl?: string;
  emailVerified?: boolean;
  hasCompletedOnboarding?: boolean;
  level?: string;
  currentLevel?: string;
  admissionYear?: number;
  skills?: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  userProfile: UserProfile | null; // alias for backward compat
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    extra?: {
      firstName?: string;
      lastName?: string;
      matricNumber?: string;
      phone?: string;
      level?: string;
      admissionYear?: number;
      role?: string;
    }
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  getAccessToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

// ──────────────────────────────────────────────
// Token store (in-memory only — never localStorage)
// ──────────────────────────────────────────────

let memoryAccessToken: string | null = null;
let tokenExpiresAt: number = 0; // epoch ms

function setMemoryToken(token: string | null, expiresIn?: number) {
  memoryAccessToken = token;
  if (token && expiresIn) {
    // Set expiry 60s before actual to allow proactive refresh
    tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
  } else {
    tokenExpiresAt = 0;
  }
}

function isTokenExpired(): boolean {
  return !memoryAccessToken || Date.now() >= tokenExpiresAt;
}

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const refreshingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Attempt to refresh the access token using the httpOnly cookie.
   * Returns true if refresh succeeded.
   */
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (refreshingRef.current) return false;
    refreshingRef.current = true;

    try {
      const res = await fetch(getApiUrl("/api/v1/auth/refresh"), {
        method: "POST",
        credentials: "include", // send httpOnly cookie
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        setMemoryToken(null);
        return false;
      }

      const data = await res.json();
      setMemoryToken(data.access_token, data.expires_in);
      return true;
    } catch {
      setMemoryToken(null);
      return false;
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  /**
   * Get a valid access token, refreshing if needed.
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!isTokenExpired()) return memoryAccessToken;

    const ok = await refreshAccessToken();
    return ok ? memoryAccessToken : null;
  }, [refreshAccessToken]);

  /**
   * Fetch the current user profile from the backend.
   */
  const fetchUserProfile = useCallback(async (): Promise<UserProfile | null> => {
    const token = await getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch(getApiUrl("/api/v1/users/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return null;

      const profile = await res.json();
      // normalize id
      const normalized: UserProfile = {
        ...profile,
        id: profile._id || profile.id,
      };
      return normalized;
    } catch {
      return null;
    }
  }, [getAccessToken]);

  /**
   * Schedule proactive token refresh.
   */
  const scheduleRefresh = useCallback(
    (expiresIn: number) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      // Refresh 60s before expiry
      const ms = Math.max((expiresIn - 60) * 1000, 5000);
      refreshTimerRef.current = setTimeout(async () => {
        const ok = await refreshAccessToken();
        if (ok) {
          // Re-schedule for the next cycle
          scheduleRefresh(900); // 15 min default
        }
      }, ms);
    },
    [refreshAccessToken]
  );

  /**
   * Bootstrap: try to restore session from refresh cookie on mount.
   */
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const ok = await refreshAccessToken();

      if (ok && !cancelled) {
        const profile = await fetchUserProfile();
        if (profile) {
          setUser(profile);
          scheduleRefresh(900);
        }
      }

      if (!cancelled) setLoading(false);
    };

    // Wire token getter for API service layer
    setTokenGetter(async () => getAccessToken());

    init();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auth methods ────────────────────────────

  const signInWithEmail = async (email: string, password: string) => {
    // Clear any existing session first to prevent stale cookie conflicts
    if (memoryAccessToken || user) {
      try {
        await fetch(getApiUrl("/api/v1/auth/logout"), {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // ignore — still proceed with login
      }
      setMemoryToken(null);
      setUser(null);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    }

    const res = await fetch(getApiUrl("/api/v1/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Login failed");
    }

    const data = await res.json();
    setMemoryToken(data.access_token, data.expires_in);

    // Fetch profile
    const profile = await fetchUserProfile();
    if (profile) {
      setUser(profile);
      scheduleRefresh(data.expires_in);
    }

    // Role-based redirect
    const role = profile?.role;
    if (role === "admin" || role === "exco") {
      router.push("/admin/dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    extra?: {
      firstName?: string;
      lastName?: string;
      matricNumber?: string;
      phone?: string;
      level?: string;
      admissionYear?: number;
      role?: string;
    }
  ) => {
    const res = await fetch(getApiUrl("/api/v1/auth/register"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        firstName: extra?.firstName || "New",
        lastName: extra?.lastName || "User",
        matricNumber: extra?.matricNumber || null,
        phone: extra?.phone || null,
        level: extra?.level || null,
        admissionYear: extra?.admissionYear || null,
        role: extra?.role || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Registration failed" }));
      throw new Error(err.detail || "Registration failed");
    }

    const data = await res.json();
    setMemoryToken(data.access_token, data.expires_in);

    // Fetch profile
    const profile = await fetchUserProfile();
    if (profile) {
      setUser(profile);
      scheduleRefresh(data.expires_in);
    }

    // Role-based redirect
    const role = profile?.role;
    if (role === "admin" || role === "exco") {
      router.push("/admin/dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  const signOut = async () => {
    try {
      await fetch(getApiUrl("/api/v1/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore — still clear local state
    }

    setMemoryToken(null);
    setUser(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    router.push("/");
  };

  const refreshProfile = async () => {
    const profile = await fetchUserProfile();
    if (profile) setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile: user, // backward compat alias
        loading,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
