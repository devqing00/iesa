"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
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
  // Dual Email System
  emailType?: "institutional" | "personal";
  secondaryEmail?: string;
  secondaryEmailType?: "institutional" | "personal";
  secondaryEmailVerified?: boolean;
  notificationEmailPreference?: "primary" | "secondary" | "both";
  notificationChannelPreference?: "email" | "in_app" | "both";
  notificationCategories?: Record<string, boolean>;
  dateOfBirth?: string;
  isExternalStudent?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  userProfile: UserProfile | null; // alias for backward compat
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
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
      department?: string;
      dateOfBirth?: string;
    }
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  firebaseUser: null,
  signInWithEmail: async () => {},
  signInWithGoogle: async () => false,
  signUpWithEmail: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  getAccessToken: async () => null,
  sendPasswordReset: async () => {},
  sendVerificationEmail: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ──────────────────────────────────────────────
// Firebase error → human-readable message
// ──────────────────────────────────────────────

function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const rawMsg = (err as { message?: string })?.message ?? "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password. Please check your credentials and try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Password is too weak — use at least 8 characters with uppercase, lowercase, and a number.";
    case "auth/user-disabled":
      return "This account has been suspended. Please contact support.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again, or reset your password.";
    case "auth/network-request-failed":
      return "Network error — check your internet connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Google sign-in popup was blocked. Please allow popups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account with this email exists. Try signing in with email and password instead.";
    case "auth/requires-recent-login":
      return "For security, please sign out and sign back in before doing this.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled. Please contact support.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/missing-email":
      return "Please enter your email address.";
    default:
      return rawMsg
        .replace(/^Firebase:\s*/i, "")
        .replace(/\s*\(auth\/[^)]+\)\.?\s*$/, "")
        .trim() || "Something went wrong. Please try again.";
  }
}

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const fbUserRef = useRef<FirebaseUser | null>(null);

  /**
   * Get Firebase ID token (auto-refreshes if expired).
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const currentUser = fbUserRef.current;
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

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
      return { ...profile, id: profile._id || profile.id };
    } catch {
      return null;
    }
  }, [getAccessToken]);

  /**
   * Send profile data to backend after Firebase account creation.
   * Idempotent — safe to call multiple times.
   */
  const registerProfile = useCallback(
    async (
      fbUser: FirebaseUser,
      extra?: {
        firstName?: string;
        lastName?: string;
        matricNumber?: string;
        phone?: string;
        level?: string;
        admissionYear?: number;
        role?: string;
        department?: string;
        dateOfBirth?: string;
      }
    ) => {
      const token = await fbUser.getIdToken();
      const res = await fetch(getApiUrl("/api/v1/auth/register-profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseIdToken: token,
          firstName: extra?.firstName || fbUser.displayName?.split(" ")[0] || "New",
          lastName: extra?.lastName || fbUser.displayName?.split(" ").slice(1).join(" ") || "User",
          matricNumber: extra?.matricNumber || null,
          phone: extra?.phone || null,
          level: extra?.level || null,
          admissionYear: extra?.admissionYear || null,
          role: extra?.role || null,
          department: extra?.department || null,
          dateOfBirth: extra?.dateOfBirth || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Profile creation failed" }));
        throw new Error(err.detail || "Profile creation failed");
      }

      return res.json();
    },
    []
  );

  /**
   * Bootstrap: listen for Firebase auth state changes.
   */
  useEffect(() => {
    // Wire token getter for API service layer
    setTokenGetter(async () => getAccessToken());

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      fbUserRef.current = fbUser;
      setFirebaseUser(fbUser);

      if (fbUser) {
        // User is signed in — try to fetch backend profile
        const profile = await fetchUserProfile();
        if (profile) {
          setUser(profile);
        } else {
          // No backend profile yet (e.g. Google sign-in without register-profile)
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auth methods ────────────────────────────

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const msg = mapFirebaseError(err);
      throw new Error(msg || "Failed to sign in. Please try again.");
    }
    const fbUser = credential.user;
    fbUserRef.current = fbUser;
    setFirebaseUser(fbUser);

    // Fetch profile
    const token = await fbUser.getIdToken();
    const res = await fetch(getApiUrl("/api/v1/users/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("Account not found. Please register first.");
    }

    const profile = await res.json();
    const normalized = { ...profile, id: profile._id || profile.id };
    setUser(normalized);

    // Role-based redirect
    const role = normalized.role;
    if (role === "admin" || role === "exco") {
      router.push("/admin/dashboard");
    } else {
      router.push("/dashboard");
    }
  }, [router]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    let credential;
    try {
      credential = await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (!msg) return false; // popup closed — silently ignore
      throw new Error(msg);
    }
    const fbUser = credential.user;
    fbUserRef.current = fbUser;
    setFirebaseUser(fbUser);

    // Try register-profile (idempotent — creates or returns existing)
    await registerProfile(fbUser);

    // Fetch full profile
    const profile = await fetchUserProfile();
    if (profile) {
      setUser(profile);
      const role = profile.role;
      if (role === "admin" || role === "exco") {
        router.push("/admin/dashboard");
      } else {
        router.push("/dashboard");
      }
    }
    return true;
  }, [router, registerProfile, fetchUserProfile]);

  const signUpWithEmail = useCallback(
    async (
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
        department?: string;
        dateOfBirth?: string;
      }
    ) => {
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        const msg = mapFirebaseError(err);
        throw new Error(msg || "Failed to create account. Please try again.");
      }
      const fbUser = credential.user;
      fbUserRef.current = fbUser;
      setFirebaseUser(fbUser);

      // Send Firebase email verification
      await sendEmailVerification(fbUser);

      // Create backend profile
      await registerProfile(fbUser, extra);

      // Fetch profile
      const profile = await fetchUserProfile();
      if (profile) {
        setUser(profile);
        const role = profile.role;
        if (role === "admin" || role === "exco") {
          router.push("/admin/dashboard");
        } else {
          router.push("/dashboard");
        }
      }
    },
    [router, registerProfile, fetchUserProfile]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore — still clear local state
    }

    fbUserRef.current = null;
    setFirebaseUser(null);
    setUser(null);
    router.push("/");
  }, [router]);

  const refreshProfile = useCallback(async () => {
    const profile = await fetchUserProfile();
    if (profile) setUser(profile);
  }, [fetchUserProfile]);

  const handleSendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const handleSendVerificationEmail = useCallback(async () => {
    const currentUser = fbUserRef.current;
    if (currentUser) {
      await sendEmailVerification(currentUser);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      userProfile: user,
      loading,
      firebaseUser,
      signInWithEmail,
      signInWithGoogle,
      signUpWithEmail,
      signOut: handleSignOut,
      refreshProfile,
      getAccessToken,
      sendPasswordReset: handleSendPasswordReset,
      sendVerificationEmail: handleSendVerificationEmail,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, firebaseUser]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
