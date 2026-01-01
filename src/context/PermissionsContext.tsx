"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";

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
  const { user, userProfile } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user || !userProfile) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      
      // Fetch user's permissions from backend
      const response = await fetch("/api/v1/users/me/permissions", {
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

  const hasPermission = (permission: string): boolean => {
    if (permissions.includes("*")) return true; // Admin wildcard
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    if (permissions.includes("*")) return true;
    return perms.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]): boolean => {
    if (permissions.includes("*")) return true;
    return perms.every((p) => permissions.includes(p));
  };

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
