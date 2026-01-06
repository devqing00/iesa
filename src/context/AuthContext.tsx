"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";

// Extended User Profile from MongoDB
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
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Fetch user profile from MongoDB after Firebase authentication
   */
  const fetchUserProfile = async (firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(getApiUrl("/api/users/me"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
      } else if (response.status === 404) {
        // User not in MongoDB yet, create profile
        await createUserProfile(firebaseUser);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  /**
   * Create user profile in MongoDB
   */
  const createUserProfile = async (firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken();

      // Extract name parts with fallbacks to satisfy backend validation
      const displayName = firebaseUser.displayName || "";
      const nameParts = displayName.trim().split(/\s+/);

      // Ensure we have at least 1 char for first and last name as per backend requirements
      const firstName = (nameParts[0] || "New").trim();
      const lastName = (
        nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User"
      ).trim();

      const response = await fetch(getApiUrl("/api/users"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email,
          firstName: firstName || "User",
          lastName: lastName || "",
          department: "Industrial Engineering",
          role: "student",
          profilePictureUrl: firebaseUser.photoURL,
        }),
      });

      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
      }
    } catch (error) {
      console.error("Error creating user profile:", error);
    }
  };

  /**
   * Refresh user profile (call after profile updates)
   */
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Fetch MongoDB profile after Firebase auth
        await fetchUserProfile(firebaseUser);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error signing in with email", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error signing up with email", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
      router.push("/");
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
