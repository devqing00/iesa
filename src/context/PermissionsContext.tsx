"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { getApiUrl } from "@/lib/api";

interface PermissionsContextType {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  loading: true,
  refetch: async () => {},
});

export const usePermissions = () => useContext(PermissionsContext);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, userProfile, getAccessToken } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    // Always gate with loading=true while fetching to prevent race conditions
    // (e.g., withAuth seeing stale empty permissions during account switch)
    setLoading(true);

    if (!user || !userProfile) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) return;

      // Fetch user's permissions from backend
      const response = await fetch(getApiUrl("/api/v1/users/me/permissions"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      } else {
        // Fallback: Admin gets all permissions
        if (userProfile.role === "admin") {
          setPermissions(["*"]); // Wildcard for all permissions
        } else {
          setPermissions([]);
        }
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user, userProfile]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Stabilize permission check functions to prevent unnecessary re-renders
  const hasPermission = useCallback((permission: string): boolean => {
    if (permissions.includes("*")) return true; // Admin wildcard
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((perms: string[]): boolean => {
    if (permissions.includes("*")) return true;
    return perms.some((p) => permissions.includes(p));
  }, [permissions]);

  const hasAllPermissions = useCallback((perms: string[]): boolean => {
    if (permissions.includes("*")) return true;
    return perms.every((p) => permissions.includes(p));
  }, [permissions]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        loading,
        refetch: fetchPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}
